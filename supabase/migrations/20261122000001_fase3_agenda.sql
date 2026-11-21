-- =====================================================================
-- AM Creators Hub — Fase 3: agenda, recordatorios y Google Calendar
-- No crea tablas nuevas (siguen siendo 34): agrega columnas, triggers,
-- funciones para guardar tokens en Vault y tareas programadas (cron).
-- =====================================================================

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------------
-- Columnas nuevas
-- ---------------------------------------------------------------------
alter table public.events
  add column if not exists create_meet      boolean not null default false,  -- pedir link de Meet a Google
  add column if not exists reminder_sent_at timestamptz,                      -- recordatorio interno ya enviado
  add column if not exists source           text not null default 'crm'
                                            check (source in ('crm', 'google'));

alter table public.calendar_connections
  add column if not exists last_error text;

create index if not exists events_sync_pending_idx on public.events (sync_status) where sync_status = 'pendiente';
create unique index if not exists events_google_event_id_key on public.events (google_event_id) where google_event_id is not null;

-- ---------------------------------------------------------------------
-- Cada cambio hecho desde el CRM queda "pendiente" de subir a Google.
-- Si quien escribe ya fija sync_status (la sincronización), se respeta.
-- ---------------------------------------------------------------------
create or replace function public.events_mark_pending()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.sync_status = 'local' then new.sync_status := 'pendiente'; end if;
    return new;
  end if;
  if new.sync_status is distinct from old.sync_status then
    return new;   -- lo fijó la sincronización: no tocar
  end if;
  if (new.title, new.starts_at, new.ends_at, new.all_day, new.location, new.meet_url, new.notes,
      new.deleted_at, new.create_meet, new.type, new.client_id)
     is distinct from
     (old.title, old.starts_at, old.ends_at, old.all_day, old.location, old.meet_url, old.notes,
      old.deleted_at, old.create_meet, old.type, old.client_id) then
    new.sync_status := 'pendiente';
  end if;
  -- Si cambia la hora, el recordatorio se vuelve a mandar
  if new.starts_at is distinct from old.starts_at or new.remind_minutes_before is distinct from old.remind_minutes_before then
    new.reminder_sent_at := null;
  end if;
  return new;
end $$;

create trigger events_mark_pending before insert or update on public.events
  for each row execute function public.events_mark_pending();

-- ---------------------------------------------------------------------
-- Vista para la agenda (respeta RLS)
-- ---------------------------------------------------------------------
create view public.events_overview with (security_invoker = true) as
  select e.*,
         c.brand_name as client_name,
         c.color_tag  as client_color,
         pf.full_name as created_by_name
  from public.events e
  left join public.clients c on c.id = e.client_id
  left join public.profiles pf on pf.id = e.created_by;

grant select on public.events_overview to authenticated;
revoke all on public.events_overview from anon;

-- ---------------------------------------------------------------------
-- Recordatorios internos: avisan a los participantes (y a quien creó
-- el evento) X minutos antes. Corre cada minuto con pg_cron.
-- ---------------------------------------------------------------------
create or replace function public.send_event_reminders()
returns integer language plpgsql security definer set search_path = public as $$
declare
  ev  record;
  uid uuid;
  n   integer := 0;
begin
  for ev in
    select * from public.events
    where deleted_at is null
      and reminder_sent_at is null
      and remind_minutes_before is not null
      and starts_at - make_interval(mins => remind_minutes_before) <= now()
      and starts_at > now() - interval '10 minutes'
    for update skip locked
  loop
    for uid in
      select distinct u from unnest(array_append(ev.attendee_ids, ev.created_by)) as u
      where u is not null
        and exists (select 1 from public.profiles p where p.id = u and p.is_active and p.role <> 'cliente')
    loop
      insert into public.notifications (user_id, type, title, body, link)
      values (uid, 'recordatorio',
              case when ev.all_day then 'Hoy: ' || ev.title
                   else 'A las ' || to_char(ev.starts_at at time zone 'America/Montevideo', 'HH24:MI') || ': ' || ev.title end,
              coalesce(ev.location, ev.meet_url),
              '/agenda?evento=' || ev.id);
      n := n + 1;
    end loop;
    update public.events set reminder_sent_at = now() where id = ev.id;
  end loop;
  return n;
end $$;

revoke execute on function public.send_event_reminders() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('recordatorios-agenda') where exists (select 1 from cron.job where jobname = 'recordatorios-agenda');
  perform cron.schedule('recordatorios-agenda', '* * * * *', 'select public.send_event_reminders()');
end $$;

-- ---------------------------------------------------------------------
-- Google Calendar: tokens en Supabase Vault (nunca en tablas legibles).
-- Estas funciones solo las puede usar el servidor (service_role).
-- ---------------------------------------------------------------------

-- Guarda (o reemplaza) la conexión y su refresh token
create or replace function public.save_google_connection(p_user_id uuid, p_email text, p_refresh_token text, p_calendar_id text default 'primary')
returns uuid language plpgsql security definer set search_path = public, vault as $$
declare
  v_conn   uuid;
  v_secret uuid;
