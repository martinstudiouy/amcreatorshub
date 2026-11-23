import { functionErrorMessage } from './api'
// Fase 3: agenda y Google Calendar.
import { isDemo, sb } from '@/lib/supabase'
import type { Tables, TablesInsert, TablesUpdate } from '@/types/database'
import { DEMO_USER_ID, demo } from './demo'
import { db } from './demo-db'

export type CalendarEvent = Tables<'events_overview'>
export type EventInput = Pick<
  TablesInsert<'events'>,
  'client_id' | 'type' | 'title' | 'starts_at' | 'ends_at' | 'all_day' | 'location' | 'meet_url' | 'notes' | 'attendee_ids' | 'remind_minutes_before' | 'whatsapp_reminder' | 'create_meet'
>

export interface GoogleStatus {
  connected: boolean
  email?: string
  status?: 'conectado' | 'desconectado'
  last_synced_at?: string | null
  last_error?: string | null
  is_mine?: boolean
  pending?: number
}

const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms))
function check<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

function demoOverview(e: Tables<'events'>): CalendarEvent {
  const c = e.client_id ? db.clients.get(e.client_id) : null
  return {
    ...e,
    client_name: c?.brand_name ?? null,
    client_color: c?.color_tag ?? null,
    created_by_name: demo.profiles.find((p) => p.id === e.created_by)?.full_name ?? null,
  }
}

/** Eventos que se cruzan con el rango [from, to) */
export async function listEvents(from: string, to: string): Promise<CalendarEvent[]> {
  if (isDemo) {
    await wait()
    return db.events.rows
      .filter((e) => !e.deleted_at && e.starts_at < to && e.ends_at >= from)
      .map(demoOverview)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
  }
  return check(
    await sb().from('events_overview').select('*').is('deleted_at', null).lt('starts_at', to).gte('ends_at', from).order('starts_at').limit(1000),
  )
}

export async function getEvent(eventId: string): Promise<CalendarEvent | null> {
  if (isDemo) {
    const e = db.events.get(eventId)
    return e && !e.deleted_at ? demoOverview(e) : null
  }
  return check(await sb().from('events_overview').select('*').eq('id', eventId).is('deleted_at', null).maybeSingle())
}

export async function createEvent(input: EventInput): Promise<string> {
  if (isDemo) {
    await wait()
    return db.events.insert({
      location: null, notes: null, attendee_ids: [], remind_minutes_before: 30, whatsapp_reminder: false,
      whatsapp_reminder_sent_at: null, google_event_id: null, google_etag: null, sync_status: 'sincronizado',
      created_by: DEMO_USER_ID, deleted_at: null, create_meet: false, reminder_sent_at: null, source: 'crm',
      all_day: false, client_id: null, type: 'reunion',
      ...input,
      meet_url: input.create_meet && !input.meet_url ? 'https://meet.google.com/demo-demo-demo' : (input.meet_url ?? null),
    } as Tables<'events'>).id
  }
  const res = await sb().from('events').insert(input).select('id').single()
  if (res.error) throw res.error
  return res.data.id
}

export async function updateEvent(eventId: string, patch: TablesUpdate<'events'>) {
  if (isDemo) {
    await wait()
    db.events.update(eventId, patch)
    return
  }
  check(await sb().from('events').update(patch).eq('id', eventId))
}

export const deleteEvent = (eventId: string) => updateEvent(eventId, { deleted_at: new Date().toISOString() })

// ---------------------------------------------------------------- Google Calendar
export async function getGoogleStatus(): Promise<GoogleStatus> {
  if (isDemo) return { connected: false }
  const data = check(await sb().rpc('google_sync_status'))
  return (data as unknown as GoogleStatus) ?? { connected: false }
}

async function invoke<T>(fn: string, body: unknown): Promise<T> {
  const { data, error } = await sb().functions.invoke(fn, { body: body as Record<string, unknown> })
  if (error) {
    // Intentamos leer el mensaje que devolvió la función
    const msg = await functionErrorMessage(error)
    throw new Error(msg || 'No pudimos comunicarnos con el servidor. Revisá que las funciones estén publicadas.')
  }
  return data as T
}

/** Devuelve el link de Google para autorizar la conexión. */
export async function startGoogleConnect(): Promise<string> {
  if (isDemo) throw new Error('En el modo demo no se puede conectar Google Calendar.')
  return (await invoke<{ url: string }>('google-oauth', { action: 'start' })).url
}

export async function disconnectGoogle() {
  await invoke('google-oauth', { action: 'disconnect' })
}

/** Sube los cambios del CRM y trae los de Google en este momento. */
export async function syncGoogleNow(): Promise<{ connected: boolean; pushed?: number; pulled?: number; errors?: string[] }> {
  if (isDemo) return { connected: false }
  return invoke('google-sync', {})
}
