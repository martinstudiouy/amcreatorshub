-- =====================================================================
-- Fase 7: bandeja unificada (WhatsApp Business Cloud API + mensajes directos de Instagram)
-- Webhook de Meta → Edge Function → ingest_message() → tablas → Supabase Realtime
-- =====================================================================

alter table public.conversations
  add column if not exists contact_username text,   -- @usuario de Instagram
  add column if not exists contact_avatar   text;

alter table public.messages
  add column if not exists media_mime text,
  add column if not exists file_name  text;

create index if not exists conversations_status_idx on public.conversations (status, last_message_at desc);
create index if not exists messages_conversation_idx on public.messages (conversation_id, sent_at desc);

-- Archivos que llegan por WhatsApp o Instagram (fotos, audios, documentos)
insert into storage.buckets (id, name, public, file_size_limit)
values ('messages', 'messages', false, 104857600)
on conflict (id) do nothing;
drop policy if exists "staff lee archivos de mensajes" on storage.objects;
create policy "staff lee archivos de mensajes" on storage.objects
  for select to authenticated using (bucket_id = 'messages' and public.is_staff());

-- Solo dígitos, para comparar teléfonos escritos de cualquier forma
create or replace function public.phone_digits(p text)
returns text language sql immutable as $$ select regexp_replace(coalesce(p, ''), '\D', '', 'g') $$;

-- ¿Qué cliente es este contacto? WhatsApp: mismo número (los últimos 8 dígitos). Instagram: mismo usuario.
create or replace function public.match_client(p_channel public.channel_type, p_contact text, p_username text default null)
returns uuid language sql stable security definer set search_path = public as $$
  select c.id from public.clients c
  where c.deleted_at is null
    and (
      (p_channel = 'whatsapp' and length(public.phone_digits(c.whatsapp)) >= 8
        and right(public.phone_digits(c.whatsapp), 8) = right(public.phone_digits(p_contact), 8))
      or (p_channel = 'instagram' and p_username is not null
        and lower(trim(leading '@' from coalesce(c.instagram_handle, ''))) = lower(trim(leading '@' from p_username)))
    )
  order by (c.status = 'activo') desc, c.created_at
  limit 1
$$;

