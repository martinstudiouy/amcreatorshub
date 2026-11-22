// Fase 2: clientes, brand kit, notas, proyectos, plantillas y tareas.
// Igual que api.ts: cada función va a Supabase o, en modo demo, a la base en memoria.
import { todayMvd } from '@/lib/format'
import { isDemo, sb } from '@/lib/supabase'
import type { Database, Tables, TablesInsert, TablesUpdate } from '@/types/database'
import { getDemoRole } from './api'
import { DEMO_USER_ID, demo } from './demo'
import { db, demoFiles } from './demo-db'

type Enums = Database['public']['Enums']
export type ServiceType = Enums['service_type']
export type ClientStatus = Enums['client_status']
export type ProjectStatus = Enums['project_status']
export type Currency = Enums['currency_code']
export type Client = Tables<'clients'>
export type ClientOverview = Tables<'clients_overview'>
export type ClientService = Tables<'client_services'>
export type ClientAsset = Tables<'client_assets'>
export type ClientNote = Tables<'client_notes'> & { author_name?: string | null }
export type ProjectOverview = Tables<'projects_overview'>
export type Project = Tables<'projects'>
export type TaskOverview = Tables<'tasks_overview'>
export type Task = Tables<'tasks'>
export type ChecklistItem = Tables<'task_checklist_items'>
export type TaskComment = Tables<'task_comments'> & { author_name?: string | null }
export type TaskAttachment = Tables<'task_attachments'>
export type Template = Tables<'project_templates'> & { tasks: Tables<'template_tasks'>[] }
export type TemplateTask = Tables<'template_tasks'>
export type Member = Pick<Tables<'profiles'>, 'id' | 'full_name' | 'avatar_path' | 'role'>

const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms))
function check<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}
/** Para .single(): si no hay error, siempre hay fila. */
function must<R extends { data: unknown; error: unknown }>(res: R): NonNullable<R['data']> {
  if (res.error) throw res.error
  if (res.data == null) throw new Error('No se pudo guardar. Probá de nuevo.')
  return res.data as NonNullable<R['data']>
}
const isAdminDemo = () => getDemoRole() === 'admin'
const nameOf = (userId: string | null) => demo.profiles.find((p) => p.id === userId)?.full_name ?? null

