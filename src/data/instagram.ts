// Fase 6: cuentas de Instagram, métricas y publicación automática.
import { isDemo, sb } from '@/lib/supabase'
import type { Tables } from '@/types/database'
import { db } from './demo-db'
import { content } from './demo-db'

export type SocialAccount = Tables<'social_accounts'> & { client_name: string | null; client_color: string | null }
export type DailyMetric = Tables<'ig_metrics_daily'>
export type PostMetric = Tables<'ig_post_metrics'>

const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms))
function check<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

/** Llama a una Edge Function y devuelve el mensaje de error en castellano si falla. */
async function invoke<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().functions.invoke(name, { body })
  if (error) {
    const ctx = (error as { context?: Response }).context
    const msg = ctx ? await ctx.json().then((j: { error?: string }) => j.error).catch(() => null) : null
    throw new Error(msg || 'No pudimos conectarnos con el servidor. Probá de nuevo en un rato.')
  }
  return data as T
}

const DEMO_MSG = 'En la demo no se puede conectar Instagram de verdad. En la app real te lleva a Instagram para autorizar.'

// ================================================================ Cuentas
export async function listAccounts(): Promise<SocialAccount[]> {
  if (isDemo) {
    await wait()
    return demoIg.accounts.map((a) => {
      const c = a.client_id ? db.clients.get(a.client_id) : null
      return { ...a, client_name: c?.brand_name ?? null, client_color: c?.color_tag ?? null }
    })
  }
  const rows = check(
    await sb().from('social_accounts').select('*, client:clients(brand_name, color_tag)').eq('platform', 'instagram').order('created_at'),
  ) as unknown as (Tables<'social_accounts'> & { client: { brand_name: string; color_tag: string | null } | null })[]
  return rows.map(({ client, ...a }) => ({ ...a, client_name: client?.brand_name ?? null, client_color: client?.color_tag ?? null }))
}

export async function startInstagramConnect(clientId?: string | null): Promise<string> {
  if (isDemo) throw new Error(DEMO_MSG)
  const { url } = await invoke<{ url: string }>('instagram-oauth', { action: 'start', clientId: clientId ?? null })
  return url
}

export async function disconnectAccount(accountId: string) {
  if (isDemo) {
    await wait()
    const a = demoIg.accounts.find((x) => x.id === accountId)
    if (a) Object.assign(a, { status: 'desconectada', token_expires_at: null })
    return
  }
  await invoke('instagram-oauth', { action: 'disconnect', accountId })
}

/** Asigna la cuenta a un cliente (o la deja como cuenta propia del estudio). */
export async function assignAccount(accountId: string, clientId: string | null) {
  if (isDemo) {
    const a = demoIg.accounts.find((x) => x.id === accountId)
    if (a) a.client_id = clientId
    return
  }
  check(await sb().from('social_accounts').update({ client_id: clientId }).eq('id', accountId))
}

export async function syncInstagramNow(accountId?: string) {
  if (isDemo) {
    await wait(900)
    return
  }
  await invoke('instagram-oauth', { action: 'sync', accountId })
}

/** "Publicar ahora": la pasa a Programado y la publica en el momento. */
export async function publishNow(postId: string): Promise<'publicado' | 'procesando'> {
  if (isDemo) {
    await wait(1200)
    const p = content.posts.get(postId)
    if (p) content.posts.update(postId, { status: 'publicado', published_at: new Date().toISOString(), scheduled_at: p.scheduled_at ?? new Date().toISOString(), ig_media_id: `demo${Date.now()}`, ig_permalink: 'https://www.instagram.com/' })
    return 'publicado'
  }
  const r = await invoke<{ results: { status: string }[] }>('instagram-publish', { postId })
  return r.results[0]?.status === 'publicado' ? 'publicado' : 'procesando'
}

// ================================================================ Métricas
export async function listDailyMetrics(accountId: string, from: string, to: string): Promise<DailyMetric[]> {
  if (isDemo) {
    await wait()
    return demoIg.daily.filter((d) => d.social_account_id === accountId && d.date >= from && d.date <= to)
  }
  return check(await sb().from('ig_metrics_daily').select('*').eq('social_account_id', accountId).gte('date', from).lte('date', to).order('date'))
}

/** Última foto de las métricas de cada publicación hecha entre `from` y `to` (fechas ISO). */
export async function listPostMetrics(accountId: string, from: string, to: string): Promise<PostMetric[]> {
  let rows: PostMetric[]
  if (isDemo) {
    await wait()
    rows = demoIg.posts.filter((p) => p.social_account_id === accountId && p.posted_at! >= from && p.posted_at! < to)
  } else {
    rows = check(
      await sb()
        .from('ig_post_metrics')
        .select('*')
        .eq('social_account_id', accountId)
        .gte('posted_at', from)
        .lt('posted_at', to)
        .order('snapshot_date', { ascending: false })
        .limit(2000),
    )
  }
  const latest = new Map<string, PostMetric>()
  for (const r of rows) if (!latest.has(r.ig_media_id) || r.snapshot_date > latest.get(r.ig_media_id)!.snapshot_date) latest.set(r.ig_media_id, r)
  return [...latest.values()].sort((a, b) => (b.posted_at ?? '').localeCompare(a.posted_at ?? ''))
}

