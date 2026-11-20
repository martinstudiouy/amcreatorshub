-- =====================================================================
-- AM Creators Hub — Roles, RLS, triggers de negocio, vistas y funciones
-- Regla por defecto: nadie ve nada hasta que una política lo permita.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers de rol (security definer para no chocar con el RLS de profiles)
-- ---------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() in ('admin', 'equipo'), false)
$$;

create or replace function public.current_client_id()
returns uuid language sql stable security definer set search_path = public as $$
  select client_id from public.profiles
  where id = auth.uid() and is_active and role = 'cliente'
$$;

-- ---------------------------------------------------------------------
-- Alta automática de perfil al registrarse un usuario.
-- El PRIMER usuario queda como admin; los siguientes como equipo.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  has_admin boolean;
begin
  select exists (select 1 from public.profiles where role = 'admin') into has_admin;
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    case when has_admin then 'equipo'::public.user_role else 'admin'::public.user_role end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Un no-admin no puede cambiarse el rol, activarse ni asignarse cliente.
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.client_id is distinct from old.client_id
       or new.email is distinct from old.email then
      raise exception 'Solo un admin puede cambiar el rol, el estado o el email de un usuario.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger protect_profile_fields before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Evitar quedarse sin admin.
create or replace function public.keep_one_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and (new.role <> 'admin' or not new.is_active) then
    if not exists (select 1 from public.profiles
                   where role = 'admin' and is_active and id <> old.id) then
      raise exception 'Tiene que quedar al menos un admin activo.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger keep_one_admin before update on public.profiles
  for each row execute function public.keep_one_admin();

-- El equipo no puede tocar montos (fee del cliente, presupuesto del proyecto).
create or replace function public.protect_money_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_table_name = 'clients' then
      if tg_op = 'INSERT' then new.monthly_fee := null;
      elsif new.monthly_fee is distinct from old.monthly_fee then new.monthly_fee := old.monthly_fee;
      end if;
    elsif tg_table_name = 'projects' then
      if tg_op = 'INSERT' then new.budget := null;
      elsif new.budget is distinct from old.budget then new.budget := old.budget;
      end if;
    end if;
  end if;
  return new;
end $$;

create trigger protect_money_fields before insert or update on public.clients
  for each row execute function public.protect_money_fields();
create trigger protect_money_fields before insert or update on public.projects
  for each row execute function public.protect_money_fields();

-- created_by automático
create or replace function public.set_created_by()
returns trigger language plpgsql as $$
begin
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end $$;

