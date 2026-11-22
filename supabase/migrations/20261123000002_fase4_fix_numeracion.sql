-- Arreglo: Supabase bloquea los UPDATE sin WHERE ("UPDATE requires a WHERE clause").
-- La numeración automática ahora indica la fila de Configuración (id = true).
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
    where id = true
    returning next_invoice_number - 1, invoice_prefix into n, prefix;
    new.number := prefix || '-R-' || lpad(n::text, 4, '0');
  else
    update public.settings set next_quote_number = next_quote_number + 1
    where id = true
    returning next_quote_number - 1, invoice_prefix into n, prefix;
    new.number := prefix || '-P-' || lpad(n::text, 4, '0');
  end if;
  if n is null then
    raise exception 'Falta la configuración del estudio. Entrá a Configuración → Estudio, guardá los datos y volvé a intentar.';
  end if;
  return new;
end $$;
