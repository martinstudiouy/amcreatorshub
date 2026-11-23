// Acceso a datos. Cada función trabaja contra Supabase o, en modo demo,
// contra los datos de ejemplo en memoria. Las pantallas no saben la diferencia.
import { isDemo, sb } from '@/lib/supabase'
import type { TablesUpdate } from '@/types/database'
import { DEMO_USER_ID, demo, demoDashboard } from './demo'
import type { DashboardSummary, ExchangeRate, Notification, Profile, Role, SearchResult, Settings } from './types'

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms))

/** Traduce los errores de Supabase/Postgres a mensajes entendibles. */
export function friendlyError(err: unknown): string {
  const e = err as { message?: string; code?: string } | null
  const msg = e?.message ?? ''
  if (e?.code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return /Solo un admin|admin activo/.test(msg) ? msg : 'No tenés permiso para hacer esto.'
  }
  if (e?.code === '23505') return 'Ya existe un registro con esos datos.'
  if (/Invalid login credentials/i.test(msg)) return 'El email o la contraseña no son correctos.'
  if (/Email not confirmed/i.test(msg)) return 'Todavía no confirmaste tu email. Revisá tu casilla.'
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'No hay conexión con el servidor. Revisá tu internet y probá de nuevo.'
  if (/Password should be at least/i.test(msg)) return 'La contraseña tiene que tener al menos 8 caracteres.'
  return msg || 'Algo salió mal. Probá de nuevo en un momento.'
}

function check<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

// ------------------------------------------------------------------ Modo demo
let demoRole: Role = 'admin'
export const setDemoRole = (r: Role) => {
  demoRole = r
}
export const getDemoRole = () => demoRole

// ------------------------------------------------------------------ Perfil
export async function getMyProfile(userId: string): Promise<Profile | null> {
  if (isDemo) {
    await wait(100)
    const base = demo.profiles.find((p) => p.id === DEMO_USER_ID)!
    return { ...base, role: demoRole, client_id: demoRole === 'cliente' ? '00000000-0000-4000-a000-000000000001' : null }
  }
  return check(await sb().from('profiles').select('*').eq('id', userId).maybeSingle())
}

export async function updateMyProfile(userId: string, patch: Pick<TablesUpdate<'profiles'>, 'full_name' | 'phone'>) {
  if (isDemo) {
    await wait()
    Object.assign(demo.profiles.find((p) => p.id === DEMO_USER_ID)!, patch)
    return
  }
  check(await sb().from('profiles').update(patch).eq('id', userId))
}

// ------------------------------------------------------------------ Dashboard
export async function getDashboard(): Promise<DashboardSummary> {
  if (isDemo) {
    await wait(500)
    return demoDashboard(demoRole)
  }
  return check(await sb().rpc('dashboard_summary')) as unknown as DashboardSummary
}

// ------------------------------------------------------------------ Búsqueda global
export async function globalSearch(q: string): Promise<SearchResult[]> {
  const term = q.trim()
  if (term.length < 2) return []
  if (isDemo) {
    await wait(150)
    const t = term.toLowerCase()
    const { db } = await import('./demo-db')
    const hit = (...xs: (string | null)[]) => xs.some((x) => x?.toLowerCase().includes(t))
    const clients = db.clients.rows
      .filter((c) => !c.deleted_at && hit(c.brand_name, c.name, c.instagram_handle, c.email))
      .map((c): SearchResult => ({ kind: 'cliente', id: c.id, title: c.brand_name, subtitle: [c.name, c.industry].filter(Boolean).join(' · '), link: `/clientes/${c.id}` }))
    const projects = db.projects.rows
      .filter((p) => !p.deleted_at && hit(p.name, db.clients.get(p.client_id)?.brand_name ?? null))
      .map((p): SearchResult => ({ kind: 'proyecto', id: p.id, title: p.name, subtitle: db.clients.get(p.client_id)?.brand_name ?? '', link: `/proyectos/${p.id}` }))
    const posts = demo.searchIndex.filter((r) => r.kind === 'publicacion' && `${r.title} ${r.subtitle}`.toLowerCase().includes(t))
    return [...clients.slice(0, 6), ...projects.slice(0, 6), ...posts]
  }
  return check(await sb().rpc('global_search', { q: term })) as SearchResult[]
}

