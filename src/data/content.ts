// Fase 5: calendario de contenidos y aprobaciones del cliente.
// Igual que el resto: cada función va a Supabase o, en modo demo, a la base en memoria.
import { isDemo, sb } from '@/lib/supabase'
import type { Database, Tables, TablesUpdate } from '@/types/database'
import { DEMO_USER_ID, demo } from './demo'
import { content, db, demoFiles } from './demo-db'
import { removeFile, upload } from './crm'

type Enums = Database['public']['Enums']
export type PostFormat = Enums['post_format']
export type PostStatus = Enums['post_status']
export type Media = Tables<'content_media'>
export type Post = Tables<'content_posts'> & {
  client_name: string
  client_color: string | null
  instagram_handle: string | null
  media: Media[]
}
export type Approval = Tables<'approvals'>
export type Decision = { decision: 'aprobado' | 'cambios'; comment?: string }

const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms))
function check<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

const SELECT = '*, client:clients(brand_name, color_tag, instagram_handle), media:content_media(*)'
type Row = Tables<'content_posts'> & {
  client: { brand_name: string; color_tag: string | null; instagram_handle: string | null } | null
  media: Media[]
}
const fromRow = ({ client, ...p }: Row): Post => ({
  ...p,
  client_name: client?.brand_name ?? '—',
  client_color: client?.color_tag ?? null,
  instagram_handle: client?.instagram_handle ?? null,
  media: [...(p.media ?? [])].sort((a, b) => a.position - b.position),
})

function demoPost(p: Tables<'content_posts'>): Post {
  const c = db.clients.get(p.client_id)
  return {
    ...p,
    client_name: c?.brand_name ?? '—',
    client_color: c?.color_tag ?? null,
    instagram_handle: c?.instagram_handle ?? null,
    media: content.media.rows.filter((m) => m.post_id === p.id).sort((a, b) => a.position - b.position),
  }
}

const byDate = (a: Post, b: Post) => (a.scheduled_at ?? '9999').localeCompare(b.scheduled_at ?? '9999') || a.created_at.localeCompare(b.created_at)

// ================================================================ Lectura
/** Publicaciones con fecha en [from, to) y, además, las ideas sin fecha. */
export async function listPosts(range: { from: string; to: string; clientId?: string }): Promise<Post[]> {
  if (isDemo) {
    await wait()
    return content.posts.rows
      .filter((p) => !p.deleted_at && (!range.clientId || p.client_id === range.clientId))
      .filter((p) => !p.scheduled_at || (p.scheduled_at >= range.from && p.scheduled_at < range.to))
      .map(demoPost)
      .sort(byDate)
  }
  let q = sb()
    .from('content_posts')
    .select(SELECT)
    .is('deleted_at', null)
    .or(`scheduled_at.is.null,and(scheduled_at.gte.${range.from},scheduled_at.lt.${range.to})`)
  if (range.clientId) q = q.eq('client_id', range.clientId)
  const rows = check(await q.order('scheduled_at', { ascending: true, nullsFirst: false }).limit(1000)) as unknown as Row[]
  return rows.map(fromRow)
}

/** Las últimas publicaciones de feed de un cliente, para la vista de grilla (más nueva primero). */
export async function listGridPosts(clientId: string): Promise<Post[]> {
  if (isDemo) {
    await wait()
    return content.posts.rows
      .filter((p) => !p.deleted_at && p.client_id === clientId && p.format !== 'story' && p.scheduled_at)
      .map(demoPost)
      .sort((a, b) => b.scheduled_at!.localeCompare(a.scheduled_at!))
      .slice(0, 30)
  }
  const rows = check(
    await sb()
      .from('content_posts')
      .select(SELECT)
      .is('deleted_at', null)
      .eq('client_id', clientId)
      .neq('format', 'story')
      .not('scheduled_at', 'is', null)
      .order('scheduled_at', { ascending: false })
      .limit(30),
  ) as unknown as Row[]
  return rows.map(fromRow)
}

export async function getPost(postId: string): Promise<Post | null> {
  if (isDemo) {
    const p = content.posts.get(postId)
    return p && !p.deleted_at ? demoPost(p) : null
  }
  const { data, error } = await sb().from('content_posts').select(SELECT).eq('id', postId).is('deleted_at', null).maybeSingle()
  if (error) throw error
  return data ? fromRow(data as unknown as Row) : null
}

// ================================================================ Escritura
export interface PostInput {
  client_id: string
  format: PostFormat
  scheduled_at: string | null
  caption: string | null
  hashtags: string | null
  status: PostStatus
}

