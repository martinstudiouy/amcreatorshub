-- =====================================================================
-- AM Creators Hub — Fase 2: clientes, proyectos y tareas
-- Vistas con contadores, proyecto desde plantilla y aviso de asignación.
-- No crea tablas nuevas: siguen siendo 34.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Vistas (security_invoker: respetan el RLS de quien consulta;
-- se apoyan en clients_v / projects_v para ocultar montos al equipo)
-- ---------------------------------------------------------------------
create view public.clients_overview with (security_invoker = true) as
  select c.*,
         coalesce((select array_agg(distinct s.service order by s.service)
                   from public.client_services s
                   where s.client_id = c.id and s.is_active), '{}') as services,
         (select count(*) from public.projects p
          where p.client_id = c.id and p.status = 'activo' and p.deleted_at is null) as active_projects
  from public.clients_v c;

create view public.projects_overview with (security_invoker = true) as
  select p.*,
         c.brand_name as client_name,
         c.color_tag  as client_color,
         (select count(*) from public.tasks t where t.project_id = p.id and t.deleted_at is null) as tasks_total,
         (select count(*) from public.tasks t where t.project_id = p.id and t.deleted_at is null
            and t."column" in ('aprobado', 'entregado')) as tasks_done
  from public.projects_v p
  join public.clients c on c.id = p.client_id;

create view public.tasks_overview with (security_invoker = true) as
  select t.*,
         p.name        as project_name,
         p.client_id,
         c.brand_name  as client_name,
         c.color_tag   as client_color,
         pf.full_name  as assignee_name,
         (select count(*) from public.task_checklist_items i where i.task_id = t.id) as checklist_total,
         (select count(*) from public.task_checklist_items i where i.task_id = t.id and i.is_done) as checklist_done,
         (select count(*) from public.task_comments m where m.task_id = t.id) as comments_count,
         (select count(*) from public.task_attachments a where a.task_id = t.id) as attachments_count
  from public.tasks t
  join public.projects p on p.id = t.project_id
  join public.clients c on c.id = p.client_id
  left join public.profiles pf on pf.id = t.assignee_id
  where p.deleted_at is null;      -- las tareas de proyectos en la papelera no se listan

grant select on public.clients_overview, public.projects_overview, public.tasks_overview to authenticated;
revoke all on public.clients_overview, public.projects_overview, public.tasks_overview from anon;

-- ---------------------------------------------------------------------
-- Crear un proyecto desde una plantilla: copia las tareas con fechas
-- relativas al inicio y sus checklists. Respeta RLS (security invoker).
-- ---------------------------------------------------------------------
create or replace function public.create_project_from_template(
  p_client_id   uuid,
  p_template_id uuid,
  p_name        text,
  p_start_date  date,
  p_due_date    date default null,
  p_budget      numeric default null,
  p_currency    public.currency_code default 'UYU',
  p_status      public.project_status default 'activo'
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_type    public.service_type;
  v_project uuid;
  v_task    uuid;
  tt        record;
  item      text;
  i         int;
begin
  select project_type into v_type from public.project_templates where id = p_template_id;
  if v_type is null then
    raise exception 'La plantilla no existe o no tenés acceso.';
  end if;

  insert into public.projects (client_id, name, type, start_date, due_date, budget, currency, status, template_id)
  values (p_client_id, p_name, v_type, p_start_date, p_due_date,
          coalesce(p_budget, (select default_budget from public.project_templates where id = p_template_id)),
          p_currency, p_status, p_template_id)
  returning id into v_project;

  for tt in select * from public.template_tasks where template_id = p_template_id order by position, day_offset loop
    insert into public.tasks (project_id, title, description, due_date, priority, "column", position)
    values (v_project, tt.title, tt.description,
            case when p_start_date is null then null else p_start_date + tt.day_offset end,
            tt.default_priority, 'por_hacer', tt.position)
    returning id into v_task;

    i := 0;
    foreach item in array tt.checklist loop
      i := i + 1;
      insert into public.task_checklist_items (task_id, label, position) values (v_task, item, i);
    end loop;
  end loop;

  return v_project;
end $$;

revoke execute on function public.create_project_from_template(uuid, uuid, text, date, date, numeric, public.currency_code, public.project_status) from anon, public;
grant execute on function public.create_project_from_template(uuid, uuid, text, date, date, numeric, public.currency_code, public.project_status) to authenticated;

-- ---------------------------------------------------------------------
-- Aviso dentro de la app cuando te asignan una tarea
-- ---------------------------------------------------------------------
create or replace function public.notify_task_assignee()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor text;
begin
  if new.assignee_id is null or new.assignee_id = auth.uid() then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;
  select coalesce(nullif(split_part(full_name, ' ', 1), ''), 'Alguien') into actor
  from public.profiles where id = auth.uid();
  insert into public.notifications (user_id, type, title, body, link)
  values (new.assignee_id, 'tarea',
          coalesce(actor, 'Alguien') || ' te asignó una tarea',
          new.title,
          '/proyectos/' || new.project_id || '?tarea=' || new.id);
  return new;
end $$;

create trigger notify_task_assignee after insert or update of assignee_id on public.tasks
  for each row execute function public.notify_task_assignee();

-- Aviso al responsable cuando alguien comenta su tarea
create or replace function public.notify_task_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t record;
  actor text;
begin
  select id, title, project_id, assignee_id into t from public.tasks where id = new.task_id;
  if t.assignee_id is null or t.assignee_id = new.author_id then
    return new;
  end if;
  select coalesce(nullif(split_part(full_name, ' ', 1), ''), 'Alguien') into actor
  from public.profiles where id = new.author_id;
  insert into public.notifications (user_id, type, title, body, link)
  values (t.assignee_id, 'comentario', coalesce(actor, 'Alguien') || ' comentó en "' || t.title || '"',
          left(new.body, 140), '/proyectos/' || t.project_id || '?tarea=' || t.id);
  return new;
end $$;

create trigger notify_task_comment after insert on public.task_comments
  for each row execute function public.notify_task_comment();

-- author_id / uploaded_by automáticos
create or replace function public.set_author()
returns trigger language plpgsql as $$
begin
  if tg_table_name in ('task_comments', 'client_notes') and new.author_id is null then
    new.author_id := auth.uid();
  elsif tg_table_name = 'task_attachments' and new.uploaded_by is null then
    new.uploaded_by := auth.uid();
  end if;
  return new;
end $$;

create trigger set_author before insert on public.task_comments    for each row execute function public.set_author();
create trigger set_author before insert on public.client_notes     for each row execute function public.set_author();
create trigger set_author before insert on public.task_attachments for each row execute function public.set_author();

-- Solo el autor (o un admin) edita o borra su comentario
drop policy "staff gestiona comentarios" on public.task_comments;
create policy "staff ve comentarios" on public.task_comments
  for select to authenticated using (public.is_staff());
create policy "staff comenta" on public.task_comments
  for insert to authenticated with check (public.is_staff() and author_id = auth.uid());
create policy "autor edita su comentario" on public.task_comments
  for update to authenticated using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());
create policy "autor borra su comentario" on public.task_comments
  for delete to authenticated using (author_id = auth.uid() or public.is_admin());

create index if not exists tasks_column_position_idx on public.tasks ("column", position) where deleted_at is null;