begin
  select id, vault_secret_id into v_conn, v_secret
  from public.calendar_connections where user_id = p_user_id and calendar_id = p_calendar_id;

  if v_secret is not null then
    perform vault.update_secret(v_secret, p_refresh_token);
  else
    v_secret := vault.create_secret(p_refresh_token, 'google_refresh_' || p_user_id || '_' || extract(epoch from now())::bigint,
                                    'Refresh token de Google Calendar (AM Creators Hub)');
  end if;

  insert into public.calendar_connections (user_id, google_email, calendar_id, vault_secret_id, status, sync_token, last_error)
  values (p_user_id, p_email, p_calendar_id, v_secret, 'conectado', null, null)
  on conflict (user_id, calendar_id) do update
    set google_email = excluded.google_email, vault_secret_id = excluded.vault_secret_id,
        status = 'conectado', sync_token = null, last_error = null
  returning id into v_conn;
  return v_conn;
end $$;

-- Lee el refresh token de la conexión del estudio
create or replace function public.get_google_refresh_token(p_connection_id uuid)
returns text language sql stable security definer set search_path = public, vault as $$
  select s.decrypted_secret
  from public.calendar_connections c
  join vault.decrypted_secrets s on s.id = c.vault_secret_id
  where c.id = p_connection_id
$$;

-- Borra la conexión y su token
create or replace function public.delete_google_connection(p_connection_id uuid)
returns void language plpgsql security definer set search_path = public, vault as $$
declare v_secret uuid;
begin
  select vault_secret_id into v_secret from public.calendar_connections where id = p_connection_id;
  delete from public.calendar_connections where id = p_connection_id;
  if v_secret is not null then
    delete from vault.secrets where id = v_secret;
  end if;
  -- Los eventos quedan en el CRM, desvinculados de Google
  update public.events set google_event_id = null, google_etag = null, sync_status = 'local'
  where google_event_id is not null or sync_status = 'pendiente';
end $$;

-- Secreto para que solo el cron pueda llamar a la sincronización
create or replace function public.get_cron_secret()
returns text language sql stable security definer set search_path = public, vault as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'amc_cron_secret' limit 1
$$;

-- Programa la sincronización con Google cada 5 minutos. La llama la Edge
-- Function al conectar, porque es la que conoce la URL del proyecto.
create or replace function public.setup_google_sync_cron(p_project_url text)
returns void language plpgsql security definer set search_path = public, vault, extensions as $$
begin
  if not exists (select 1 from vault.secrets where name = 'amc_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'amc_cron_secret', 'Clave interna del cron de AM Creators Hub');
  end if;
  if exists (select 1 from vault.secrets where name = 'amc_project_url') then
    perform vault.update_secret((select id from vault.secrets where name = 'amc_project_url'), p_project_url);
  else
    perform vault.create_secret(p_project_url, 'amc_project_url', 'URL del proyecto de Supabase');
  end if;

  perform cron.unschedule('google-calendar-sync') where exists (select 1 from cron.job where jobname = 'google-calendar-sync');
  perform cron.schedule('google-calendar-sync', '*/5 * * * *', $cron$
    select net.http_post(
      url     := (select decrypted_secret from vault.decrypted_secrets where name = 'amc_project_url') || '/functions/v1/google-sync',
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'amc_cron_secret')),
      body    := '{}'::jsonb,
      timeout_milliseconds := 55000
    )
  $cron$);
end $$;

revoke execute on function public.save_google_connection(uuid, text, text, text) from public, anon, authenticated;
revoke execute on function public.get_google_refresh_token(uuid) from public, anon, authenticated;
revoke execute on function public.delete_google_connection(uuid) from public, anon, authenticated;
revoke execute on function public.get_cron_secret() from public, anon, authenticated;
revoke execute on function public.setup_google_sync_cron(text) from public, anon, authenticated;
grant execute on function public.save_google_connection(uuid, text, text, text) to service_role;
grant execute on function public.get_google_refresh_token(uuid) to service_role;
grant execute on function public.delete_google_connection(uuid) to service_role;
grant execute on function public.get_cron_secret() to service_role;
grant execute on function public.setup_google_sync_cron(text) to service_role;

-- ---------------------------------------------------------------------
-- Estado de la conexión, visible para todo el equipo (sin tokens)
-- ---------------------------------------------------------------------
create or replace function public.google_sync_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.is_staff() then null else coalesce((
    select jsonb_build_object(
      'connected', true,
      'email', c.google_email,
      'status', c.status,
      'last_synced_at', c.last_synced_at,
      'last_error', c.last_error,
      'is_mine', c.user_id = auth.uid(),
      'pending', (select count(*) from public.events where sync_status = 'pendiente'))
    from public.calendar_connections c
    order by c.created_at
    limit 1
  ), jsonb_build_object('connected', false)) end
$$;

revoke execute on function public.google_sync_status() from public, anon;
grant execute on function public.google_sync_status() to authenticated;