/** Crea (con un id generado acá, para poder subir archivos antes) o actualiza. */
export async function savePost(input: PostInput, postId?: string, newId?: string): Promise<string> {
  if (isDemo) {
    await wait()
    if (postId) return content.posts.update(postId, input).id
    return content.posts.insert({
      ...input, id: newId, social_account_id: null, ig_media_id: null, ig_permalink: null, published_at: null, error_message: null,
      publish_attempts: 0, grid_position: null, created_by: DEMO_USER_ID, deleted_at: null,
    }).id
  }
  if (postId) {
    check(await sb().from('content_posts').update(input).eq('id', postId))
    return postId
  }
  const { data, error } = await sb().from('content_posts').insert({ ...input, ...(newId ? { id: newId } : {}) }).select('id').single()
  if (error) throw error
  return data.id
}

export async function updatePost(postId: string, patch: TablesUpdate<'content_posts'>) {
  if (isDemo) {
    await wait(80)
    content.posts.update(postId, patch)
    return
  }
  check(await sb().from('content_posts').update(patch).eq('id', postId))
}

export const deletePost = (postId: string) => updatePost(postId, { deleted_at: new Date().toISOString() })

/** Copia la publicación como borrador sin fecha (con los mismos archivos). */
export async function duplicatePost(p: Post): Promise<string> {
  const newId = await savePost({ client_id: p.client_id, format: p.format, scheduled_at: null, caption: p.caption, hashtags: p.hashtags, status: 'borrador' }, undefined, crypto.randomUUID())
  const rows = p.media.map((m) => ({ post_id: newId, storage_path: m.storage_path, media_type: m.media_type, position: m.position, width: m.width, height: m.height, duration_s: m.duration_s, cover_path: m.cover_path }))
  if (!rows.length) return newId
  if (isDemo) rows.forEach((r) => content.media.insert(r))
  else check(await sb().from('content_media').insert(rows))
  return newId
}

// ================================================================ Archivos
/** Medidas de una imagen o video del navegador (para validar formatos de Instagram). */
export function readMediaInfo(file: File): Promise<{ type: 'imagen' | 'video'; width: number | null; height: number | null; duration: number | null }> {
  const url = URL.createObjectURL(file)
  const done = <T,>(v: T) => {
    URL.revokeObjectURL(url)
    return v
  }
  if (file.type.startsWith('video/')) {
    return new Promise((resolve) => {
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.onloadedmetadata = () => resolve(done({ type: 'video', width: v.videoWidth || null, height: v.videoHeight || null, duration: Number.isFinite(v.duration) ? Math.round(v.duration * 100) / 100 : null }))
      v.onerror = () => resolve(done({ type: 'video', width: null, height: null, duration: null }))
      v.src = url
    })
  }
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(done({ type: 'imagen', width: img.naturalWidth, height: img.naturalHeight, duration: null }))
    img.onerror = () => resolve(done({ type: 'imagen', width: null, height: null, duration: null }))
    img.src = url
  })
}

export async function addMedia(post: { id: string; client_id: string }, file: File, position: number): Promise<Media> {
  const info = await readMediaInfo(file)
  // La primera carpeta es el cliente: así el portal del cliente (Fase 8) puede leer sus archivos.
  const path = await upload('content', `${post.client_id}/${post.id}`, file)
  const row = { post_id: post.id, storage_path: path, media_type: info.type, position, width: info.width, height: info.height, duration_s: info.duration, cover_path: null }
  if (isDemo) return content.media.insert(row)
  const { data, error } = await sb().from('content_media').insert(row).select('*').single()
  if (error) throw error
  return data
}

export async function removeMedia(m: Media) {
  if (isDemo) content.media.remove(m.id)
  else check(await sb().from('content_media').delete().eq('id', m.id))
  // El archivo se borra solo si ninguna otra publicación lo usa (los duplicados comparten archivos)
  const stillUsed = isDemo
    ? content.media.rows.some((x) => x.storage_path === m.storage_path)
    : (check(await sb().from('content_media').select('id').eq('storage_path', m.storage_path).limit(1)) ?? []).length > 0
  if (!stillUsed && !m.storage_path.startsWith('demo/')) await removeFile('content', m.storage_path)
}

export async function reorderMedia(ids: string[]) {
  if (isDemo) {
    ids.forEach((id, i) => content.media.update(id, { position: i }))
    return
  }
  await Promise.all(ids.map((id, i) => sb().from('content_media').update({ position: i }).eq('id', id)))
}

/** Links temporales (1 hora) para mostrar varios archivos de una vez. */
export async function mediaUrls(paths: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))]
  if (!unique.length) return {}
  if (isDemo) return Object.fromEntries(unique.map((p) => [p, demoFiles.get(p) ?? '']))
  const { data, error } = await sb().storage.from('content').createSignedUrls(unique, 3600)
  if (error) throw error
  return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string]))
}

// ================================================================ Aprobaciones
export const approvalUrl = (token: string) => `${window.location.origin}/aprobar/${token}`

