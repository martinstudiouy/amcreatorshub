-- =====================================================================
-- Fase 5: Calendario de contenidos y aprobación del cliente sin login
-- =====================================================================
-- El cliente recibe un link con un token único. En la base solo se guarda
-- el sha256 del token. Las funciones approval_payload y approval_submit las
-- usa únicamente la Edge Function "approval" (service_role), que además arma
-- links temporales a los archivos.

create index if not exists content_posts_scheduled_idx on public.content_posts (scheduled_at) where deleted_at is null;
create index if not exists content_posts_client_idx on public.content_posts (client_id) where deleted_at is null;
create index if not exists content_media_post_idx on public.content_media (post_id, position);
create index if not exists approvals_posts_idx on public.approvals using gin (post_ids);

-- ---------------------------------------------------------------------
-- Crear un pedido de aprobación (equipo o admin). Devuelve el token en claro
-- una sola vez; después no se puede recuperar.
-- ---------------------------------------------------------------------
create or replace function public.create_approval(p_client_id uuid, p_post_ids uuid[])
returns text language plpgsql security definer set search_path = public as $$
declare
  token text;
  valid uuid[];
begin
  if not public.is_staff() then
    raise exception 'No tenés permiso para pedir aprobaciones.';
  end if;
  if p_post_ids is null or cardinality(p_post_ids) = 0 then
    raise exception 'Elegí al menos una publicación.';
  end if;

  select array_agg(id order by scheduled_at nulls last, created_at) into valid
  from public.content_posts
  where id = any (p_post_ids) and client_id = p_client_id and deleted_at is null;

  if valid is null or cardinality(valid) <> cardinality(p_post_ids) then
    raise exception 'Todas las publicaciones tienen que ser del mismo cliente.';
  end if;

  token := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.approvals (client_id, token_hash, post_ids, created_by)
  values (p_client_id, encode(extensions.digest(token, 'sha256'), 'hex'), valid, auth.uid());

  update public.content_posts set status = 'en_aprobacion'
  where id = any (valid) and status in ('idea', 'borrador', 'en_aprobacion');

  return token;
end $$;

-- ---------------------------------------------------------------------
-- Lo que ve el cliente al abrir el link (solo service_role)
-- ---------------------------------------------------------------------
create or replace function public.approval_payload(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.approvals;
  result jsonb;
begin
  select * into a from public.approvals
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if not found then
    return jsonb_build_object('error', 'no_existe');
  end if;
  if a.decided_at is null and a.expires_at < now() then
    return jsonb_build_object('error', 'vencido');
  end if;

  select jsonb_build_object(
    'id', a.id,
    'studio_name', (select studio_name from public.settings where id = true),
    'client', jsonb_build_object('brand_name', c.brand_name, 'color_tag', c.color_tag, 'instagram_handle', c.instagram_handle),
    'expires_at', a.expires_at,
    'decided_at', a.decided_at,
    'decisions', a.decisions,
    'client_comment', a.client_comment,
    'posts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'format', p.format, 'scheduled_at', p.scheduled_at,
        'caption', p.caption, 'hashtags', p.hashtags,
        'media', coalesce((
          select jsonb_agg(jsonb_build_object('storage_path', m.storage_path, 'media_type', m.media_type,
                                              'cover_path', m.cover_path, 'width', m.width, 'height', m.height)
                           order by m.position)
          from public.content_media m where m.post_id = p.id), '[]'::jsonb)
      ) order by array_position(a.post_ids, p.id))
      from public.content_posts p
      where p.id = any (a.post_ids) and p.deleted_at is null), '[]'::jsonb)
  ) into result
  from public.clients c where c.id = a.client_id;

  return result;
end $$;

-- ---------------------------------------------------------------------
-- El cliente responde: aprobado o cambios por publicación (solo service_role)
-- p_decisions = { "<post_id>": { "decision": "aprobado" | "cambios", "comment": "..." } }
-- ---------------------------------------------------------------------
create or replace function public.approval_submit(p_token text, p_decisions jsonb, p_comment text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a public.approvals;
  pid uuid;
  d jsonb;
  n_ok int := 0;
  n_changes int := 0;
  brand text;
  staff record;
begin
  select * into a from public.approvals
  where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex')
  for update;
  if not found then
    raise exception 'Este link no existe.';
  end if;
  if a.decided_at is not null then
    raise exception 'Este contenido ya fue respondido. ¡Gracias!';
  end if;
  if a.expires_at < now() then
    raise exception 'Este link venció. Pedile uno nuevo al estudio.';
  end if;

  foreach pid in array a.post_ids loop
    -- Las publicaciones borradas después de enviar el link se ignoran
    continue when not exists (select 1 from public.content_posts where id = pid and deleted_at is null);
    d := p_decisions -> pid::text;
    if d is null or d ->> 'decision' not in ('aprobado', 'cambios') then
      raise exception 'Falta responder alguna publicación.';
    end if;
    if d ->> 'decision' = 'cambios' and coalesce(trim(d ->> 'comment'), '') = '' then
      raise exception 'Contanos qué cambiarías en cada publicación con cambios.';
    end if;
    if d ->> 'decision' = 'aprobado' then
      n_ok := n_ok + 1;
      update public.content_posts set status = 'aprobado'
      where id = pid and status in ('idea', 'borrador', 'en_aprobacion');
    else
      n_changes := n_changes + 1;
      update public.content_posts set status = 'borrador'
      where id = pid and status in ('idea', 'borrador', 'en_aprobacion', 'aprobado');
    end if;
  end loop;

  update public.approvals
  set decisions = coalesce(p_decisions, '{}'::jsonb), client_comment = nullif(trim(p_comment), ''), decided_at = now()
  where id = a.id;

  select brand_name into brand from public.clients where id = a.client_id;
  for staff in select id from public.profiles where role in ('admin', 'equipo') and is_active loop
    insert into public.notifications (user_id, type, title, body, link)
    values (staff.id, 'aprobacion',
            brand || case when n_changes = 0 then ' aprobó todo el contenido'
                          when n_ok = 0 then ' pidió cambios en el contenido'
                          else ' respondió el contenido' end,
            n_ok || ' aprobada' || case when n_ok = 1 then '' else 's' end || ', ' ||
              n_changes || ' con cambios' || coalesce(' · "' || left(nullif(trim(p_comment), ''), 100) || '"', ''),
            '/contenidos?vista=lista&cliente=' || a.client_id);
  end loop;

  return jsonb_build_object('approved', n_ok, 'changes', n_changes);
end $$;

revoke execute on function public.create_approval(uuid, uuid[]) from public, anon;
grant execute on function public.create_approval(uuid, uuid[]) to authenticated;
revoke execute on function public.approval_payload(text) from public, anon, authenticated;
revoke execute on function public.approval_submit(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.approval_payload(text) to service_role;
grant execute on function public.approval_submit(text, jsonb, text) to service_role;