/** Nombre de archivo seguro para Storage (sin tildes ni espacios). */
function safeName(name: string) {
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot).toLowerCase() : ''
  const stem = (dot > 0 ? name.slice(0, dot) : name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${crypto.randomUUID().slice(0, 8)}-${stem || 'archivo'}${ext}`
}

type Bucket = 'brand-kits' | 'attachments' | 'content'

/** URL temporal (1 hora) para ver o descargar un archivo privado. */
export async function fileUrl(bucket: Bucket, path: string | null, download?: string): Promise<string | null> {
  if (!path) return null
  if (isDemo) return demoFiles.get(path) ?? null
  const { data, error } = await sb().storage.from(bucket).createSignedUrl(path, 3600, download ? { download } : undefined)
  if (error) throw error
  return data.signedUrl
}

export async function upload(bucket: Bucket, folder: string, file: File): Promise<string> {
  const path = `${folder}/${safeName(file.name)}`
  if (isDemo) {
    demoFiles.set(path, URL.createObjectURL(file))
    return path
  }
  const { error } = await sb().storage.from(bucket).upload(path, file, { contentType: file.type || undefined, upsert: false })
  if (error) throw error
  return path
}

export async function removeFile(bucket: Bucket, path: string | null) {
  if (!path) return
  if (isDemo) {
    demoFiles.delete(path)
    return
  }
  await sb().storage.from(bucket).remove([path])
}

// ==================================================================== Equipo
export async function listMembers(): Promise<Member[]> {
  if (isDemo) return demo.profiles.filter((p) => p.is_active && p.role !== 'cliente')
  return check(
    await sb().from('profiles').select('id, full_name, avatar_path, role').eq('is_active', true).neq('role', 'cliente').order('full_name'),
  )
}

// ==================================================================== Clientes
function demoClientOverview(c: Client): ClientOverview {
  return {
    ...c,
    monthly_fee: isAdminDemo() ? c.monthly_fee : null,
    services: [...new Set(db.services.rows.filter((s) => s.client_id === c.id && s.is_active).map((s) => s.service))].sort(),
    active_projects: db.projects.rows.filter((p) => p.client_id === c.id && p.status === 'activo' && !p.deleted_at).length,
  }
}

export async function listClients(): Promise<ClientOverview[]> {
  if (isDemo) {
    await wait()
    return db.clients.rows.filter((c) => !c.deleted_at).map(demoClientOverview).sort((a, b) => a.brand_name.localeCompare(b.brand_name))
  }
  return check(await sb().from('clients_overview').select('*').is('deleted_at', null).order('brand_name'))
}

export async function getClient(clientId: string): Promise<ClientOverview | null> {
  if (isDemo) {
    await wait()
    const c = db.clients.get(clientId)
    return c && !c.deleted_at ? demoClientOverview(c) : null
  }
  return check(await sb().from('clients_overview').select('*').eq('id', clientId).is('deleted_at', null).maybeSingle())
}

export type ClientInput = Pick<
  TablesInsert<'clients'>,
  'name' | 'brand_name' | 'industry' | 'email' | 'whatsapp' | 'instagram_handle' | 'monthly_fee' | 'currency' | 'start_date' | 'status' | 'color_tag'
>

/** Crea el cliente y sus servicios. Devuelve el id. */
export async function createClient(input: ClientInput, services: ServiceType[]): Promise<string> {
  if (isDemo) {
    await wait()
    const c = db.clients.insert({
      industry: null, email: null, whatsapp: null, instagram_handle: null, start_date: null, color_tag: null,
      currency: 'UYU', status: 'lead', created_by: DEMO_USER_ID, deleted_at: null,
      ...input,
      monthly_fee: isAdminDemo() ? (input.monthly_fee ?? null) : null,
    } as Client)
    services.forEach((s) => db.services.insert({ client_id: c.id, service: s, description: null, is_active: true }))
    return c.id
  }
  const created = must(await sb().from('clients').insert(input).select('id').single())
  if (services.length) check(await sb().from('client_services').insert(services.map((service) => ({ client_id: created.id, service }))))
  return created.id
}

/** Actualiza la ficha y sincroniza los servicios activos con la lista recibida. */
export async function updateClient(clientId: string, patch: TablesUpdate<'clients'>, services?: ServiceType[]) {
  if (isDemo) {
    await wait()
    const p = { ...patch }
    if (!isAdminDemo()) delete p.monthly_fee
    db.clients.update(clientId, p)
    if (services) {
      const current = db.services.rows.filter((s) => s.client_id === clientId)
      current.forEach((s) => db.services.update(s.id, { is_active: services.includes(s.service) }))
      services
        .filter((s) => !current.some((c) => c.service === s))
        .forEach((s) => db.services.insert({ client_id: clientId, service: s, description: null, is_active: true }))
    }
    return
  }
  check(await sb().from('clients').update(patch).eq('id', clientId))
  if (services) {
    const current = check(await sb().from('client_services').select('id, service').eq('client_id', clientId))
    for (const s of current) {
      check(await sb().from('client_services').update({ is_active: services.includes(s.service) }).eq('id', s.id))
    }
    const missing = services.filter((s) => !current.some((c) => c.service === s))
    if (missing.length) check(await sb().from('client_services').insert(missing.map((service) => ({ client_id: clientId, service }))))
  }
}

/** Manda el cliente a la papelera (borrado lógico). */
export async function archiveClient(clientId: string) {
  return updateClient(clientId, { deleted_at: new Date().toISOString() })
}

export async function listServices(clientId: string): Promise<ClientService[]> {
  if (isDemo) return db.services.rows.filter((s) => s.client_id === clientId && s.is_active)
  return check(await sb().from('client_services').select('*').eq('client_id', clientId).eq('is_active', true).order('service'))
}

export async function updateServiceDescription(serviceId: string, description: string | null) {
  if (isDemo) {
    db.services.update(serviceId, { description })
    return
  }
  check(await sb().from('client_services').update({ description }).eq('id', serviceId))
}

// ==================================================================== Brand kit
export async function listAssets(clientId: string): Promise<ClientAsset[]> {
  if (isDemo) {
    await wait(120)
    return db.assets.rows.filter((a) => a.client_id === clientId).sort((a, b) => a.sort_order - b.sort_order)
  }
  return check(await sb().from('client_assets').select('*').eq('client_id', clientId).order('sort_order').order('created_at'))
}

export async function addAssetValue(clientId: string, kind: 'color' | 'font', name: string, value: string) {
  if (isDemo) {
    const max = Math.max(0, ...db.assets.rows.filter((a) => a.client_id === clientId).map((a) => a.sort_order))
    db.assets.insert({ client_id: clientId, kind, name, value, storage_path: null, sort_order: max + 1, created_by: DEMO_USER_ID })
    return
  }
  check(await sb().from('client_assets').insert({ client_id: clientId, kind, name, value, sort_order: Date.now() % 1e9 }))
}

/** Sube un logo o archivo al brand kit: brand-kits/<client_id>/... */
export async function uploadAsset(clientId: string, kind: 'logo' | 'file', file: File) {
  const path = await upload('brand-kits', clientId, file)
  if (isDemo) {
    db.assets.insert({ client_id: clientId, kind, name: file.name, value: file.type || null, storage_path: path, sort_order: 999, created_by: DEMO_USER_ID })
    return
  }
  const res = await sb().from('client_assets').insert({ client_id: clientId, kind, name: file.name, value: file.type || null, storage_path: path, sort_order: Date.now() % 1e9 })
  if (res.error) {
    await removeFile('brand-kits', path)
    throw res.error
  }
}

export async function deleteAsset(asset: ClientAsset) {
  if (isDemo) db.assets.remove(asset.id)
  else check(await sb().from('client_assets').delete().eq('id', asset.id))
  await removeFile('brand-kits', asset.storage_path)
}

export const assetUrl = (a: ClientAsset, download = false) => fileUrl('brand-kits', a.storage_path, download ? a.name : undefined)

// ==================================================================== Notas
export async function listNotes(clientId: string): Promise<ClientNote[]> {
  if (isDemo) {
    await wait(120)
    return db.notes.rows
      .filter((n) => n.client_id === clientId)
      .map((n) => ({ ...n, author_name: nameOf(n.author_id) }))
      .sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.created_at.localeCompare(a.created_at))
  }
  const rows = check(
    await sb()
      .from('client_notes')
      .select('*, author:profiles!client_notes_author_id_fkey(full_name)')
      .eq('client_id', clientId)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false }),
  )
  return rows.map(({ author, ...n }) => ({ ...n, author_name: author?.full_name ?? null }))
}

export async function addNote(clientId: string, body: string) {
  if (isDemo) {
    db.notes.insert({ client_id: clientId, body, is_pinned: false, author_id: DEMO_USER_ID })
    return
  }
  check(await sb().from('client_notes').insert({ client_id: clientId, body }))
}

export async function updateNote(noteId: string, patch: TablesUpdate<'client_notes'>) {
  if (isDemo) {
    db.notes.update(noteId, patch)
    return
  }
  check(await sb().from('client_notes').update(patch).eq('id', noteId))
}

export async function deleteNote(noteId: string) {
  if (isDemo) {
    db.notes.remove(noteId)
    return
  }
  check(await sb().from('client_notes').delete().eq('id', noteId))
}

// ==================================================================== Proyectos
function demoProjectOverview(p: Project): ProjectOverview {
  const c = db.clients.get(p.client_id)!
  const tasks = db.tasks.rows.filter((t) => t.project_id === p.id && !t.deleted_at)
  return {
    ...p,
    budget: isAdminDemo() ? p.budget : null,
    client_name: c.brand_name,
    client_color: c.color_tag,
    tasks_total: tasks.length,
    tasks_done: tasks.filter((t) => t.column === 'aprobado' || t.column === 'entregado').length,
  }
}

export async function listProjects(filter: { clientId?: string } = {}): Promise<ProjectOverview[]> {
  if (isDemo) {
    await wait()
    return db.projects.rows
      .filter((p) => !p.deleted_at && (!filter.clientId || p.client_id === filter.clientId))
      .map(demoProjectOverview)
      .sort((a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'))
  }
  let q = sb().from('projects_overview').select('*').is('deleted_at', null)
  if (filter.clientId) q = q.eq('client_id', filter.clientId)
  return check(await q.order('due_date', { ascending: true, nullsFirst: false }))
}

export async function getProject(projectId: string): Promise<ProjectOverview | null> {
  if (isDemo) {
    await wait()
    const p = db.projects.get(projectId)
    return p && !p.deleted_at ? demoProjectOverview(p) : null
  }
  return check(await sb().from('projects_overview').select('*').eq('id', projectId).is('deleted_at', null).maybeSingle())
}

export type ProjectInput = Pick<TablesInsert<'projects'>, 'client_id' | 'name' | 'type' | 'start_date' | 'due_date' | 'budget' | 'currency' | 'status'>

/** Crea un proyecto vacío o a partir de una plantilla (copia tareas y checklists). */
export async function createProject(input: ProjectInput, templateId?: string | null): Promise<string> {
  if (isDemo) {
    await wait()
    const tpl = templateId ? db.templates.get(templateId) : null
    const p = db.projects.insert({
      start_date: null, due_date: null, currency: 'UYU', status: 'activo', created_by: DEMO_USER_ID, deleted_at: null,
      ...input,
      type: tpl?.project_type ?? input.type,
      budget: isAdminDemo() ? (input.budget ?? tpl?.default_budget ?? null) : null,
      template_id: tpl?.id ?? null,
    } as Project)
    if (tpl) {
      const start = input.start_date
      db.templateTasks.rows
        .filter((t) => t.template_id === tpl.id)
        .sort((a, b) => a.position - b.position)
        .forEach((tt) => {
          const t = db.tasks.insert({
            project_id: p.id, title: tt.title, description: tt.description, assignee_id: null,
            due_date: start ? addDaysIso(start, tt.day_offset) : null, priority: tt.default_priority,
            column: 'por_hacer', position: nextPosition('por_hacer'), created_by: DEMO_USER_ID, deleted_at: null,
          })
          tt.checklist.forEach((label, i) => db.checklist.insert({ task_id: t.id, label, is_done: false, position: i + 1 }))
        })
    }
    return p.id
  }
  if (templateId) {
    return check(
      await sb().rpc('create_project_from_template', {
        p_client_id: input.client_id,
        p_template_id: templateId,
        p_name: input.name,
        p_start_date: input.start_date ?? todayMvd(),
        p_due_date: input.due_date ?? undefined,
        p_budget: input.budget ?? undefined,
        p_currency: input.currency ?? 'UYU',
        p_status: input.status ?? 'activo',
      }),
    ) as string
  }
  return must(await sb().from('projects').insert(input).select('id').single()).id
}

function addDaysIso(isoDate: string, days: number) {
  const dt = new Date(`${isoDate}T12:00:00Z`)
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

export async function updateProject(projectId: string, patch: TablesUpdate<'projects'>) {
  if (isDemo) {
    await wait()
    const p = { ...patch }
    if (!isAdminDemo()) delete p.budget
    db.projects.update(projectId, p)
    return
  }
  check(await sb().from('projects').update(patch).eq('id', projectId))
}

export const archiveProject = (projectId: string) => updateProject(projectId, { deleted_at: new Date().toISOString() })

// ==================================================================== Plantillas
export async function listTemplates(): Promise<Template[]> {
  if (isDemo) {
    await wait(120)
    return db.templates.rows
      .map((t) => ({ ...t, tasks: db.templateTasks.rows.filter((x) => x.template_id === t.id).sort((a, b) => a.position - b.position) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }
  const rows = check(await sb().from('project_templates').select('*, tasks:template_tasks(*)').order('name'))
  return rows.map((t) => ({ ...t, tasks: [...t.tasks].sort((a, b) => a.position - b.position) }))
}

export async function createTemplate(input: Pick<TablesInsert<'project_templates'>, 'name' | 'project_type' | 'description' | 'default_budget'>): Promise<string> {
  if (isDemo) return db.templates.insert({ description: null, default_budget: null, created_by: DEMO_USER_ID, ...input } as Tables<'project_templates'>).id
  return must(await sb().from('project_templates').insert(input).select('id').single()).id
}

export async function updateTemplate(templateId: string, patch: TablesUpdate<'project_templates'>) {
  if (isDemo) {
    db.templates.update(templateId, patch)
    return
  }
  check(await sb().from('project_templates').update(patch).eq('id', templateId))
}

export async function deleteTemplate(templateId: string) {
  if (isDemo) {
    db.templates.remove(templateId)
    db.templateTasks.rows = db.templateTasks.rows.filter((t) => t.template_id !== templateId)
    return
  }
  check(await sb().from('project_templates').delete().eq('id', templateId))
}

export async function addTemplateTask(templateId: string, input: Pick<TablesInsert<'template_tasks'>, 'title' | 'day_offset' | 'default_priority' | 'checklist'>) {
  if (isDemo) {
    const pos = db.templateTasks.rows.filter((t) => t.template_id === templateId).length + 1
    db.templateTasks.insert({ template_id: templateId, description: null, day_offset: 0, default_priority: 'media', checklist: [], position: pos, ...input } as TemplateTask)
    return
  }
  const { count } = await sb().from('template_tasks').select('id', { count: 'exact', head: true }).eq('template_id', templateId)
  check(await sb().from('template_tasks').insert({ template_id: templateId, position: (count ?? 0) + 1, ...input }))
}

export async function deleteTemplateTask(taskId: string) {
  if (isDemo) {
    db.templateTasks.remove(taskId)
    return
  }
  check(await sb().from('template_tasks').delete().eq('id', taskId))
}

// ==================================================================== Tareas
export interface TaskFilter {
  projectId?: string
  clientId?: string
  assigneeId?: string
}

function demoTaskOverview(t: Task): TaskOverview {
  const p = db.projects.get(t.project_id)!
  const c = db.clients.get(p.client_id)!
  const items = db.checklist.rows.filter((i) => i.task_id === t.id)
  return {
    ...t,
    project_name: p.name,
    client_id: c.id,
    client_name: c.brand_name,
    client_color: c.color_tag,
    assignee_name: nameOf(t.assignee_id),
    checklist_total: items.length,
    checklist_done: items.filter((i) => i.is_done).length,
    comments_count: db.comments.rows.filter((m) => m.task_id === t.id).length,
    attachments_count: db.attachments.rows.filter((a) => a.task_id === t.id).length,
  }
}

export async function listTasks(filter: TaskFilter = {}): Promise<TaskOverview[]> {
  if (isDemo) {
    await wait()
    return db.tasks.rows
      .filter((t) => {
        if (t.deleted_at) return false
        const p = db.projects.get(t.project_id)
        if (!p || p.deleted_at) return false
        if (filter.projectId && t.project_id !== filter.projectId) return false
        if (filter.clientId && p.client_id !== filter.clientId) return false
        if (filter.assigneeId && t.assignee_id !== (filter.assigneeId === 'none' ? null : filter.assigneeId)) return false
        return true
      })
      .map(demoTaskOverview)
      .sort((a, b) => a.position - b.position)
  }
  let q = sb().from('tasks_overview').select('*').is('deleted_at', null)
  if (filter.projectId) q = q.eq('project_id', filter.projectId)
  if (filter.clientId) q = q.eq('client_id', filter.clientId)
  if (filter.assigneeId === 'none') q = q.is('assignee_id', null)
  else if (filter.assigneeId) q = q.eq('assignee_id', filter.assigneeId)
  return check(await q.order('position'))
}

export async function getTask(taskId: string): Promise<TaskOverview | null> {
  if (isDemo) {
    const t = db.tasks.get(taskId)
    return t && !t.deleted_at ? demoTaskOverview(t) : null
  }
  return check(await sb().from('tasks_overview').select('*').eq('id', taskId).maybeSingle())
}

function nextPosition(column: Task['column']) {
  const inCol = db.tasks.rows.filter((t) => t.column === column)
  return inCol.length ? Math.max(...inCol.map((t) => t.position)) + 1 : 1
}

export type TaskInput = Pick<TablesInsert<'tasks'>, 'project_id' | 'title' | 'description' | 'assignee_id' | 'due_date' | 'priority' | 'column'>

export async function createTask(input: TaskInput): Promise<string> {
  const column = input.column ?? 'por_hacer'
  if (isDemo) {
    await wait(120)
    return db.tasks.insert({
      description: null, assignee_id: null, due_date: null, priority: 'media', created_by: DEMO_USER_ID, deleted_at: null,
      ...input,
      column,
      position: nextPosition(column),
    } as Task).id
  }
  // Va al final de la columna
  const last = check(
    await sb().from('tasks').select('position').eq('column', column).is('deleted_at', null).order('position', { ascending: false }).limit(1),
  )
  const position = (last[0]?.position ?? 0) + 1
  return must(await sb().from('tasks').insert({ ...input, column, position }).select('id').single()).id
}

export async function updateTask(taskId: string, patch: TablesUpdate<'tasks'>) {
  if (isDemo) {
    db.tasks.update(taskId, patch)
    return
  }
  check(await sb().from('tasks').update(patch).eq('id', taskId))
}

export const deleteTask = (taskId: string) => updateTask(taskId, { deleted_at: new Date().toISOString() })

// ---------------------------------------------------------------- Checklist
export async function listChecklist(taskId: string): Promise<ChecklistItem[]> {
  if (isDemo) return db.checklist.rows.filter((i) => i.task_id === taskId).sort((a, b) => a.position - b.position)
  return check(await sb().from('task_checklist_items').select('*').eq('task_id', taskId).order('position'))
}

export async function addChecklistItem(taskId: string, label: string) {
  if (isDemo) {
    db.checklist.insert({ task_id: taskId, label, is_done: false, position: db.checklist.rows.filter((i) => i.task_id === taskId).length + 1 })
    return
  }
  const { count } = await sb().from('task_checklist_items').select('id', { count: 'exact', head: true }).eq('task_id', taskId)
  check(await sb().from('task_checklist_items').insert({ task_id: taskId, label, position: (count ?? 0) + 1 }))
}

export async function updateChecklistItem(itemId: string, patch: TablesUpdate<'task_checklist_items'>) {
  if (isDemo) {
    db.checklist.update(itemId, patch)
    return
  }
  check(await sb().from('task_checklist_items').update(patch).eq('id', itemId))
}

export async function deleteChecklistItem(itemId: string) {
  if (isDemo) {
    db.checklist.remove(itemId)
    return
  }
  check(await sb().from('task_checklist_items').delete().eq('id', itemId))
}

// ---------------------------------------------------------------- Comentarios
export async function listComments(taskId: string): Promise<TaskComment[]> {
  if (isDemo) {
    return db.comments.rows
      .filter((c) => c.task_id === taskId)
      .map((c) => ({ ...c, author_name: nameOf(c.author_id) }))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
  }
  const rows = check(
    await sb()
      .from('task_comments')
      .select('*, author:profiles!task_comments_author_id_fkey(full_name)')
      .eq('task_id', taskId)
      .order('created_at'),
  )
  return rows.map(({ author, ...c }) => ({ ...c, author_name: author?.full_name ?? null }))
}

export async function addComment(taskId: string, body: string, authorId: string) {
  if (isDemo) {
    db.comments.insert({ task_id: taskId, body, author_id: DEMO_USER_ID })
    return
  }
  check(await sb().from('task_comments').insert({ task_id: taskId, body, author_id: authorId }))
}

export async function deleteComment(commentId: string) {
  if (isDemo) {
    db.comments.remove(commentId)
    return
  }
  check(await sb().from('task_comments').delete().eq('id', commentId))
}

// ---------------------------------------------------------------- Adjuntos
export async function listAttachments(taskId: string): Promise<TaskAttachment[]> {
  if (isDemo) return db.attachments.rows.filter((a) => a.task_id === taskId)
  return check(await sb().from('task_attachments').select('*').eq('task_id', taskId).order('created_at'))
}

export async function uploadAttachment(taskId: string, file: File) {
  const path = await upload('attachments', taskId, file)
  if (isDemo) {
    db.attachments.insert({ task_id: taskId, storage_path: path, file_name: file.name, mime_type: file.type || null, size_bytes: file.size, uploaded_by: DEMO_USER_ID })
    return
  }
  const res = await sb().from('task_attachments').insert({ task_id: taskId, storage_path: path, file_name: file.name, mime_type: file.type || null, size_bytes: file.size })
  if (res.error) {
    await removeFile('attachments', path)
    throw res.error
  }
}

export async function deleteAttachment(a: TaskAttachment) {
  if (isDemo) db.attachments.remove(a.id)
  else check(await sb().from('task_attachments').delete().eq('id', a.id))
  await removeFile('attachments', a.storage_path)
}

export const attachmentUrl = (a: TaskAttachment, download = false) => fileUrl('attachments', a.storage_path, download ? a.file_name : undefined)