do $$
declare t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'created_by'
  loop
    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = t and table_type = 'BASE TABLE') then
      execute format('create trigger set_created_by before insert on public.%I
                      for each row execute function public.set_created_by()', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Registro de actividad (alimenta "Actividad reciente" del dashboard)
-- Argumentos: 0 = columna con el nombre visible, 1 = columna de estado
--             2 = etiqueta del tipo ("Cliente", "Tarea"...), 3 = columna client_id
-- ---------------------------------------------------------------------
create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  label_col  text := tg_argv[0];
  status_col text := tg_argv[1];
  kind       text := tg_argv[2];
  client_col text := tg_argv[3];
  rec        jsonb := to_jsonb(new);
  old_rec    jsonb;
  label      text := coalesce(rec ->> label_col, '(sin nombre)');
  cid        uuid;
  act        text;
  summ       text;
begin
  if client_col = 'self' then
    cid := (rec ->> 'id')::uuid;
  elsif client_col = 'project' then
    select client_id into cid from public.projects where id = (rec ->> 'project_id')::uuid;
  elsif client_col <> '' then
    cid := nullif(rec ->> client_col, '')::uuid;
  end if;

  if tg_op = 'INSERT' then
    act  := 'creo';
    summ := kind || ' creado: ' || label;
  else
    old_rec := to_jsonb(old);
    if (rec ->> 'deleted_at') is not null and (old_rec ->> 'deleted_at') is null then
      act  := 'borro';
      summ := kind || ' enviado a la papelera: ' || label;
    elsif status_col <> '' and (rec ->> status_col) is distinct from (old_rec ->> status_col) then
      act  := 'cambio_estado';
      summ := kind || ' "' || label || '" pasó a ' || case rec ->> status_col
                when 'en_revision'   then 'en revisión'
                when 'en_aprobacion' then 'en aprobación'
                when 'sesion_fotos'  then 'sesión de fotos'
                else replace(rec ->> status_col, '_', ' ') end;
    else
      return new;   -- cambios menores no se registran
    end if;
  end if;

  insert into public.activity_log (actor_id, entity_type, entity_id, action, summary, client_id)
  values (auth.uid(), tg_table_name, (rec ->> 'id')::uuid, act, summ, cid);
  return new;
end $$;

create trigger log_activity after insert or update on public.clients
  for each row execute function public.log_activity('brand_name', 'status', 'Cliente', 'self');
create trigger log_activity after insert or update on public.projects
  for each row execute function public.log_activity('name', 'status', 'Proyecto', 'client_id');
create trigger log_activity after insert or update on public.tasks
  for each row execute function public.log_activity('title', 'column', 'Tarea', 'project');
create trigger log_activity after insert or update on public.content_posts
  for each row execute function public.log_activity('caption', 'status', 'Publicación', 'client_id');
create trigger log_activity after insert or update on public.events
  for each row execute function public.log_activity('title', '', 'Evento', 'client_id');
create trigger log_activity after insert or update on public.invoices
  for each row execute function public.log_activity('number', 'status', 'Cobro', 'client_id');
create trigger log_activity after insert or update on public.quotes
  for each row execute function public.log_activity('number', 'status', 'Presupuesto', 'client_id');

-- =====================================================================
-- RLS: activado en las 34 tablas
-- =====================================================================
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------- Usuarios y configuración ----------------
create policy "perfil propio o staff ve perfiles" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_staff());
create policy "editar perfil propio" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "admin edita perfiles" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin borra perfiles" on public.profiles
  for delete to authenticated using (public.is_admin());

create policy "admin ve configuracion" on public.settings
  for select to authenticated using (public.is_admin());
create policy "admin edita configuracion" on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "staff ve tipo de cambio" on public.exchange_rates
  for select to authenticated using (public.is_staff());
create policy "admin gestiona tipo de cambio" on public.exchange_rates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "staff ve actividad" on public.activity_log
  for select to authenticated using (
    public.is_admin()
    or (public.is_staff() and entity_type not in ('invoices', 'quotes', 'expenses', 'recurring_fees'))
  );

create policy "notificaciones propias" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "marcar notificaciones propias" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "borrar notificaciones propias" on public.notifications
  for delete to authenticated using (user_id = auth.uid());
create policy "staff crea notificaciones" on public.notifications
  for insert to authenticated with check (public.is_staff());

-- ---------------- Clientes ----------------
create policy "staff ve clientes" on public.clients
  for select to authenticated using (public.is_staff() or id = public.current_client_id());
create policy "staff crea clientes" on public.clients
  for insert to authenticated with check (public.is_staff());
create policy "staff edita clientes" on public.clients
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "admin borra clientes" on public.clients
  for delete to authenticated using (public.is_admin());

create policy "staff gestiona servicios" on public.client_services
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "cliente ve sus servicios" on public.client_services
  for select to authenticated using (client_id = public.current_client_id());

create policy "staff gestiona brand kit" on public.client_assets
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "cliente ve su brand kit" on public.client_assets
  for select to authenticated using (client_id = public.current_client_id());

create policy "staff gestiona notas" on public.client_notes
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------------- Proyectos y tareas ----------------
create policy "staff gestiona plantillas" on public.project_templates
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff gestiona tareas de plantilla" on public.template_tasks
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "staff ve proyectos" on public.projects
  for select to authenticated using (public.is_staff());
create policy "staff crea proyectos" on public.projects
  for insert to authenticated with check (public.is_staff());
