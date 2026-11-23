// Instagram API con Instagram Login (graph.instagram.com).
// Todo lo que habla con Instagram vive acá: tokens, métricas y publicación.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { env } from './http.ts'

export const IG_GRAPH = 'https://graph.instagram.com/v25.0'
export const IG_SCOPES = ['instagram_business_basic', 'instagram_business_content_publish', 'instagram_business_manage_insights']

export class IgError extends Error {
  constructor(
    message: string,
    public code?: number,
    public subcode?: number,
    public status?: number,
  ) {
    super(message)
  }
  /** Token vencido, revocado o sin permisos: hay que reconectar la cuenta. */
  get isAuth() {
    return this.code === 190 || this.code === 102 || this.code === 10 || this.status === 401
  }
  /** Errores pasajeros de Meta (reintentar más tarde). */
  get isTransient() {
    return this.code === 1 || this.code === 2 || this.code === 4 || this.code === 17 || this.code === 32 || this.code === 341 || (this.status ?? 0) >= 500
  }
}

/** GET o POST a la Graph API de Instagram, con errores legibles. */
export async function ig<T = Record<string, unknown>>(path: string, token: string, params: Record<string, string | number | boolean | undefined> = {}, method: 'GET' | 'POST' = 'GET'): Promise<T> {
  const url = new URL(path.startsWith('http') ? path : `${IG_GRAPH}/${path.replace(/^\//, '')}`)
  const body = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined) (method === 'GET' ? url.searchParams : body).set(k, String(v))
  if (method === 'GET') url.searchParams.set('access_token', token)
  else body.set('access_token', token)
  const res = await fetch(url, method === 'POST' ? { method, body } : undefined)
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) {
    const e = data.error ?? {}
    throw new IgError(e.error_user_msg || e.message || `Instagram respondió ${res.status}`, e.code, e.error_subcode, res.status)
  }
  return data as T
}

// ================================================================ Tokens
export interface Account {
  id: string
  client_id: string | null
  external_id: string
  username: string | null
  status: string
  token_expires_at: string | null
  token_refreshed_at: string | null
  last_synced_at: string | null
}

export async function getToken(admin: SupabaseClient, accountId: string): Promise<string> {
  const { data, error } = await admin.rpc('get_social_token', { p_account_id: accountId })
  if (error || !data) throw new IgError('La cuenta no tiene un token guardado. Conectala de nuevo.', 190)
  return data as string
}

