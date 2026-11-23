-- =====================================================================
-- Fase 6: Instagram (Business Login for Instagram)
--   · Cuentas conectadas por OAuth, token largo (60 días) en Vault
--   · Publicación automática de lo "Programado" (cron cada minuto)
--   · Métricas diarias de cuenta y de publicaciones (cron diario)
-- =====================================================================

alter table public.social_accounts
  add column if not exists profile_picture_url text,
  add column if not exists followers_count     integer,
  add column if not exists last_synced_at      timestamptz,
  add column if not exists token_refreshed_at  timestamptz;

alter table public.content_posts
  add column if not exists ig_container          jsonb,        -- contenedores creados en Instagram mientras se procesan
  add column if not exists publishing_started_at timestamptz;  -- candado para no publicar dos veces

alter table public.ig_metrics_daily
  add column if not exists accounts_engaged integer;

alter table public.ig_post_metrics
  add column if not exists interactions       integer,
  add column if not exists media_product_type text,
  add column if not exists thumbnail_url      text;

create index if not exists ig_metrics_daily_account_date_idx on public.ig_metrics_daily (social_account_id, date desc);
create index if not exists ig_post_metrics_account_idx on public.ig_post_metrics (social_account_id, posted_at desc, snapshot_date desc);
create index if not exists content_posts_publish_queue_idx on public.content_posts (scheduled_at) where status = 'programado' and deleted_at is null;

-- ---------------------------------------------------------------------
-- Guardar / leer / borrar el token (solo service_role, desde las Edge Functions)
-- ---------------------------------------------------------------------
create or replace function public.save_instagram_account(
  p_client_id uuid, p_external_id text, p_username text, p_name text, p_account_type text,
  p_token text, p_expires_at timestamptz, p_scopes text[], p_picture text, p_followers integer, p_user uuid)
returns uuid language plpgsql security definer set search_path = public, vault as $$
declare
  v_id     uuid;
  v_secret uuid;
begin
  select id, vault_secret_id into v_id, v_secret
  from public.social_accounts where platform = 'instagram' and external_id = p_external_id;

  if v_secret is not null and exists (select 1 from vault.secrets where id = v_secret) then
    perform vault.update_secret(v_secret, p_token);
  else
    v_secret := vault.create_secret(p_token, 'ig_token_' || p_external_id || '_' || extract(epoch from now())::bigint,
                                    'Token de Instagram (AM Creators Hub)');
  end if;

  insert into public.social_accounts (client_id, platform, external_id, username, display_name, account_type,
                                      vault_secret_id, token_expires_at, token_refreshed_at, scopes, status, last_error,
                                      connected_by, profile_picture_url, followers_count)
  values (p_client_id, 'instagram', p_external_id, p_username, p_name,
          case when lower(p_account_type) like 'creator%' or lower(p_account_type) = 'media_creator' then 'creator'::public.ig_account_type
               else 'business'::public.ig_account_type end,
          v_secret, p_expires_at, now(), coalesce(p_scopes, '{}'), 'conectada', null, p_user, p_picture, p_followers)
  on conflict (platform, external_id) do update
    set client_id = coalesce(excluded.client_id, public.social_accounts.client_id),
        username = excluded.username, display_name = excluded.display_name, account_type = excluded.account_type,
        vault_secret_id = excluded.vault_secret_id, token_expires_at = excluded.token_expires_at,
        token_refreshed_at = now(), scopes = excluded.scopes, status = 'conectada', last_error = null,
        connected_by = excluded.connected_by, profile_picture_url = excluded.profile_picture_url,
        followers_count = excluded.followers_count
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.get_social_token(p_account_id uuid)
returns text language sql stable security definer set search_path = public, vault as $$
  select s.decrypted_secret
  from public.social_accounts a
  join vault.decrypted_secrets s on s.id = a.vault_secret_id
  where a.id = p_account_id
$$;

create or replace function public.update_social_token(p_account_id uuid, p_token text, p_expires_at timestamptz)
returns void language plpgsql security definer set search_path = public, vault as $$
declare v_secret uuid;
begin
  select vault_secret_id into v_secret from public.social_accounts where id = p_account_id;
  if v_secret is null then
    raise exception 'La cuenta no tiene token guardado.';
  end if;
  perform vault.update_secret(v_secret, p_token);
  update public.social_accounts
  set token_expires_at = p_expires_at, token_refreshed_at = now(), status = 'conectada', last_error = null
  where id = p_account_id;
end $$;