create policy "staff edita proyectos" on public.projects
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "admin borra proyectos" on public.projects
  for delete to authenticated using (public.is_admin());

create policy "staff gestiona tareas" on public.tasks
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff gestiona checklist" on public.task_checklist_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff gestiona comentarios" on public.task_comments
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff gestiona adjuntos" on public.task_attachments
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------------- Cuentas sociales y métricas ----------------
-- Las escrituras de métricas y tokens las hacen solo las Edge Functions (service role).
create policy "staff ve cuentas" on public.social_accounts
  for select to authenticated using (public.is_staff() or client_id = public.current_client_id());
create policy "admin gestiona cuentas" on public.social_accounts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "staff ve metricas de cuenta" on public.ig_metrics_daily
  for select to authenticated using (
    public.is_staff()
    or exists (select 1 from public.social_accounts s
               where s.id = social_account_id and s.client_id = public.current_client_id())
  );
create policy "staff ve metricas de posts" on public.ig_post_metrics
  for select to authenticated using (
    public.is_staff()
    or exists (select 1 from public.social_accounts s
               where s.id = social_account_id and s.client_id = public.current_client_id())
  );

-- ---------------- Contenidos ----------------
create policy "staff gestiona publicaciones" on public.content_posts
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "cliente ve sus publicaciones" on public.content_posts
  for select to authenticated using (
    client_id = public.current_client_id()
    and status in ('en_aprobacion', 'aprobado', 'programado', 'publicado')
    and deleted_at is null
  );

create policy "staff gestiona archivos de publicaciones" on public.content_media
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "cliente ve archivos de sus publicaciones" on public.content_media
  for select to authenticated using (
    exists (select 1 from public.content_posts p
            where p.id = post_id and p.client_id = public.current_client_id()
              and p.status in ('en_aprobacion', 'aprobado', 'programado', 'publicado'))
  );

-- El cliente sin login aprueba a través de una Edge Function (Fase 5).
create policy "staff gestiona aprobaciones" on public.approvals
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------------- Agenda ----------------
create policy "staff gestiona eventos" on public.events
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "cada uno ve su conexion de calendario" on public.calendar_connections
  for select to authenticated using (user_id = auth.uid());
create policy "cada uno borra su conexion de calendario" on public.calendar_connections
  for delete to authenticated using (user_id = auth.uid());

-- ---------------- Finanzas: solo admin ----------------
create policy "admin gestiona fees" on public.recurring_fees
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin gestiona presupuestos" on public.quotes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin gestiona items de presupuesto" on public.quote_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin gestiona cobros" on public.invoices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin gestiona items de cobro" on public.invoice_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin gestiona gastos" on public.expenses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------- Mensajes ----------------
create policy "staff gestiona conversaciones" on public.conversations
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff gestiona mensajes" on public.messages
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff gestiona respuestas rapidas" on public.quick_replies
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff ve plantillas de whatsapp" on public.whatsapp_templates
  for select to authenticated using (public.is_staff());
create policy "admin gestiona plantillas de whatsapp" on public.whatsapp_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- Vistas: ocultan montos al equipo (RLS filtra filas, no columnas)
-- security_invoker = true → la vista respeta el RLS de quien consulta
-- =====================================================================
create view public.clients_v with (security_invoker = true) as
  select id, name, brand_name, industry, email, whatsapp, instagram_handle,
         case when public.is_admin() then monthly_fee end as monthly_fee,
         currency, start_date, status, color_tag, created_by, created_at, updated_at, deleted_at
  from public.clients;

create view public.projects_v with (security_invoker = true) as
  select id, client_id, name, type, start_date, due_date,
         case when public.is_admin() then budget end as budget,
         currency, status, template_id, created_by, created_at, updated_at, deleted_at
  from public.projects;

-- Datos del estudio que puede ver todo el equipo (sin RUT ni razón social).
create view public.settings_public as
  select studio_name, logo_path, default_currency, theme_default
  from public.settings;