// ------------------------------------------------------------------ Notificaciones
export async function listNotifications(userId: string): Promise<Notification[]> {
  if (isDemo) {
    await wait(150)
    return [...demo.notifications].sort((a, b) => b.created_at.localeCompare(a.created_at))
  }
  return check(
    await sb().from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
  )
}

export async function markNotificationRead(id: string) {
  if (isDemo) {
    const n = demo.notifications.find((x) => x.id === id)
    if (n && !n.read_at) n.read_at = new Date().toISOString()
    return
  }
  check(await sb().from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id))
}

export async function markAllNotificationsRead() {
  if (isDemo) {
    demo.notifications.forEach((n) => (n.read_at ??= new Date().toISOString()))
    return
  }
  check(await sb().rpc('mark_all_notifications_read'))
}

/** Escucha notificaciones nuevas en tiempo real. Devuelve la función para dejar de escuchar. */
export function subscribeToNotifications(userId: string, onNew: () => void): () => void {
  if (isDemo) return () => {}
  const channel = sb()
    .channel(`notifications:${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, onNew)
    .subscribe()
  return () => {
    void sb().removeChannel(channel)
  }
}

// ------------------------------------------------------------------ Configuración
export async function getSettings(): Promise<Settings> {
  if (isDemo) {
    await wait()
    return { ...demo.settings }
  }
  return check(await sb().from('settings').select('*').single())
}

export async function updateSettings(patch: TablesUpdate<'settings'>) {
  if (isDemo) {
    await wait()
    Object.assign(demo.settings, patch)
    return
  }
  check(await sb().from('settings').update(patch).eq('id', true))
}

// ------------------------------------------------------------------ Equipo
export async function listTeam(): Promise<Profile[]> {
  if (isDemo) {
    await wait()
    return demo.profiles.map((p) => (p.id === DEMO_USER_ID ? { ...p, role: demoRole } : p))
  }
  return check(await sb().from('profiles').select('*').neq('role', 'cliente').order('full_name'))
}

export async function updateTeamMember(id: string, patch: Pick<TablesUpdate<'profiles'>, 'role' | 'is_active'>) {
  if (isDemo) {
    await wait()
    const p = demo.profiles.find((x) => x.id === id)!
    const remainingAdmins = demo.profiles.filter((x) => x.id !== id && x.role === 'admin' && x.is_active)
    const losesAdmin = p.role === 'admin' && (patch.role === 'equipo' || patch.is_active === false)
    if (losesAdmin && remainingAdmins.length === 0) throw new Error('Tiene que quedar al menos un admin activo.')
    Object.assign(p, patch)
    return
  }
  check(await sb().from('profiles').update(patch).eq('id', id))
}

// ------------------------------------------------------------------ Tipo de cambio
export async function listExchangeRates(): Promise<ExchangeRate[]> {
  if (isDemo) {
    await wait()
    return [...demo.exchangeRates].sort((a, b) => b.date.localeCompare(a.date))
  }
  return check(await sb().from('exchange_rates').select('*').order('date', { ascending: false }).limit(60))
}

export async function upsertExchangeRate(input: { date: string; usd_to_uyu: number; note?: string | null }) {
  if (isDemo) {
    await wait()
    const existing = demo.exchangeRates.find((r) => r.date === input.date)
    if (existing) Object.assign(existing, input, { updated_at: new Date().toISOString() })
    else
      demo.exchangeRates.push({
        id: crypto.randomUUID(),
        note: null,
        created_by: DEMO_USER_ID,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...input,
      })
    return
  }
  check(await sb().from('exchange_rates').upsert(input, { onConflict: 'date' }))
}

export async function deleteExchangeRate(id: string) {
  if (isDemo) {
    demo.exchangeRates = demo.exchangeRates.filter((r) => r.id !== id)
    return
  }
  check(await sb().from('exchange_rates').delete().eq('id', id))
}

/** Mensaje legible de un error de Edge Function (respuesta con error, sin conexión o caída). */
export async function functionErrorMessage(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: unknown }).context
  if (ctx && typeof (ctx as Response).json === 'function') {
    try {
      const j = (await (ctx as Response).clone().json()) as { error?: string; message?: string }
      return j.error ?? j.message ?? null
    } catch {
      return null
    }
  }
  return null
}