-- ---------------------------------------------------------------------
-- Guarda un mensaje (entrante o saliente) y actualiza la conversación. Solo service_role.
-- ---------------------------------------------------------------------
create or replace function public.ingest_message(
  p_channel public.channel_type, p_account_id uuid, p_contact text, p_contact_name text, p_username text,
  p_direction public.message_direction, p_external_id text, p_type public.message_type, p_body text,
  p_media_path text, p_media_mime text, p_file_name text, p_template text, p_sent_at timestamptz,
  p_sent_by uuid default null, p_avatar text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_conv uuid;
  v_msg  uuid;
  v_preview text := coalesce(nullif(left(p_body, 140), ''),
                             case p_type when 'imagen' then 'Foto' when 'video' then 'Video' when 'audio' then 'Audio'
                                         when 'documento' then 'Documento: ' || coalesce(p_file_name, 'archivo')
                                         when 'plantilla' then 'Plantilla: ' || coalesce(p_template, '') else 'Mensaje' end);
begin
  -- Mensaje repetido (Meta reintenta los webhooks)
  if p_external_id is not null and exists (select 1 from public.messages where external_message_id = p_external_id) then
    return (select conversation_id from public.messages where external_message_id = p_external_id);
  end if;

  select id into v_conv from public.conversations
  where channel = p_channel and external_contact_id = p_contact and social_account_id is not distinct from p_account_id
  for update;

  if v_conv is null then
    insert into public.conversations (channel, external_contact_id, contact_name, contact_username, contact_avatar, social_account_id, client_id, labels)
    values (p_channel, p_contact, p_contact_name, p_username, p_avatar, p_account_id,
            public.match_client(p_channel, p_contact, p_username),
            case when public.match_client(p_channel, p_contact, p_username) is null then '{}'::text[] else array['cliente'] end)
    returning id into v_conv;
  else
    update public.conversations
    set contact_name = coalesce(p_contact_name, contact_name),
        contact_username = coalesce(p_username, contact_username),
        contact_avatar = coalesce(p_avatar, contact_avatar),
        client_id = coalesce(client_id, public.match_client(p_channel, p_contact, coalesce(p_username, contact_username)))
    where id = v_conv;
  end if;

  insert into public.messages (conversation_id, direction, external_message_id, type, body, media_path, media_mime, file_name,
                               template_name, sent_by, delivery_status, sent_at)
  values (v_conv, p_direction, p_external_id, p_type, p_body, p_media_path, p_media_mime, p_file_name,
          p_template, p_sent_by, case when p_direction = 'saliente' then 'enviado'::public.delivery_status end, coalesce(p_sent_at, now()))
  returning id into v_msg;

  update public.conversations
  set last_message_at = greatest(coalesce(last_message_at, '-infinity'), coalesce(p_sent_at, now())),
      last_message_preview = case when p_direction = 'saliente' then 'Vos: ' || v_preview else v_preview end,
      last_inbound_at = case when p_direction = 'entrante' then greatest(coalesce(last_inbound_at, '-infinity'), coalesce(p_sent_at, now())) else last_inbound_at end,
      unread_count = case when p_direction = 'entrante' then unread_count + 1 else 0 end,
      -- Si el cliente escribe en una conversación cerrada, se vuelve a abrir
      status = case when p_direction = 'entrante' and status = 'cerrada' then 'abierta'::public.conversation_status else status end
  where id = v_conv;

  return v_conv;
end $$;

-- Estado de entrega (enviado → entregado → leído, o falló)
create or replace function public.update_message_status(p_external_id text, p_status public.delivery_status, p_error text default null)
returns void language sql security definer set search_path = public as $$
  update public.messages
  set delivery_status = case
        when delivery_status = 'leido' then delivery_status
        when delivery_status = 'entregado' and p_status = 'enviado' then delivery_status
        else p_status end,
      error_message = coalesce(p_error, error_message)
  where external_message_id = p_external_id
$$;

-- Marcar como leída (desde la bandeja)
create or replace function public.mark_conversation_read(p_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.conversations set unread_count = 0 where id = p_id and public.is_staff()
$$;

-- ---------------------------------------------------------------------
-- Recordatorios por WhatsApp de la agenda (24 h antes)
-- Toma los eventos que corresponden y los marca para no mandar dos veces.
-- ---------------------------------------------------------------------
create or replace function public.claim_whatsapp_reminders()
returns table (event_id uuid, title text, starts_at timestamptz, location text, meet_url text, client_name text, whatsapp text, client_id uuid)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with due as (
    update public.events e
    set whatsapp_reminder_sent_at = now()
    where e.id in (
      select ev.id from public.events ev
      join public.clients c on c.id = ev.client_id
      where ev.deleted_at is null and ev.whatsapp_reminder and ev.whatsapp_reminder_sent_at is null
        and ev.starts_at > now() + interval '1 hour' and ev.starts_at <= now() + interval '24 hours'
        and length(public.phone_digits(c.whatsapp)) >= 8
      for update of ev skip locked)
    returning e.id, e.title, e.starts_at, e.location, e.meet_url, e.client_id)
  select d.id, d.title, d.starts_at, d.location, d.meet_url, coalesce(c.name, c.brand_name), c.whatsapp, d.client_id
  from due d join public.clients c on c.id = d.client_id;
end $$;

-- Cron cada 10 minutos (usa la URL del proyecto y la clave guardadas en Vault)
create or replace function public.setup_messages_cron()
returns void language plpgsql security definer set search_path = public, vault as $$
begin
  if not exists (select 1 from vault.secrets where name = 'amc_project_url') then
    return;
  end if;
  perform cron.unschedule('whatsapp-recordatorios') where exists (select 1 from cron.job where jobname = 'whatsapp-recordatorios');
  perform cron.schedule('whatsapp-recordatorios', '*/10 * * * *', $cron$
    select net.http_post(
      url     := (select decrypted_secret from vault.decrypted_secrets where name = 'amc_project_url') || '/functions/v1/messages',
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'amc_cron_secret')),
      body    := '{"action":"reminders"}'::jsonb
    )
    where exists (select 1 from public.events e join public.clients c on c.id = e.client_id
                  where e.deleted_at is null and e.whatsapp_reminder and e.whatsapp_reminder_sent_at is null
                    and e.starts_at > now() + interval '1 hour' and e.starts_at <= now() + interval '24 hours')
  $cron$);
end $$;
select public.setup_messages_cron();

-- Plantillas: la sincronización desde Meta actualiza por nombre + idioma
alter table public.whatsapp_templates add column if not exists meta_id text;

revoke execute on function public.ingest_message(public.channel_type, uuid, text, text, text, public.message_direction, text, public.message_type, text, text, text, text, text, timestamptz, uuid, text) from public, anon, authenticated;
revoke execute on function public.update_message_status(text, public.delivery_status, text) from public, anon, authenticated;
revoke execute on function public.claim_whatsapp_reminders() from public, anon, authenticated;
revoke execute on function public.setup_messages_cron() from public, anon, authenticated;
revoke execute on function public.match_client(public.channel_type, text, text) from public, anon;
revoke execute on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.ingest_message(public.channel_type, uuid, text, text, text, public.message_direction, text, public.message_type, text, text, text, text, text, timestamptz, uuid, text) to service_role;
grant execute on function public.update_message_status(text, public.delivery_status, text) to service_role;
grant execute on function public.claim_whatsapp_reminders() to service_role;
grant execute on function public.setup_messages_cron() to service_role;
grant execute on function public.match_client(public.channel_type, text, text) to authenticated, service_role;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