-- =====================================================================
-- Funciones para el frontend
-- =====================================================================

-- Fecha de "hoy" en Montevideo
create or replace function public.today_mvd()
returns date language sql stable as $$
  select (now() at time zone 'America/Montevideo')::date
$$;

-- Resumen del dashboard en una sola llamada. Corre con los permisos de
-- quien la llama (security invoker), así el equipo no recibe finanzas.
create or replace function public.dashboard_summary()
returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  d          date := public.today_mvd();
  day_start  timestamptz := (d::timestamp at time zone 'America/Montevideo');
  day_end    timestamptz := ((d + 1)::timestamp at time zone 'America/Montevideo');
  month_start date := date_trunc('month', d)::date;
  result     jsonb;
begin
  select jsonb_build_object(
    'today', d,
    'is_admin', public.is_admin(),
    'meetings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'title', e.title, 'type', e.type, 'starts_at', e.starts_at,
        'ends_at', e.ends_at, 'location', e.location, 'meet_url', e.meet_url,
        'client_name', c.brand_name) order by e.starts_at)
      from public.events e left join public.clients c on c.id = e.client_id
      where e.deleted_at is null and e.starts_at >= day_start and e.starts_at < day_end
    ), '[]'::jsonb),
    'posts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'caption', p.caption, 'format', p.format, 'status', p.status,
        'scheduled_at', p.scheduled_at, 'client_name', c.brand_name, 'color_tag', c.color_tag)
        order by p.scheduled_at)
      from public.content_posts p join public.clients c on c.id = p.client_id
      where p.deleted_at is null and p.scheduled_at >= day_start and p.scheduled_at < day_end
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(x.j order by x.due_date, x.prio desc) from (
        select t.due_date, array_position(enum_range(null::public.task_priority), t.priority) as prio,
          jsonb_build_object('id', t.id, 'title', t.title, 'due_date', t.due_date,
            'priority', t.priority, 'column', t."column", 'project_name', pr.name,
            'client_name', c.brand_name, 'assignee_name', pf.full_name,
            'overdue', t.due_date < d) as j
        from public.tasks t
        join public.projects pr on pr.id = t.project_id
        join public.clients c on c.id = pr.client_id
        left join public.profiles pf on pf.id = t.assignee_id
        where t.deleted_at is null and t."column" not in ('aprobado', 'entregado')
          and t.due_date is not null and t.due_date <= d + 2
        limit 12
      ) x
    ), '[]'::jsonb),
    'unread', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cv.id, 'channel', cv.channel, 'contact_name', coalesce(c.brand_name, cv.contact_name, cv.external_contact_id),
        'preview', cv.last_message_preview, 'unread_count', cv.unread_count,
        'last_message_at', cv.last_message_at, 'is_new_contact', cv.client_id is null)
        order by cv.last_message_at desc)
      from public.conversations cv left join public.clients c on c.id = cv.client_id
      where cv.status <> 'cerrada' and cv.unread_count > 0
    ), '[]'::jsonb),
    'kpis', jsonb_build_object(
      'active_projects', (select count(*) from public.projects
                          where status = 'activo' and deleted_at is null),
      'active_clients',  (select count(*) from public.clients
                          where status = 'activo' and deleted_at is null),
      'billed_month_uyu', case when public.is_admin() then (
          select coalesce(sum(total * fx_rate), 0) from public.invoices
          where deleted_at is null and status <> 'anulado'
            and issue_date >= month_start and issue_date <= d) end,
      'pending_uyu', case when public.is_admin() then (
          select coalesce(sum(total * fx_rate), 0) from public.invoices
          where deleted_at is null and status in ('pendiente', 'vencido')) end,
      'pending_count', case when public.is_admin() then (
          select count(*) from public.invoices
          where deleted_at is null and status in ('pendiente', 'vencido')) end,
      'overdue_count', case when public.is_admin() then (
          select count(*) from public.invoices
          where deleted_at is null and status = 'vencido') end,
      'followers', (
          select sum(m.followers) from public.social_accounts s
          join lateral (select followers from public.ig_metrics_daily
                        where social_account_id = s.id order by date desc limit 1) m on true
          where s.client_id is null and s.platform = 'instagram'),
      'followers_30d_ago', (
          select sum(m.followers) from public.social_accounts s
          join lateral (select followers from public.ig_metrics_daily
                        where social_account_id = s.id and date <= d - 30
                        order by date desc limit 1) m on true
          where s.client_id is null and s.platform = 'instagram')
    ),
    'account_alerts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'username', s.username, 'platform', s.platform, 'status', s.status,
        'client_name', c.brand_name, 'token_expires_at', s.token_expires_at))
      from public.social_accounts s left join public.clients c on c.id = s.client_id
      where s.status <> 'conectada'
    ), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(x.j order by x.created_at desc) from (
        select a.created_at, jsonb_build_object(
          'id', a.id, 'summary', a.summary, 'action', a.action, 'entity_type', a.entity_type,
          'entity_id', a.entity_id, 'created_at', a.created_at,
          'actor_name', pf.full_name, 'client_name', c.brand_name) as j
        from public.activity_log a
        left join public.profiles pf on pf.id = a.actor_id
        left join public.clients c on c.id = a.client_id
        order by a.created_at desc
        limit 15
      ) x
    ), '[]'::jsonb)
  ) into result;
  return result;
