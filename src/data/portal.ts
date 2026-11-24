// Fase 8: portal del cliente y accesos.
import { isDemo, sb } from '@/lib/supabase'
import { functionErrorMessage } from './api'
import { DEMO_USER_ID, demo } from './demo'
import { content } from './demo-db'
import type { Profile } from './types'

const wait = (ms = 250) => new Promise((r) => setTimeout(r, ms))

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().functions.invoke('portal-access', { body })
  if (error) throw new Error((await functionErrorMessage(error)) || 'No pudimos conectarnos con el servidor. Probá de nuevo en un rato.')
  return data as T
}

// ================================================================ Accesos (admin)
const demoAccess: Profile[] = [
  { ...demo.profiles[0], id: '00000000-0000-4000-a000-000000000901', full_name: 'Sofía Pereira', email: 'sofia@caferambla.uy', role: 'cliente', client_id: '00000000-0000-4000-a000-000000000001', is_active: true },
]

export async function listPortalAccess(clientId: string): Promise<Profile[]> {
  if (isDemo) {
    await wait()
    return demoAccess.filter((p) => p.client_id === clientId)
  }
  const { data, error } = await sb().from('profiles').select('*').eq('role', 'cliente').eq('client_id', clientId).order('created_at')
  if (error) throw error
  return data
}

export interface Credentials {
  email: string
  password: string
  existed?: boolean
}

export async function createPortalAccess(clientId: string, email: string, fullName: string): Promise<Credentials> {
  if (isDemo) {
    await wait(600)
    demoAccess.push({ ...demoAccess[0], id: crypto.randomUUID(), email, full_name: fullName, client_id: clientId, is_active: true })
    return { email, password: 'Faro-mate-4821' }
  }
  return invoke<Credentials>({ action: 'create', clientId, email, fullName })
}

export async function resetPortalAccess(userId: string): Promise<Credentials> {
  if (isDemo) {
    await wait(600)
    return { email: demoAccess.find((p) => p.id === userId)?.email ?? '', password: 'Ola-ceibo-7730' }
  }
  return invoke<Credentials>({ action: 'reset', userId })
}

export async function setPortalActive(userId: string, active: boolean) {
  if (isDemo) {
    const p = demoAccess.find((x) => x.id === userId)
    if (p) p.is_active = active
    return
  }
  const { error } = await sb().from('profiles').update({ is_active: active }).eq('id', userId)
  if (error) throw error
}

// ================================================================ Desde el portal
/** El cliente aprueba o pide cambios en una publicación que está "En aprobación". */
export async function decidePost(postId: string, decision: 'aprobado' | 'cambios', comment: string) {
  if (isDemo) {
    await wait(500)
    const p = content.posts.get(postId)
    if (!p || p.status !== 'en_aprobacion') throw new Error('Esta publicación ya no está esperando tu aprobación.')
    if (decision === 'cambios' && !comment.trim()) throw new Error('Contanos qué cambiarías.')
    content.posts.update(postId, { status: decision === 'aprobado' ? 'aprobado' : 'borrador' })
    content.approvals.insert({
      client_id: p.client_id!, token_hash: `portal:${Date.now()}`, post_ids: [postId], decisions: { [postId]: { decision, comment: comment.trim() } },
      client_comment: null, decided_at: new Date().toISOString(), expires_at: new Date().toISOString(), created_by: DEMO_USER_ID,
    })
    return
  }
  const { error } = await sb().rpc('portal_decide_post', { p_post_id: postId, p_decision: decision, p_comment: comment })
  if (error) throw error
}

export async function studioName(): Promise<string> {
  if (isDemo) return demo.settings.studio_name
  const { data } = await sb().rpc('studio_public')
  return (data as { studio_name?: string } | null)?.studio_name ?? 'AM Creators'
}

/** Estados que ve el cliente (los borradores e ideas quedan para el estudio). */
export const PORTAL_STATUSES = ['en_aprobacion', 'aprobado', 'programado', 'publicado'] as const
