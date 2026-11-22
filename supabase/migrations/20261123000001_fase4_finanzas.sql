-- =====================================================================
-- AM Creators Hub — Fase 4: Finanzas
-- Numeración automática, tipo de cambio, IVA, totales calculados,
-- fees mensuales y gastos recurrentes que se generan solos.
-- No crea tablas nuevas (siguen siendo 34).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Columnas nuevas
-- ---------------------------------------------------------------------
alter table public.invoices
  add column if not exists subtotal numeric(12,2) not null default 0,
  add column if not exists vat_rate numeric(5,2) not null default 0;

alter table public.quotes
  add column if not exists vat_rate numeric(5,2) not null default 0;

-- Un gasto recurrente es una "plantilla" (is_recurring = true) que no cuenta
-- en los reportes; cada mes genera un gasto real que apunta a ella.
alter table public.expenses
  add column if not exists parent_expense_id uuid references public.expenses (id) on delete set null;

create index if not exists expenses_parent_idx on public.expenses (parent_expense_id, date);
create index if not exists invoices_fee_month_idx on public.invoices (recurring_fee_id, issue_date);

-- Los números los pone la base: no hace falta mandarlos
alter table public.invoices alter column number drop not null;
alter table public.quotes   alter column number drop not null;

-- ---------------------------------------------------------------------
-- Numeración: AMC-R-0001 (recibos/cobros) y AMC-P-0001 (presupuestos)
-- ---------------------------------------------------------------------
create or replace function public.assign_document_number()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  n      integer;
  prefix text;
begin
  if new.number is not null and new.number <> '' then
    return new;
  end if;
  if tg_table_name = 'invoices' then
    update public.settings set next_invoice_number = next_invoice_number + 1
    returning next_invoice_number - 1, invoice_prefix into n, prefix;
    new.number := prefix || '-R-' || lpad(n::text, 4, '0');
  else
    update public.settings set next_quote_number = next_quote_number + 1
    returning next_quote_number - 1, invoice_prefix into n, prefix;
    new.number := prefix || '-P-' || lpad(n::text, 4, '0');
  end if;
  return new;
end $$;

create trigger assign_document_number before insert on public.invoices
  for each row execute function public.assign_document_number();
create trigger assign_document_number before insert on public.quotes
  for each row execute function public.assign_document_number();

-- ---------------------------------------------------------------------
-- Tipo de cambio: en pesos siempre 1; en dólares, el cargado para esa fecha
-- (si no se mandó uno a mano).
-- ---------------------------------------------------------------------
create or replace function public.apply_fx_rate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  date_col text := case when tg_table_name = 'expenses' then 'date' else 'issue_date' end;
  d        date := (to_jsonb(new) ->> date_col)::date;
  rate     numeric;
begin
  if new.currency = 'UYU' then
    new.fx_rate := 1;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.currency = old.currency and new.fx_rate is distinct from old.fx_rate then
    return new;   -- lo cambiaron a mano
  end if;
  if tg_op = 'INSERT' and new.fx_rate is not null and new.fx_rate <> 1 then
    return new;   -- vino con un valor explícito
  end if;
  if tg_op = 'UPDATE' and new.currency = old.currency
     and (to_jsonb(new) ->> date_col) is not distinct from (to_jsonb(old) ->> date_col) then
    return new;   -- nada relevante cambió
  end if;
  select usd_to_uyu into rate from public.exchange_rates where date <= d order by date desc limit 1;
  if rate is null then
    raise exception 'Falta el tipo de cambio del dólar. Cargalo en Configuración → Tipo de cambio y volvé a intentar.'
      using errcode = 'P0001';
  end if;
  new.fx_rate := rate;
  return new;
end $$;

create trigger apply_fx_rate before insert or update on public.invoices
  for each row execute function public.apply_fx_rate();
create trigger apply_fx_rate before insert or update on public.quotes
  for each row execute function public.apply_fx_rate();
create trigger apply_fx_rate before insert or update on public.expenses
  for each row execute function public.apply_fx_rate();

-- ---------------------------------------------------------------------
-- Totales: se calculan desde los ítems (subtotal − descuento + IVA)
-- ---------------------------------------------------------------------
create or replace function public.compute_document_total()
returns trigger language plpgsql as $$
begin
  if tg_table_name = 'quotes' then
    new.total := round((new.subtotal - coalesce(new.discount, 0)) * (1 + new.vat_rate / 100), 2);
  else
    new.total := round(new.subtotal * (1 + new.vat_rate / 100), 2);
  end if;
  return new;
end $$;

create trigger compute_document_total before insert or update of subtotal, vat_rate on public.invoices
  for each row execute function public.compute_document_total();
create trigger compute_document_total before insert or update of subtotal, vat_rate, discount on public.quotes
  for each row execute function public.compute_document_total();

create or replace function public.sync_document_subtotal()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  doc_id uuid;
begin
  if tg_table_name = 'invoice_items' then
    doc_id := coalesce(new.invoice_id, old.invoice_id);
    update public.invoices set subtotal = coalesce((
      select sum(round(quantity * unit_price, 2)) from public.invoice_items where invoice_id = doc_id), 0)
    where id = doc_id;
  else
    doc_id := coalesce(new.quote_id, old.quote_id);
    update public.quotes set subtotal = coalesce((
      select sum(round(quantity * unit_price, 2)) from public.quote_items where quote_id = doc_id), 0)
    where id = doc_id;
  end if;
  return null;
