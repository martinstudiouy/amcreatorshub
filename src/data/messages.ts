// Fase 7: bandeja unificada de WhatsApp e Instagram.
import { isDemo, sb } from '@/lib/supabase'
import type { Tables, TablesUpdate } from '@/types/database'
import { functionErrorMessage } from './api'
import { DEMO_USER_ID } from './demo'
import { db, demoFiles, inbox } from './demo-db'

export type Channel = 'whatsapp' | 'instagram'
export type ConvStatus = Tables<'conversations'>['status']
export type Label = 'lead' | 'consulta' | 'soporte' | 'cliente'
export type Conversation = Tables<'conversations'> & {
  client_name: string | null
  client_color: string | null
  client_whatsapp: string | null
}
export type Message = Tables<'messages'>
export type QuickReply = Tables<'quick_replies'>
export type WaTemplate = Tables<'whatsapp_templates'>

export const LABELS: Label[] = ['lead', 'consulta', 'soporte', 'cliente']
export const labelText: Record<Label, string> = {
  lead: 'Lead',
  consulta: 'Consulta',
  soporte: 'Soporte',
  cliente: 'Cliente',
}
export const statusText: Record<ConvStatus, string> = {
  abierta: 'Abierta',
  pendiente: 'Pendiente',
  cerrada: 'Cerrada',
}

const wait = (ms = 150) => new Promise((r) => setTimeout(r, ms))
function check<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}
async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().functions.invoke('messages', { body })
  if (error) throw new Error((await functionErrorMessage(error)) || 'No pudimos conectarnos con el servidor. Probá de nuevo en un rato.')
  return data as T
}

/** Ventana de 24 horas desde el último mensaje del contacto. */
export const windowOpen = (c: Pick<Conversation, 'last_inbound_at'>) => !!c.last_inbound_at && Date.now() - new Date(c.last_inbound_at).getTime() < 24 * 3600_000
export const windowLeft = (c: Pick<Conversation, 'last_inbound_at'>) => (c.last_inbound_at ? 24 * 3600_000 - (Date.now() - new Date(c.last_inbound_at).getTime()) : 0)

/** Nombre a mostrar: la marca si está vinculada, si no el nombre del contacto. */
export const convTitle = (c: Conversation) =>
  c.client_name ?? c.contact_name ?? (c.contact_username ? `@${c.contact_username}` : c.channel === 'whatsapp' ? `+${c.external_contact_id}` : 'Contacto de Instagram')

// ================================================================ Conversaciones
function withClient(c: Tables<'conversations'>): Conversation {
  const cl = c.client_id ? db.clients.get(c.client_id) : null
  return {
    ...c,
    client_name: cl?.brand_name ?? null,
    client_color: cl?.color_tag ?? null,
    client_whatsapp: cl?.whatsapp ?? null,
  }
}
type Row = Tables<'conversations'> & {
  client: { brand_name: string; color_tag: string | null; whatsapp: string | null } | null
}
const fromRow = ({ client, ...c }: Row): Conversation => ({
  ...c,
  client_name: client?.brand_name ?? null,
  client_color: client?.color_tag ?? null,
  client_whatsapp: client?.whatsapp ?? null,
})

export async function listConversations(opts: { clientId?: string } = {}): Promise<Conversation[]> {
  if (isDemo) {
    await wait()
    return inbox.conversations.rows
      .filter((c) => !opts.clientId || c.client_id === opts.clientId)
      .map(withClient)
      .sort((a, b) => (b.last_message_at ?? '').localeCompare(a.last_message_at ?? ''))
  }
  let q = sb().from('conversations').select('*, client:clients(brand_name, color_tag, whatsapp)')
  if (opts.clientId) q = q.eq('client_id', opts.clientId)
  const rows = check(await q.order('last_message_at', { ascending: false, nullsFirst: false }).limit(500)) as unknown as Row[]
  return rows.map(fromRow)
}

export async function updateConversation(id: string, patch: Pick<TablesUpdate<'conversations'>, 'status' | 'labels' | 'client_id' | 'assignee_id' | 'contact_name'>) {
  if (isDemo) {
    inbox.conversations.update(id, patch)
    return
  }
  check(await sb().from('conversations').update(patch).eq('id', id))
}

export async function markRead(id: string) {
  if (isDemo) {
    inbox.conversations.update(id, { unread_count: 0 })
    return
  }
  await sb().rpc('mark_conversation_read', { p_id: id })
}

// ================================================================ Mensajes
export async function listMessages(conversationId: string): Promise<Message[]> {
  if (isDemo) {
    await wait(100)
    return inbox.messages.rows.filter((m) => m.conversation_id === conversationId).sort((a, b) => a.sent_at.localeCompare(b.sent_at))
  }
  const rows = check(await sb().from('messages').select('*').eq('conversation_id', conversationId).order('sent_at', { ascending: false }).limit(300))
  return rows.reverse()
}

function demoOut(conversationId: string, body: string, extra: Partial<Message> = {}) {
  inbox.messages.insert({
    conversation_id: conversationId,
    direction: 'saliente',
    external_message_id: `demo.${Date.now()}`,
    type: 'texto',
    body,
    media_path: null,
    media_mime: null,
    file_name: null,
    template_name: null,
    sent_by: DEMO_USER_ID,
    delivery_status: 'enviado',
    error_message: null,
    sent_at: new Date().toISOString(),
    ...extra,
  })
  inbox.conversations.update(conversationId, {
    last_message_at: new Date().toISOString(),
    last_message_preview: `Vos: ${body.slice(0, 120)}`,
    unread_count: 0,
  })
}