/** Crea el link de aprobación y pasa las publicaciones a "En aprobación". */
export async function createApproval(clientId: string, postIds: string[]): Promise<string> {
  if (isDemo) {
    await wait(300)
    const token = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('')
    content.approvals.insert({ client_id: clientId, token_hash: token, post_ids: postIds, decisions: {}, client_comment: null, expires_at: new Date(Date.now() + 14 * 864e5).toISOString(), decided_at: null, created_by: DEMO_USER_ID })
    postIds.forEach((id) => {
      const p = content.posts.get(id)
      if (p && ['idea', 'borrador', 'en_aprobacion'].includes(p.status)) content.posts.update(id, { status: 'en_aprobacion' })
    })
    return token
  }
  return check(await sb().rpc('create_approval', { p_client_id: clientId, p_post_ids: postIds }))
}

/** Pedidos de aprobación que incluyen esta publicación (el más nuevo primero). */
export async function approvalsForPost(postId: string): Promise<Approval[]> {
  if (isDemo) return content.approvals.rows.filter((a) => a.post_ids.includes(postId)).sort((a, b) => b.created_at.localeCompare(a.created_at))
  return check(await sb().from('approvals').select('*').contains('post_ids', [postId]).order('created_at', { ascending: false }).limit(5))
}

// ---------------------------------------------------------------- Página pública (sin login)
export interface PublicApproval {
  id: string
  studio_name: string | null
  client: { brand_name: string; color_tag: string | null; instagram_handle: string | null }
  expires_at: string
  decided_at: string | null
  decisions: Record<string, Decision>
  client_comment: string | null
  posts: {
    id: string
    format: PostFormat
    scheduled_at: string | null
    caption: string | null
    hashtags: string | null
    media: { media_type: 'imagen' | 'video'; url: string | null; cover_url: string | null; width: number | null; height: number | null }[]
  }[]
}

export class ApprovalLinkError extends Error {
  reason: 'no_existe' | 'vencido'
  constructor(reason: 'no_existe' | 'vencido') {
    super(reason === 'vencido' ? 'Este link venció.' : 'Este link no existe.')
    this.reason = reason
  }
}

async function callApproval<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().functions.invoke('approval', { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const msg = ctx ? await ctx.json().then((j: { error?: string }) => j.error).catch(() => null) : null
    if (msg === 'no_existe' || msg === 'vencido') throw new ApprovalLinkError(msg)
    throw new Error(msg || 'No pudimos conectarnos. Revisá tu conexión y probá de nuevo.')
  }
  return data as T
}

export async function getPublicApproval(token: string): Promise<PublicApproval> {
  if (isDemo) {
    await wait(400)
    const a = content.approvals.rows.find((x) => x.token_hash === token)
    if (!a) throw new ApprovalLinkError('no_existe')
    if (!a.decided_at && a.expires_at < new Date().toISOString()) throw new ApprovalLinkError('vencido')
    const c = db.clients.get(a.client_id)!
    return {
      id: a.id,
      studio_name: demo.settings.studio_name,
      client: { brand_name: c.brand_name, color_tag: c.color_tag, instagram_handle: c.instagram_handle },
      expires_at: a.expires_at,
      decided_at: a.decided_at,
      decisions: a.decisions as Record<string, Decision>,
      client_comment: a.client_comment,
      posts: a.post_ids
        .map((id) => content.posts.get(id))
        .filter((p): p is Tables<'content_posts'> => !!p && !p.deleted_at)
        .map((p) => ({
          id: p.id, format: p.format, scheduled_at: p.scheduled_at, caption: p.caption, hashtags: p.hashtags,
          media: content.media.rows
            .filter((m) => m.post_id === p.id)
            .sort((x, y) => x.position - y.position)
            .map((m) => ({ media_type: m.media_type, url: demoFiles.get(m.storage_path) ?? null, cover_url: null, width: m.width, height: m.height })),
        })),
    }
  }
  return callApproval<PublicApproval>({ action: 'get', token })
}

export async function submitPublicApproval(token: string, decisions: Record<string, Decision>, comment: string) {
  if (isDemo) {
    await wait(500)
    const a = content.approvals.rows.find((x) => x.token_hash === token)
    if (!a) throw new ApprovalLinkError('no_existe')
    if (a.decided_at) throw new Error('Este contenido ya fue respondido. ¡Gracias!')
    for (const id of a.post_ids) {
      const dcs = decisions[id]
      if (!dcs) throw new Error('Falta responder alguna publicación.')
      if (dcs.decision === 'cambios' && !dcs.comment?.trim()) throw new Error('Contanos qué cambiarías en cada publicación con cambios.')
      const p = content.posts.get(id)
      if (p) content.posts.update(id, { status: dcs.decision === 'aprobado' ? (p.status === 'programado' ? 'programado' : 'aprobado') : 'borrador' })
    }
    content.approvals.update(a.id, { decisions, client_comment: comment.trim() || null, decided_at: new Date().toISOString() })
    return
  }
  await callApproval({ action: 'submit', token, decisions, comment })
}