end $$;

create trigger sync_document_subtotal after insert or update or delete on public.invoice_items
  for each row execute function public.sync_document_subtotal();
create trigger sync_document_subtotal after insert or update or delete on public.quote_items
  for each row execute function public.sync_document_subtotal();

-- Al marcar cobrado se guarda la fecha; al volver a pendiente se borra
create or replace function public.invoice_paid_at()
returns trigger language plpgsql as $$
begin
  if new.status = 'cobrado' and new.paid_at is null then new.paid_at := now(); end if;
  if new.status <> 'cobrado' then new.paid_at := null; end if;
  return new;
end $$;

create trigger invoice_paid_at before insert or update of status on public.invoices
  for each row execute function public.invoice_paid_at();

-- Completar subtotales de los datos que ya existían (Fases anteriores)
update public.invoices i set subtotal = coalesce(
  (select sum(round(quantity * unit_price, 2)) from public.invoice_items where invoice_id = i.id), i.total);

-- ---------------------------------------------------------------------
-- Trabajos automáticos (corren todos los días y al abrir Finanzas)
-- ---------------------------------------------------------------------
create or replace function public.month_name_es(d date)
returns text language sql immutable as $$
  select (array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','setiembre','octubre','noviembre','diciembre'])[extract(month from d)::int]
         || ' ' || extract(year from d)::int
$$;

-- Crea el cobro del mes de cada fee activo, una sola vez por mes
create or replace function public.generate_monthly_fees()
returns integer language plpgsql security definer set search_path = public as $$
declare
  today   date := public.today_mvd();
  f       record;
  issue   date;
  inv_id  uuid;
  vat     numeric := (select case when vat_mode = 'iva' then vat_rate else 0 end from public.settings);
  n       integer := 0;
begin
  for f in
    select rf.*, c.brand_name from public.recurring_fees rf
    join public.clients c on c.id = rf.client_id
    where rf.is_active and c.deleted_at is null and c.status <> 'finalizado'
      and rf.start_date <= today and (rf.end_date is null or rf.end_date >= today)
  loop
    issue := make_date(extract(year from today)::int, extract(month from today)::int, f.billing_day);
    continue when issue > today or issue < f.start_date;
    continue when exists (
      select 1 from public.invoices
      where recurring_fee_id = f.id and date_trunc('month', issue_date) = date_trunc('month', issue) and deleted_at is null);
    begin
      insert into public.invoices (client_id, recurring_fee_id, issue_date, due_date, currency, vat_rate, status, notes)
      values (f.client_id, f.id, issue, issue + 10, f.currency, vat, 'pendiente', null)
      returning id into inv_id;
      insert into public.invoice_items (invoice_id, description, quantity, unit_price, position)
      values (inv_id, f.description || ' · ' || public.month_name_es(issue), 1, f.amount, 1);
      n := n + 1;
    exception when others then
      raise warning 'No se pudo generar el fee % (%): %', f.id, f.brand_name, sqlerrm;
    end;
  end loop;
  return n;
end $$;

-- Pasa a "vencido" lo pendiente con fecha límite pasada
create or replace function public.mark_overdue_invoices()
returns integer language sql security definer set search_path = public as $$
  with u as (
    update public.invoices set status = 'vencido'
    where status = 'pendiente' and deleted_at is null and due_date < public.today_mvd()
    returning 1)
  select count(*)::int from u
$$;

-- Registra el gasto del mes de cada gasto recurrente
create or replace function public.generate_recurring_expenses()
returns integer language plpgsql security definer set search_path = public as $$
declare
  today date := public.today_mvd();
  t     record;
  d     date;
  n     integer := 0;
begin
  for t in
    select * from public.expenses
    where is_recurring and deleted_at is null and recurrence_day is not null and date <= today
  loop
    d := make_date(extract(year from today)::int, extract(month from today)::int, t.recurrence_day);
    continue when d > today;
    continue when exists (
      select 1 from public.expenses
      where parent_expense_id = t.id and date_trunc('month', date) = date_trunc('month', d) and deleted_at is null);
    begin
      insert into public.expenses (category, description, amount, currency, date, client_id, project_id, is_recurring, parent_expense_id, created_by)
      values (t.category, t.description, t.amount, t.currency, d, t.client_id, t.project_id, false, t.id, t.created_by);
      n := n + 1;
    exception when others then
      raise warning 'No se pudo generar el gasto recurrente %: %', t.id, sqlerrm;
    end;
  end loop;
  return n;
end $$;

create or replace function public.run_finance_jobs()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Solo un admin puede ver finanzas.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'fees', public.generate_monthly_fees(),
    'expenses', public.generate_recurring_expenses(),
    'overdue', public.mark_overdue_invoices());
end $$;

revoke execute on function public.generate_monthly_fees() from public, anon, authenticated;
revoke execute on function public.mark_overdue_invoices() from public, anon, authenticated;
revoke execute on function public.generate_recurring_expenses() from public, anon, authenticated;
revoke execute on function public.run_finance_jobs() from public, anon;
grant execute on function public.run_finance_jobs() to authenticated;

do $$
begin
  perform cron.unschedule('finanzas-diario') where exists (select 1 from cron.job where jobname = 'finanzas-diario');
  -- 06:15 en Montevideo (09:15 UTC)
  perform cron.schedule('finanzas-diario', '15 9 * * *', 'select public.run_finance_jobs()');
end $$;