-- Desconectar: se borra el token pero se conserva la cuenta y su historial de métricas
create or replace function public.disconnect_social_account(p_account_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public, vault as $$
declare v_secret uuid;
begin
  select vault_secret_id into v_secret from public.social_accounts where id = p_account_id;
  update public.social_accounts
  set status = 'desconectada', vault_secret_id = null, token_expires_at = null, last_error = p_reason
  where id = p_account_id;
  if v_secret is not null then
    delete from vault.secrets where id = v_secret;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Cola de publicación: toma hasta 5 publicaciones vencidas, sin pisarse
-- con otra ejecución del cron (el candado dura 3 minutos)
-- ---------------------------------------------------------------------
create or replace function public.claim_posts_to_publish(p_post_id uuid default null)
returns setof public.content_posts language plpgsql security definer set search_path = public as $$
begin
  return query
  update public.content_posts p
  set publishing_started_at = now()
  where p.id in (
    select id from public.content_posts
    where deleted_at is null
      and status = 'programado'
      and (p_post_id is not null and id = p_post_id
           or p_post_id is null and scheduled_at <= now())
      and (publishing_started_at is null or publishing_started_at < now() - interval '3 minutes')
    order by scheduled_at
    limit 5
    for update skip locked)
  returning p.*;
end $$;

-- ---------------------------------------------------------------------
-- Crons: publicar cada minuto y métricas una vez por día (06:10 de Montevideo)
-- Usa la URL del proyecto y la clave interna guardadas en Vault.
-- ---------------------------------------------------------------------
create or replace function public.setup_instagram_crons(p_project_url text default null)
returns void language plpgsql security definer set search_path = public, vault, extensions as $$
begin
  if not exists (select 1 from vault.secrets where name = 'amc_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'amc_cron_secret', 'Clave interna del cron de AM Creators Hub');
  end if;
  if p_project_url is not null then
    if exists (select 1 from vault.secrets where name = 'amc_project_url') then
      perform vault.update_secret((select id from vault.secrets where name = 'amc_project_url'), p_project_url);
    else
      perform vault.create_secret(p_project_url, 'amc_project_url', 'URL del proyecto de Supabase');
    end if;
  end if;
  if not exists (select 1 from vault.secrets where name = 'amc_project_url') then
    return;
  end if;

  perform cron.unschedule('instagram-publicar') where exists (select 1 from cron.job where jobname = 'instagram-publicar');
  perform cron.schedule('instagram-publicar', '* * * * *', $cron$
    select net.http_post(
      url     := (select decrypted_secret from vault.decrypted_secrets where name = 'amc_project_url') || '/functions/v1/instagram-publish',
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'amc_cron_secret')),
      body    := '{}'::jsonb,
      timeout_milliseconds := 58000
    )
    where exists (select 1 from public.content_posts
                  where status = 'programado' and deleted_at is null and scheduled_at <= now())
  $cron$);

  perform cron.unschedule('instagram-metricas') where exists (select 1 from cron.job where jobname = 'instagram-metricas');
  perform cron.schedule('instagram-metricas', '10 9 * * *', $cron$
    select net.http_post(
      url     := (select decrypted_secret from vault.decrypted_secrets where name = 'amc_project_url') || '/functions/v1/instagram-sync',
      headers := jsonb_build_object('Content-Type', 'application/json',
                                    'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'amc_cron_secret')),
      body    := '{}'::jsonb,
      timeout_milliseconds := 120000
    )
  $cron$);
end $$;

-- Si Google ya guardó la URL del proyecto, los crons quedan activos desde ahora
select public.setup_instagram_crons();

revoke execute on function public.save_instagram_account(uuid, text, text, text, text, text, timestamptz, text[], text, integer, uuid) from public, anon, authenticated;
revoke execute on function public.get_social_token(uuid) from public, anon, authenticated;
revoke execute on function public.update_social_token(uuid, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.disconnect_social_account(uuid, text) from public, anon, authenticated;
revoke execute on function public.claim_posts_to_publish(uuid) from public, anon, authenticated;
revoke execute on function public.setup_instagram_crons(text) from public, anon, authenticated;
grant execute on function public.save_instagram_account(uuid, text, text, text, text, text, timestamptz, text[], text, integer, uuid) to service_role;
grant execute on function public.get_social_token(uuid) to service_role;
grant execute on function public.update_social_token(uuid, text, timestamptz) to service_role;
grant execute on function public.disconnect_social_account(uuid, text) to service_role;
grant execute on function public.claim_posts_to_publish(uuid) to service_role;
grant execute on function public.setup_instagram_crons(text) to service_role;