export async function sendText(conversationId: string, text: string) {
  if (isDemo) {
    await wait(400)
    const c = inbox.conversations.get(conversationId)
    if (c && !windowOpen(c))
      throw new Error(
        c.channel === 'whatsapp'
          ? 'Pasaron más de 24 horas desde su último mensaje: solo podés mandar una plantilla aprobada.'
          : 'Instagram solo deja responder dentro de las 24 horas desde su último mensaje.',
      )
    demoOut(conversationId, text)
    return
  }
  await invoke({ action: 'send', conversationId, text })
}

export const fillTemplate = (body: string, params: string[]) => body.replace(/\{\{(\d+)\}\}/g, (_m, n) => params[Number(n) - 1] || `{{${n}}}`)

/** Plantilla de WhatsApp a una conversación o, si no hay, al número del cliente. Devuelve la conversación. */
export async function sendTemplate(target: { conversationId?: string; clientId?: string }, t: WaTemplate, params: string[]): Promise<string> {
  if (isDemo) {
    await wait(500)
    let convId = target.conversationId
    if (!convId && target.clientId) {
      const cl = db.clients.get(target.clientId)
      const existing = inbox.conversations.rows.find((c) => c.channel === 'whatsapp' && c.client_id === target.clientId)
      convId =
        existing?.id ??
        inbox.conversations.insert({
          channel: 'whatsapp',
          external_contact_id: (cl?.whatsapp ?? '').replace(/\D/g, ''),
          contact_name: cl?.name ?? null,
          contact_username: null,
          contact_avatar: null,
          client_id: target.clientId,
          social_account_id: null,
          labels: ['cliente'],
          status: 'abierta',
          assignee_id: null,
          last_message_at: null,
          last_inbound_at: null,
          last_message_preview: null,
          unread_count: 0,
        }).id
    }
    demoOut(convId!, fillTemplate(t.body, params), { type: 'plantilla', template_name: t.name })
    return convId!
  }
  const r = await invoke<{ conversationId: string }>({
    action: 'template',
    ...target,
    name: t.name,
    language: t.language,
    params,
  })
  return r.conversationId
}

/** Link temporal (1 hora) a un archivo recibido. */
export async function mediaUrl(path: string): Promise<string | null> {
  if (isDemo) return demoFiles.get(path) ?? null
  const { data } = await sb().storage.from('messages').createSignedUrl(path, 3600)
  return data?.signedUrl ?? null
}

// ================================================================ Respuestas rápidas y plantillas
export async function listQuickReplies(): Promise<QuickReply[]> {
  if (isDemo) return [...inbox.quickReplies.rows].sort((a, b) => a.shortcut.localeCompare(b.shortcut))
  return check(await sb().from('quick_replies').select('*').order('shortcut'))
}

export async function saveQuickReply(input: { shortcut: string; title: string; body: string }, id?: string) {
  const shortcut = `/${input.shortcut
    .replace(/^\/+/, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')}`
  if (shortcut.length < 2) throw new Error('El atajo tiene que tener letras o números, por ejemplo /precios.')
  const row = { shortcut, title: input.title.trim(), body: input.body.trim() }
  if (isDemo) {
    if (id) inbox.quickReplies.update(id, row)
    else inbox.quickReplies.insert({ ...row, created_by: DEMO_USER_ID })
    return
  }
  if (id) check(await sb().from('quick_replies').update(row).eq('id', id))
  else check(await sb().from('quick_replies').insert(row))
}

export async function deleteQuickReply(id: string) {
  if (isDemo) {
    inbox.quickReplies.remove(id)
    return
  }
  check(await sb().from('quick_replies').delete().eq('id', id))
}

export async function listTemplates(): Promise<WaTemplate[]> {
  if (isDemo) return [...inbox.templates.rows]
  return check(await sb().from('whatsapp_templates').select('*').order('name'))
}

export async function syncTemplates(): Promise<number> {
  if (isDemo) {
    await wait(700)
    return inbox.templates.rows.length
  }
  return (await invoke<{ count: number }>({ action: 'sync_templates' })).count
}

export interface MessagingStatus {
  whatsapp: boolean
  phone: string | null
  name: string | null
  webhook: boolean
  subscribed?: boolean
  subscribeError?: string | null
}
export async function messagingStatus(): Promise<MessagingStatus> {
  if (isDemo) return { whatsapp: true, phone: '+598 99 000 111', name: 'AM Creators', webhook: true, subscribed: true }
  return invoke<MessagingStatus>({ action: 'status' })
}

// ================================================================ Tiempo real
/** Escucha mensajes y conversaciones nuevas (Supabase Realtime). Devuelve la función para dejar de escuchar. */
export function subscribeInbox(onChange: (e: { table: 'messages' | 'conversations'; conversationId?: string; inbound?: boolean }) => void) {
  if (isDemo) return () => undefined
  const ch = sb()
    .channel('bandeja')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (p) => {
      const row = (p.new ?? p.old) as Partial<Message>
      onChange({
        table: 'messages',
        conversationId: row.conversation_id,
        inbound: p.eventType === 'INSERT' && row.direction === 'entrante',
      })
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, (p) => {
      onChange({
        table: 'conversations',
        conversationId: ((p.new ?? p.old) as Partial<Conversation>).id,
      })
    })
    .subscribe()
  return () => void sb().removeChannel(ch)
}
