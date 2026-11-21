// Sincronización con Google Calendar (en ambos sentidos).
// CRM → Google: los eventos marcados "pendiente" se crean, editan o borran en Google.
// Google → CRM: se traen solo los cambios desde la última vez (syncToken).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2'
import { env } from './http.ts'

export const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')
const TZ = 'America/Montevideo'
const OFFSET = '-03:00' // Uruguay no tiene horario de verano
const API = 'https://www.googleapis.com/calendar/v3'

export class GoogleAuthError extends Error {}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json()
  if (!res.ok) {
    if (data.error === 'invalid_grant') throw new GoogleAuthError('Google revocó el acceso. Hay que volver a conectar la cuenta.')
    throw new Error(`Google no devolvió un token (${data.error ?? res.status}).`)
  }
  return data.access_token as string
}

async function gfetch(access: string, path: string, init: RequestInit = {}) {
  return fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}

type CrmEvent = {
  id: string
  title: string
  starts_at: string
  ends_at: string
  all_day: boolean
  location: string | null
  meet_url: string | null
  notes: string | null
  create_meet: boolean
  deleted_at: string | null
  google_event_id: string | null
  client_id: string | null
}

type GEvent = {
  id: string
  status?: string
  etag?: string
  summary?: string
  description?: string
  location?: string
  hangoutLink?: string
  start?: { date?: string; dateTime?: string }
  end?: { date?: string; dateTime?: string }
  extendedProperties?: { private?: Record<string, string> }
}

/** Fecha local (Montevideo) AAAA-MM-DD de un instante */
function localDate(iso: string) {
  return new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 10)
}
function addDays(date: string, n: number) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

export function toGoogle(ev: CrmEvent, clientName: string | null) {
  const body: Record<string, unknown> = {
    summary: clientName && !ev.title.includes(clientName) ? `${ev.title} · ${clientName}` : ev.title,
    location: ev.location ?? undefined,
    description: ev.notes ?? undefined,
    extendedProperties: { private: { crmId: ev.id } },
  }
  if (ev.all_day) {
    body.start = { date: localDate(ev.starts_at) }
    body.end = { date: addDays(localDate(ev.ends_at), 1) } // en Google el fin de un día completo es exclusivo
  } else {
    body.start = { dateTime: new Date(ev.starts_at).toISOString(), timeZone: TZ }
    body.end = { dateTime: new Date(ev.ends_at).toISOString(), timeZone: TZ }
  }
  if (ev.create_meet && !ev.meet_url) {
    body.conferenceData = { createRequest: { requestId: ev.id, conferenceSolutionKey: { type: 'hangoutsMeet' } } }
  }
  return body
}

export function fromGoogle(g: GEvent) {
  const allDay = !!g.start?.date
  const starts = allDay ? `${g.start!.date}T00:00:00${OFFSET}` : g.start!.dateTime!
  const ends = allDay ? `${addDays(g.end?.date ?? g.start!.date!, -1)}T23:59:00${OFFSET}` : (g.end?.dateTime ?? g.start!.dateTime!)
  return {
    starts_at: new Date(starts).toISOString(),
    ends_at: new Date(ends).toISOString(),
    all_day: allDay,
    location: g.location ?? null,
    notes: g.description ?? null,
  }
}

/** Saca " · Marca" del título si lo agregamos nosotros al subirlo. */
export function cleanTitle(summary: string | undefined, clientName: string | null) {
  const t = summary?.trim() || '(Sin título)'
  return clientName && t.endsWith(` · ${clientName}`) ? t.slice(0, -(` · ${clientName}`.length)) : t
}

export async function pushPending(admin: SupabaseClient, access: string, calendarId: string) {
  const { data: pending, error } = await admin
    .from('events')
    .select('id, title, starts_at, ends_at, all_day, location, meet_url, notes, create_meet, deleted_at, google_event_id, client_id, clients(brand_name)')
    .eq('sync_status', 'pendiente')
    .order('updated_at')
    .limit(50)
  if (error) throw error
  const cal = encodeURIComponent(calendarId)
  let pushed = 0
  const errors: string[] = []

  for (const row of pending ?? []) {
    const ev = row as unknown as CrmEvent & { clients: { brand_name: string } | null }
    try {
      if (ev.deleted_at) {
        if (ev.google_event_id) {
          const r = await gfetch(access, `/calendars/${cal}/events/${encodeURIComponent(ev.google_event_id)}`, { method: 'DELETE' })
          if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error(`Google respondió ${r.status} al borrar`)
        }
        await admin.from('events').update({ sync_status: 'sincronizado' }).eq('id', ev.id)
        pushed++
        continue
      }
      const body = JSON.stringify(toGoogle(ev, ev.clients?.brand_name ?? null))
      let r: Response | null = null
      if (ev.google_event_id) {
        r = await gfetch(access, `/calendars/${cal}/events/${encodeURIComponent(ev.google_event_id)}?conferenceDataVersion=1`, { method: 'PATCH', body })
        if (r.status === 404 || r.status === 410) r = null // lo borraron en Google: se vuelve a crear
      }
      if (!r) r = await gfetch(access, `/calendars/${cal}/events?conferenceDataVersion=1`, { method: 'POST', body })
      const g = (await r.json()) as GEvent & { error?: { message?: string } }
      if (!r.ok) throw new Error(g.error?.message ?? `Google respondió ${r.status}`)
      await admin
        .from('events')
        .update({ google_event_id: g.id, google_etag: g.etag ?? null, meet_url: g.hangoutLink ?? ev.meet_url, sync_status: 'sincronizado' })
        .eq('id', ev.id)
      pushed++
    } catch (e) {
      errors.push(`"${ev.title}": ${(e as Error).message}`)
      await admin.from('events').update({ sync_status: 'error' }).eq('id', ev.id)
    }
  }
  return { pushed, errors }
}