end $$;

-- Búsqueda global (Ctrl/Cmd + K). Respeta RLS.
create or replace function public.global_search(q text)
returns table (kind text, id uuid, title text, subtitle text, link text)
language sql stable security invoker set search_path = public as $$
  with term as (select '%' || replace(replace(trim(q), '%', ''), '_', '\_') || '%' as t)
  (select 'cliente', c.id, c.brand_name, coalesce(c.name, '') || coalesce(' · ' || c.industry, ''),
          '/clientes/' || c.id
   from public.clients c, term
   where c.deleted_at is null and (c.brand_name ilike term.t or c.name ilike term.t
         or c.instagram_handle ilike term.t or c.email ilike term.t)
   order by c.brand_name limit 6)
  union all
  (select 'proyecto', p.id, p.name, c.brand_name, '/proyectos/' || p.id
   from public.projects p join public.clients c on c.id = p.client_id, term
   where p.deleted_at is null and (p.name ilike term.t or c.brand_name ilike term.t)
   order by p.created_at desc limit 6)
  union all
  (select 'publicacion', p.id, left(coalesce(nullif(p.caption, ''), '(sin texto)'), 80), c.brand_name,
          '/contenidos?post=' || p.id
   from public.content_posts p join public.clients c on c.id = p.client_id, term
   where p.deleted_at is null and (p.caption ilike term.t or p.hashtags ilike term.t)
   order by p.scheduled_at desc nulls last limit 6)
$$;

-- Marcar todas mis notificaciones como leídas
create or replace function public.mark_all_notifications_read()
returns void language sql security invoker set search_path = public as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null
$$;

-- Tipo de cambio vigente para una fecha (el último cargado hasta ese día)
create or replace function public.fx_rate_for(p_date date default public.today_mvd())
returns numeric language sql stable security invoker set search_path = public as $$
  select usd_to_uyu from public.exchange_rates where date <= p_date order by date desc limit 1
$$;

-- ---------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------
revoke execute on function public.dashboard_summary() from anon, public;
revoke execute on function public.global_search(text) from anon, public;
revoke execute on function public.mark_all_notifications_read() from anon, public;
grant execute on function public.dashboard_summary() to authenticated;
grant execute on function public.global_search(text) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.fx_rate_for(date) to authenticated;
grant select on public.clients_v, public.projects_v, public.settings_public to authenticated;
revoke all on public.clients_v, public.projects_v, public.settings_public from anon;

-- ---------------------------------------------------------------------
-- Realtime: notificaciones y mensajes en vivo
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications, public.messages, public.conversations;
  end if;
end $$;
