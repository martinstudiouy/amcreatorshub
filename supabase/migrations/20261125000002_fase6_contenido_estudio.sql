-- =====================================================================
-- Fase 6 (ajuste): publicaciones del propio estudio (sin cliente)
-- Una publicación sin cliente es contenido de AM Creators y se publica en la
-- cuenta de Instagram del estudio (la que no tiene cliente asignado).
-- =====================================================================
alter table public.content_posts alter column client_id drop not null;

-- El inicio y el buscador muestran también las publicaciones del estudio
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
        'scheduled_at', p.scheduled_at, 'client_name', coalesce(c.brand_name, (select studio_name from public.settings where id = true)), 'color_tag', coalesce(c.color_tag, '#0300FF'))
        order by p.scheduled_at)
      from public.content_posts p left join public.clients c on c.id = p.client_id
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
  (select 'publicacion', p.id, left(coalesce(nullif(p.caption, ''), '(sin texto)'), 80), coalesce(c.brand_name, 'Estudio'),
          '/contenidos?post=' || p.id
   from public.content_posts p left join public.clients c on c.id = p.client_id cross join term
   where p.deleted_at is null and (p.caption ilike term.t or p.hashtags ilike term.t)
   order by p.scheduled_at desc nulls last limit 6)
$$;
