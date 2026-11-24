-- =====================================================================
-- Fase 8: portal del cliente
-- El cliente entra con su usuario (rol "cliente"), ve el contenido de su marca
-- que ya pasó por el estudio (en aprobación, aprobado, programado, publicado),
-- sus métricas y reportes, y aprueba o pide cambios desde ahí.
-- =====================================================================

-- Aprobar o pedir cambios en una publicación, desde el portal
create or replace function public.portal_decide_post(p_post_id uuid, p_decision text, p_comment text default null)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_client uuid := public.current_client_id();
  v_post   public.content_posts;
  v_brand  text;
  v_name   text;
  staff    record;
begin
  if v_client is null then
    raise exception 'Solo un cliente puede responder desde el portal.';
  end if;
  if p_decision not in ('aprobado', 'cambios') then
    raise exception 'Respuesta inválida.';
  end if;
  if p_decision = 'cambios' and coalesce(trim(p_comment), '') = '' then
    raise exception 'Contanos qué cambiarías.';
  end if;

  select * into v_post from public.content_posts
  where id = p_post_id and client_id = v_client and deleted_at is null
  for update;
  if not found then
    raise exception 'No encontramos esa publicación.';
  end if;
  if v_post.status <> 'en_aprobacion' then
    raise exception 'Esta publicación ya no está esperando tu aprobación.';
  end if;

  update public.content_posts
  set status = case when p_decision = 'aprobado' then 'aprobado'::public.post_status else 'borrador'::public.post_status end
  where id = p_post_id;

  -- Queda registrada como una aprobación más, así el equipo la ve en la publicación
  insert into public.approvals (client_id, token_hash, post_ids, decisions, client_comment, decided_at, created_by, expires_at)
  values (v_client, 'portal:' || encode(extensions.gen_random_bytes(16), 'hex'), array[p_post_id],
          jsonb_build_object(p_post_id::text, jsonb_build_object('decision', p_decision, 'comment', coalesce(trim(p_comment), ''))),
          null, now(), auth.uid(), now());

  -- Si había un link de aprobación pendiente para esta publicación, se da por respondido
  update public.approvals
  set decisions = decisions || jsonb_build_object(p_post_id::text, jsonb_build_object('decision', p_decision, 'comment', coalesce(trim(p_comment), '')))
  where decided_at is null and p_post_id = any (post_ids) and client_id = v_client;

  select brand_name into v_brand from public.clients where id = v_client;
  select full_name into v_name from public.profiles where id = auth.uid();
  for staff in select id from public.profiles where role in ('admin', 'equipo') and is_active loop
    insert into public.notifications (user_id, type, title, body, link)
    values (staff.id, 'aprobacion',
            v_brand || case when p_decision = 'aprobado' then ' aprobó una publicación' else ' pidió cambios en una publicación' end,
            coalesce(v_name, 'El cliente') || ' desde el portal' ||
              case when p_decision = 'cambios' then ': "' || left(trim(p_comment), 120) || '"' else '' end,
            '/contenidos?post=' || p_post_id);
  end loop;
end $$;

revoke execute on function public.portal_decide_post(uuid, text, text) from public, anon;
grant execute on function public.portal_decide_post(uuid, text, text) to authenticated;

-- Nombre del estudio para el portal (la configuración completa es solo del admin)
create or replace function public.studio_public()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('studio_name', studio_name) from public.settings where id = true
$$;
revoke execute on function public.studio_public() from public, anon;
grant execute on function public.studio_public() to authenticated;

-- El cliente ve sus propias respuestas (para mostrarle qué contestó)
create policy "cliente ve sus aprobaciones" on public.approvals
  for select to authenticated using (client_id = public.current_client_id());