/** Cambia el código de autorización por un token largo (60 días). */
export async function exchangeCode(code: string, redirectUri: string) {
  const form = new FormData()
  form.set('client_id', env('INSTAGRAM_APP_ID'))
  form.set('client_secret', env('INSTAGRAM_APP_SECRET'))
  form.set('grant_type', 'authorization_code')
  form.set('redirect_uri', redirectUri)
  form.set('code', code.replace(/#_$/, ''))
  const res = await fetch('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form })
  const short = await res.json().catch(() => ({}))
  if (!res.ok || !short.access_token) throw new IgError(short.error_message || short.error?.message || 'Instagram rechazó la conexión.', short.code, undefined, res.status)
  const long = await ig<{ access_token: string; expires_in: number }>('https://graph.instagram.com/access_token', short.access_token, {
    grant_type: 'ig_exchange_token',
    client_secret: env('INSTAGRAM_APP_SECRET'),
  })
  const permissions: string[] = Array.isArray(short.permissions) ? short.permissions : String(short.permissions ?? '').split(',').filter(Boolean)
  return { token: long.access_token, expiresAt: new Date(Date.now() + long.expires_in * 1000).toISOString(), permissions }
}

/** Renueva el token si vence en menos de 15 días (Instagram pide que tenga al menos 24 h). */
export async function refreshIfNeeded(admin: SupabaseClient, acc: Account, token: string): Promise<string> {
  const expires = acc.token_expires_at ? new Date(acc.token_expires_at).getTime() : 0
  const refreshedAt = acc.token_refreshed_at ? new Date(acc.token_refreshed_at).getTime() : 0
  if (expires - Date.now() > 15 * 864e5 || Date.now() - refreshedAt < 864e5) return token
  try {
    const r = await ig<{ access_token: string; expires_in: number }>('https://graph.instagram.com/refresh_access_token', token, { grant_type: 'ig_refresh_token' })
    await admin.rpc('update_social_token', { p_account_id: acc.id, p_token: r.access_token, p_expires_at: new Date(Date.now() + r.expires_in * 1000).toISOString() })
    return r.access_token
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    const soon = expires - Date.now() < 7 * 864e5
    await admin.from('social_accounts').update({ status: soon ? 'por_vencer' : 'conectada', last_error: `No se pudo renovar el acceso: ${msg}` }).eq('id', acc.id)
    return token
  }
}

/** Marca la cuenta como desconectada y avisa al equipo. */
export async function markDisconnected(admin: SupabaseClient, acc: Pick<Account, 'id' | 'username'>, reason: string) {
  await admin.from('social_accounts').update({ status: 'desconectada', last_error: reason }).eq('id', acc.id)
  await notifyStaff(admin, `Instagram @${acc.username ?? ''} se desconectó`, 'Hay que conectarla de nuevo en Configuración → Integraciones.', '/configuracion?tab=integraciones', 'cuenta')
}

export async function notifyStaff(admin: SupabaseClient, title: string, body: string, link: string, type = 'instagram', onlyUser?: string | null) {
  let q = admin.from('profiles').select('id').in('role', ['admin', 'equipo']).eq('is_active', true)
  if (onlyUser) q = q.eq('id', onlyUser)
  const { data } = await q
  if (data?.length) await admin.from('notifications').insert(data.map((p) => ({ user_id: p.id, type, title, body, link })))
}

// ================================================================ Fechas en Montevideo (UTC-3, sin horario de verano)
const MVD_OFFSET = -3 * 3600_000
export const mvdDate = (d = new Date()) => new Date(d.getTime() + MVD_OFFSET).toISOString().slice(0, 10)
export const addDaysKey = (day: string, n: number) => {
  const d = new Date(`${day}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
/** Inicio del día de Montevideo en segundos Unix. */
export const mvdDayStart = (day: string) => Math.floor(new Date(`${day}T00:00:00-03:00`).getTime() / 1000)

// ================================================================ Métricas
const ACCOUNT_METRICS = ['reach', 'views', 'accounts_engaged', 'total_interactions', 'profile_links_taps']
const MEDIA_METRICS = ['reach', 'views', 'likes', 'comments', 'saved', 'shares', 'total_interactions']

type InsightRow = { name: string; total_value?: { value: number }; values?: { value: number }[] }

/** Pide métricas; si alguna no está disponible, las pide de a una y saltea las que fallan. */
async function insights(path: string, token: string, metrics: string[], params: Record<string, string | number> = {}) {
  const read = (rows: InsightRow[]) => Object.fromEntries(rows.map((r) => [r.name, r.total_value?.value ?? r.values?.[0]?.value ?? null]))
  try {
    const r = await ig<{ data: InsightRow[] }>(path, token, { metric: metrics.join(','), ...params })
    return read(r.data)
  } catch (e) {
    if (e instanceof IgError && (e.isAuth || e.isTransient)) throw e
    const out: Record<string, number | null> = {}
    for (const m of metrics) {
      try {
        Object.assign(out, read((await ig<{ data: InsightRow[] }>(path, token, { metric: m, ...params })).data))
      } catch (err) {
        if (err instanceof IgError && (err.isAuth || err.isTransient)) throw err
      }
    }
    return out
  }
}

/** Sincroniza perfil, métricas de los últimos `days` días y de las publicaciones recientes. */
export async function syncAccount(admin: SupabaseClient, acc: Account, days = 2) {
  let token = await getToken(admin, acc.id)
  token = await refreshIfNeeded(admin, acc, token)
  const today = mvdDate()

  // Perfil y seguidores de hoy
  const me = await ig<{ user_id?: string; username?: string; name?: string; profile_picture_url?: string; followers_count?: number; follows_count?: number }>('me', token, {
    fields: 'user_id,username,name,profile_picture_url,followers_count,follows_count,media_count',
  })
  await admin
    .from('social_accounts')
    .update({ username: me.username, display_name: me.name ?? null, profile_picture_url: me.profile_picture_url ?? null, followers_count: me.followers_count ?? null, last_synced_at: new Date().toISOString(), last_error: null, ...(acc.status === 'desconectada' ? {} : { status: acc.status === 'por_vencer' ? 'por_vencer' : 'conectada' }) })
    .eq('id', acc.id)
  await admin.from('ig_metrics_daily').upsert({ social_account_id: acc.id, date: today, followers: me.followers_count ?? null, follows: me.follows_count ?? null }, { onConflict: 'social_account_id,date' })

  // Métricas de cada día cerrado (ayer hacia atrás)
  for (let i = 1; i <= days; i++) {
    const day = addDaysKey(today, -i)
    const m = await insights('me/insights', token, ACCOUNT_METRICS, { period: 'day', metric_type: 'total_value', since: mvdDayStart(day), until: mvdDayStart(addDaysKey(day, 1)) })
    const reach = m.reach ?? null
    const interactions = m.total_interactions ?? null
    await admin.from('ig_metrics_daily').upsert(
      {
        social_account_id: acc.id,
        date: day,
        reach,
        views: m.views ?? null,
        interactions,
        accounts_engaged: m.accounts_engaged ?? null,
        link_clicks: m.profile_links_taps ?? null,
        engagement_rate: reach && interactions != null ? Math.round((interactions / reach) * 100_000) / 1000 : null,
      },
      { onConflict: 'social_account_id,date' },
    )
  }

  // Publicaciones de los últimos 90 días
  const media = await ig<{ data: Media[] }>('me/media', token, { fields: 'id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url', limit: 50 })
  const since = Date.now() - 90 * 864e5
  const recent = media.data.filter((m) => new Date(m.timestamp).getTime() >= since && m.media_product_type !== 'STORY')
  const ids = recent.map((m) => m.id)
  const { data: linked } = ids.length ? await admin.from('content_posts').select('id, ig_media_id').in('ig_media_id', ids) : { data: [] }
  const byMedia = new Map((linked ?? []).map((p) => [p.ig_media_id, p.id]))
  const rows = []
  for (const m of recent) {
    let mi: Record<string, number | null> = {}
    try {
      mi = await insights(`${m.id}/insights`, token, MEDIA_METRICS)
    } catch (e) {
      if (e instanceof IgError && e.isAuth) throw e
    }
    const likes = mi.likes ?? m.like_count ?? null
    const comments = mi.comments ?? m.comments_count ?? null
    rows.push({
      social_account_id: acc.id,
      ig_media_id: m.id,
      content_post_id: byMedia.get(m.id) ?? null,
      media_type: m.media_type,
      media_product_type: m.media_product_type ?? null,
      permalink: m.permalink ?? null,
      caption: m.caption?.slice(0, 500) ?? null,
      posted_at: m.timestamp,
      snapshot_date: today,
      reach: mi.reach ?? null,
      views: mi.views ?? null,
      likes,
      comments,
      saves: mi.saved ?? null,
      shares: mi.shares ?? null,
      interactions: mi.total_interactions ?? (likes ?? 0) + (comments ?? 0) + (mi.saved ?? 0) + (mi.shares ?? 0),
      thumbnail_url: m.thumbnail_url ?? (m.media_type === 'VIDEO' ? null : (m.media_url ?? null)),
    })
  }
  if (rows.length) await admin.from('ig_post_metrics').upsert(rows, { onConflict: 'ig_media_id,snapshot_date' })
  return { media: rows.length }
}

type Media = { id: string; caption?: string; media_type: string; media_product_type?: string; permalink?: string; timestamp: string; like_count?: number; comments_count?: number; thumbnail_url?: string; media_url?: string }

// ================================================================ Publicación
export interface PostRow {
  id: string
  client_id: string
  social_account_id: string | null
  format: 'feed' | 'carrusel' | 'reel' | 'story'
  caption: string | null
  hashtags: string | null
  publish_attempts: number
  ig_container: { children?: string[]; parent?: string | null; created_at?: string } | null
  created_by: string | null
}
export interface MediaRow {
  storage_path: string
  media_type: 'imagen' | 'video'
  position: number
}

export const fullCaption = (p: Pick<PostRow, 'caption' | 'hashtags'>) => [p.caption?.trim(), p.hashtags?.trim()].filter(Boolean).join('\n\n')

/** Qué contenedores hay que crear para cada formato. */
export function containerPlan(format: PostRow['format'], media: Pick<MediaRow, 'media_type' | 'storage_path'>[]) {
  if (!media.length) throw new IgError('La publicación no tiene archivos.')
  const notJpeg = media.find((m) => m.media_type === 'imagen' && !/\.jpe?g$/i.test(m.storage_path))
  if (notJpeg) throw new IgError('Instagram solo acepta imágenes JPG. Volvé a subir la imagen (la app ahora la convierte sola).')
  if (format === 'carrusel') {
    if (media.length < 2 || media.length > 10) throw new IgError('Un carrusel tiene que tener entre 2 y 10 archivos.')
    return { kind: 'carousel' as const }
  }
  if (media.length > 1) throw new IgError(`Un ${format} lleva un solo archivo. Si son varios, cambiá el formato a Carrusel.`)
  const m = media[0]
  if (format === 'story') return { kind: 'single' as const, params: m.media_type === 'video' ? { media_type: 'STORIES', video: true } : { media_type: 'STORIES', video: false } }
  if (format === 'reel' && m.media_type !== 'video') throw new IgError('Un reel tiene que ser un video.')
  if (m.media_type === 'video') return { kind: 'single' as const, params: { media_type: 'REELS', video: true } }
  return { kind: 'single' as const, params: { media_type: undefined, video: false } }
}

type Step = { done: true; mediaId: string } | { done: false; container: NonNullable<PostRow['ig_container']> }

async function containerStatus(id: string, token: string) {
  const r = await ig<{ status_code?: string; status?: string }>(id, token, { fields: 'status_code,status' })
  return { code: r.status_code ?? 'IN_PROGRESS', detail: r.status ?? '' }
}

async function waitFinished(ids: string[], token: string, deadline: number) {
  while (true) {
    const st = await Promise.all(ids.map((id) => containerStatus(id, token)))
    const bad = st.find((s) => s.code === 'ERROR' || s.code === 'EXPIRED')
    if (bad) throw new IgError(bad.code === 'EXPIRED' ? 'EXPIRED' : `Instagram no pudo procesar el archivo${bad.detail ? ` (${bad.detail})` : ''}. Revisá el formato y la duración.`)
    if (st.every((s) => s.code === 'FINISHED' || s.code === 'PUBLISHED')) return true
    if (Date.now() + 4000 > deadline) return false
    await new Promise((r) => setTimeout(r, 3000))
  }
}

/**
 * Avanza la publicación todo lo que se pueda hasta `deadline`.
 * Si los videos siguen procesándose, devuelve el estado para seguir en el próximo minuto.
 */
export async function publishStep(post: PostRow, media: (MediaRow & { url: string })[], token: string, deadline: number): Promise<Step> {
  const plan = containerPlan(post.format, media)
  const caption = post.format === 'story' ? undefined : fullCaption(post)
  const c = { ...(post.ig_container ?? {}) }

  if (!c.children?.length) {
    if (plan.kind === 'carousel') {
      c.children = []
      for (const m of media) {
        const r = await ig<{ id: string }>('me/media', token, m.media_type === 'video' ? { media_type: 'VIDEO', video_url: m.url, is_carousel_item: true } : { image_url: m.url, is_carousel_item: true }, 'POST')
        c.children.push(r.id)
      }
    } else {
      const m = media[0]
      const r = await ig<{ id: string }>(
        'me/media',
        token,
        { media_type: plan.params.media_type, [plan.params.video ? 'video_url' : 'image_url']: m.url, caption, ...(plan.params.media_type === 'REELS' ? { share_to_feed: true } : {}) },
        'POST',
      )
      c.children = [r.id]
      c.parent = r.id
    }
    c.created_at = new Date().toISOString()
  }

  if (plan.kind === 'carousel' && !c.parent) {
    if (!(await waitFinished(c.children, token, deadline))) return { done: false, container: c }
    const r = await ig<{ id: string }>('me/media', token, { media_type: 'CAROUSEL', children: c.children.join(','), caption }, 'POST')
    c.parent = r.id
  }

  if (!(await waitFinished([c.parent!], token, deadline))) return { done: false, container: c }
  const published = await ig<{ id: string }>('me/media_publish', token, { creation_id: c.parent! }, 'POST')
  return { done: true, mediaId: published.id }
}