type Connection = { id: string; user_id: string; calendar_id: string; sync_token: string | null }

export async function pullChanges(admin: SupabaseClient, access: string, conn: Connection) {
  const cal = encodeURIComponent(conn.calendar_id)
  let syncToken = conn.sync_token
  let pageToken: string | undefined
  let pulled = 0
  const clientNames = new Map<string, string>()
  const { data: clients } = await admin.from('clients').select('id, brand_name')
  clients?.forEach((c) => clientNames.set(c.id, c.brand_name))

  for (let page = 0; page < 40; page++) {
    const params = new URLSearchParams({ singleEvents: 'true', maxResults: '250' })
    if (syncToken) params.set('syncToken', syncToken)
    else {
      params.set('timeMin', new Date(Date.now() - 30 * 86_400_000).toISOString())
      params.set('showDeleted', 'true')
    }
    if (pageToken) params.set('pageToken', pageToken)
    const r = await gfetch(access, `/calendars/${cal}/events?${params}`)
    if (r.status === 410) {
      // El syncToken venció: arrancamos de nuevo con una sincronización completa
      syncToken = null
      pageToken = undefined
      continue
    }
    const data = await r.json()
    if (!r.ok) throw new Error(data.error?.message ?? `Google respondió ${r.status}`)

    for (const g of (data.items ?? []) as GEvent[]) {
      const crmId = g.extendedProperties?.private?.crmId
      const { data: found } = await admin
        .from('events')
        .select('id, google_etag, sync_status, client_id, deleted_at, meet_url')
        .or(crmId ? `google_event_id.eq.${g.id},id.eq.${crmId}` : `google_event_id.eq.${g.id}`)
        .limit(1)
        .maybeSingle()

      if (g.status === 'cancelled') {
        if (found && !found.deleted_at) {
          await admin.from('events').update({ deleted_at: new Date().toISOString(), sync_status: 'sincronizado' }).eq('id', found.id)
          pulled++
        }
        continue
      }
      if (!g.start) continue
      if (found) {
        if (found.google_etag === g.etag || found.sync_status === 'pendiente') continue // sin cambios, o el CRM tiene cambios por subir
        await admin
          .from('events')
          .update({
            ...fromGoogle(g),
            title: cleanTitle(g.summary, found.client_id ? (clientNames.get(found.client_id) ?? null) : null),
            meet_url: g.hangoutLink ?? found.meet_url,
            google_event_id: g.id,
            google_etag: g.etag ?? null,
            deleted_at: null,
            sync_status: 'sincronizado',
          })
          .eq('id', found.id)
      } else {
        await admin.from('events').insert({
          ...fromGoogle(g),
          title: g.summary?.trim() || '(Sin título)',
          type: g.hangoutLink ? 'reunion' : 'evento',
          meet_url: g.hangoutLink ?? null,
          google_event_id: g.id,
          google_etag: g.etag ?? null,
          source: 'google',
          created_by: conn.user_id,
          remind_minutes_before: null,
          sync_status: 'sincronizado',
        })
      }
      pulled++
    }

    if (data.nextPageToken) {
      pageToken = data.nextPageToken
      continue
    }
    await admin.from('calendar_connections').update({ sync_token: data.nextSyncToken ?? null }).eq('id', conn.id)
    break
  }
  return { pulled }
}

/** Sincroniza el calendario del estudio (la primera cuenta conectada). */
export async function syncStudio(admin: SupabaseClient) {
  const { data: conn } = await admin
    .from('calendar_connections')
    .select('id, user_id, calendar_id, sync_token')
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (!conn) return { connected: false }

  try {
    const { data: refresh } = await admin.rpc('get_google_refresh_token', { p_connection_id: conn.id })
    if (!refresh) throw new GoogleAuthError('No encontramos el token de Google. Volvé a conectar la cuenta.')
    const access = await refreshAccessToken(refresh as string)
    const push = await pushPending(admin, access, conn.calendar_id)
    const pull = await pullChanges(admin, access, conn as Connection)
    await admin
      .from('calendar_connections')
      .update({ last_synced_at: new Date().toISOString(), status: 'conectado', last_error: push.errors.length ? push.errors.slice(0, 3).join(' · ') : null })
      .eq('id', conn.id)
    return { connected: true, pushed: push.pushed, pulled: pull.pulled, errors: push.errors }
  } catch (e) {
    const auth = e instanceof GoogleAuthError
    await admin
      .from('calendar_connections')
      .update({ last_error: (e as Error).message, ...(auth ? { status: 'desconectado' } : {}) })
      .eq('id', conn.id)
    throw e
  }
}