// ================================================================ Datos de la demo
const uuid = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`
function rand(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}
function thumb(seed: number, from: string, to: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><circle cx="${100 + (seed % 5) * 50}" cy="${120 + (seed % 3) * 80}" r="90" fill="#fff" fill-opacity=".12"/></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

const demoIg = (() => {
  const now = new Date()
  const today = new Date(now.getTime() - 3 * 3600_000).toISOString().slice(0, 10)
  const day = (n: number) => {
    const d = new Date(`${today}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() - n)
    return d.toISOString().slice(0, 10)
  }
  const base = { platform: 'instagram' as const, scopes: ['instagram_business_basic', 'instagram_business_content_publish', 'instagram_business_manage_insights'], vault_secret_id: null, connected_by: null, last_error: null, created_at: now.toISOString(), updated_at: now.toISOString(), token_refreshed_at: now.toISOString(), last_synced_at: new Date(now.getTime() - 5 * 3600_000).toISOString(), profile_picture_url: null }
  const expires = (d: number) => new Date(now.getTime() + d * 864e5).toISOString()
  const accounts: Tables<'social_accounts'>[] = [
    { ...base, id: uuid(501), client_id: null, external_id: '17841400000000001', username: 'amcreators.uy', display_name: 'AM Creators', account_type: 'business', token_expires_at: expires(48), status: 'conectada', followers_count: 2310 },
    { ...base, id: uuid(502), client_id: uuid(1), external_id: '17841400000000002', username: 'caferambla', display_name: 'Café Rambla', account_type: 'business', token_expires_at: expires(55), status: 'conectada', followers_count: 8420 },
    { ...base, id: uuid(503), client_id: uuid(2), external_id: '17841400000000003', username: 'pilatespocitos', display_name: 'Pilates Pocitos', account_type: 'creator', token_expires_at: expires(5), status: 'por_vencer', followers_count: 3115 },
  ]
  const daily: DailyMetric[] = []
  const posts: PostMetric[] = []
  const colors: [string, string][] = [['#0300FF', '#020061'], ['#0300FF', '#000000'], ['#16A34A', '#064E3B']]
  const captions = ['Detrás de escena de la sesión', 'Nuevo servicio: contenido mensual', 'Antes y después', '3 tips para tu marca', 'Conocé al equipo', 'Promo de la semana', 'Lanzamiento', 'Pregunta frecuente', 'Un día en el estudio', 'Resultados del mes']
  accounts.forEach((a, ai) => {
    const r = rand(ai * 977 + 13)
    // Serie de seguidores que termina justo en el número actual
    const steps = Array.from({ length: 121 }, () => Math.round(r() * 6 - 1.6))
    let followers = a.followers_count! - steps.reduce((x, y) => x + y, 0)
    for (let i = 120; i >= 0; i--) {
      followers += steps[120 - i]
      const reach = Math.round((a.followers_count! * 0.25) * (0.6 + r() * 0.9) * (i % 7 === 2 ? 1.6 : 1))
      const inter = Math.round(reach * (0.03 + r() * 0.05))
      daily.push({
        id: uuid(10_000 + ai * 1000 + i), social_account_id: a.id, date: day(i), followers, follows: 300 + ai * 20,
        reach: i === 0 ? null : reach, views: i === 0 ? null : Math.round(reach * (1.8 + r())), interactions: i === 0 ? null : inter,
        accounts_engaged: i === 0 ? null : Math.round(inter * 0.7), profile_views: null, link_clicks: i === 0 ? null : Math.round(r() * 12),
        engagement_rate: i === 0 ? null : Math.round((inter / reach) * 100_000) / 1000, created_at: now.toISOString(), updated_at: now.toISOString(),
      })
    }
    for (let k = 0; k < 34; k++) {
      const ago = Math.floor(k * 2.6) + 1
      const hour = [9, 12, 13, 18, 19, 20, 21][Math.floor(r() * 7)]
      const posted = new Date(`${day(ago)}T${String(hour).padStart(2, '0')}:${r() < 0.5 ? '00' : '30'}:00-03:00`).toISOString()
      const type = r() < 0.4 ? 'VIDEO' : r() < 0.5 ? 'CAROUSEL_ALBUM' : 'IMAGE'
      const boost = (hour >= 18 && hour <= 20 ? 1.5 : 1) * (type === 'VIDEO' ? 1.7 : 1)
      const reach = Math.round(a.followers_count! * (0.2 + r() * 0.35) * boost)
      const likes = Math.round(reach * (0.04 + r() * 0.05))
      const comments = Math.round(likes * (0.03 + r() * 0.08))
      const saves = Math.round(likes * (0.05 + r() * 0.2))
      const shares = Math.round(likes * (0.02 + r() * 0.1))
      posts.push({
        id: uuid(20_000 + ai * 1000 + k), social_account_id: a.id, ig_media_id: `${a.external_id}${k}`, content_post_id: null, media_type: type,
        media_product_type: type === 'VIDEO' ? 'REELS' : 'FEED', permalink: 'https://www.instagram.com/', caption: captions[k % captions.length], posted_at: posted,
        snapshot_date: today, reach, views: Math.round(reach * (type === 'VIDEO' ? 2.4 : 1.4)), likes, comments, saves, shares, interactions: likes + comments + saves + shares,
        thumbnail_url: thumb(k, ...colors[(k + ai) % colors.length]), created_at: now.toISOString(), updated_at: now.toISOString(),
      })
    }
  })
  return { accounts, daily, posts }
})()
