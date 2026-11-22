// Datos de ejemplo para el modo demo (sin Supabase). Son los mismos que
// carga supabase/seed.sql, para que el demo y la base real se vean igual.
import { addDays, todayMvd } from '@/lib/format'
import type { DashboardSummary, ExchangeRate, Notification, Profile, Role, SearchResult, Settings } from './types'

const today = todayMvd()
/** Montevideo es UTC-3 todo el año */
const at = (dayOffset: number, hhmm: string) => new Date(`${addDays(today, dayOffset)}T${hhmm}:00-03:00`).toISOString()
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
const nowIso = () => new Date().toISOString()

const id = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`

export const DEMO_USER_ID = '11111111-1111-4111-8111-111111111111'

function makeProfile(p: Partial<Profile> & Pick<Profile, 'id' | 'full_name' | 'role'>): Profile {
  return {
    email: null,
    avatar_path: null,
    client_id: null,
    phone: null,
    is_active: true,
    created_at: ago(60 * 24 * 90),
    updated_at: ago(60 * 24 * 90),
    ...p,
  }
}

export const demo = {
  profiles: [
    makeProfile({ id: DEMO_USER_ID, full_name: 'Martín Techera', email: 'martin@amcreators.uy', role: 'admin', phone: '+598 99 000 000' }),
    makeProfile({ id: '22222222-2222-4222-8222-222222222222', full_name: 'Valeria Costa', email: 'valeria@amcreators.uy', role: 'equipo' }),
    makeProfile({ id: '44444444-4444-4444-8444-444444444444', full_name: 'Nicolás Báez', email: 'nicolas@amcreators.uy', role: 'equipo', is_active: false }),
  ] as Profile[],

  settings: {
    id: true,
    studio_name: 'AM Creators',
    legal_name: null,
    rut: null,
    address: 'Montevideo, Uruguay',
    email: 'hola@amcreators.uy',
    phone: null,
    website: null,
    logo_path: null,
    default_currency: 'UYU',
    vat_mode: 'sin_definir',
    vat_rate: 22,
    invoice_prefix: 'AMC',
    next_invoice_number: 6,
    next_quote_number: 2,
    quote_validity_days: 15,
    theme_default: 'system',
    created_at: nowIso(),
    updated_at: nowIso(),
  } as Settings,

  exchangeRates: [
    { id: id(902), date: today, usd_to_uyu: 39.8, note: 'Ejemplo: cargá el valor real', created_by: null, created_at: nowIso(), updated_at: nowIso() },
    { id: id(901), date: addDays(today, -20), usd_to_uyu: 39.65, note: 'Ejemplo: cargá el valor real', created_by: null, created_at: nowIso(), updated_at: nowIso() },
  ] as ExchangeRate[],

  notifications: [
    { id: id(801), user_id: DEMO_USER_ID, type: 'aprobacion', title: 'Bodega Los Altos pidió cambios', body: '"Detrás de escena": prefieren otra foto de portada.', link: '/contenidos', read_at: null, created_at: ago(40) },
    { id: id(802), user_id: DEMO_USER_ID, type: 'cuenta', title: 'La cuenta @bodegalosaltos vence en 4 días', body: 'Hay que volver a conectarla para que siga publicando.', link: '/metricas', read_at: null, created_at: ago(180) },
    { id: id(803), user_id: DEMO_USER_ID, type: 'tarea', title: 'Valeria te asignó una tarea', body: 'Revisar el reel del brunch', link: '/proyectos', read_at: ago(60), created_at: ago(60 * 26) },
  ] as Notification[],

  searchIndex: [
    { kind: 'publicacion', id: id(111), title: 'Llegó la carta de verano: 5 bebidas frías para la rambla', subtitle: 'Café Rambla', link: `/contenidos?post=${id(111)}` },
    { kind: 'publicacion', id: id(112), title: 'Clase abierta de reformer: te esperamos el sábado', subtitle: 'Pilates Pocitos', link: `/contenidos?post=${id(112)}` },
    { kind: 'publicacion', id: id(113), title: 'Detrás de escena: así nace nuestra nueva etiqueta', subtitle: 'Bodega Los Altos', link: `/contenidos?post=${id(113)}` },
  ] as SearchResult[],
}

export function demoDashboard(role: Role): DashboardSummary {
  const isAdmin = role === 'admin'
  return {
    today,
    is_admin: isAdmin,
    meetings: [
      { id: id(121), title: 'Presentación de rutas de logo', type: 'reunion', starts_at: at(0, '10:00'), ends_at: at(0, '11:00'), location: null, meet_url: 'https://meet.google.com/abc-defg-hij', client_name: 'Bodega Los Altos' },
      { id: id(122), title: 'Sesión de fotos de temporada', type: 'sesion_fotos', starts_at: at(0, '15:00'), ends_at: at(0, '17:30'), location: 'Estudio AM Creators', meet_url: null, client_name: 'Pilates Pocitos' },
    ],
    posts: [
      { id: id(111), caption: 'Llegó la carta de verano: 5 bebidas frías para la rambla', format: 'carrusel', status: 'programado', scheduled_at: at(0, '12:30'), client_name: 'Café Rambla', color_tag: '#0300FF' },
      { id: id(112), caption: 'Clase abierta de reformer: te esperamos el sábado', format: 'reel', status: 'aprobado', scheduled_at: at(0, '18:00'), client_name: 'Pilates Pocitos', color_tag: '#16A34A' },
      { id: id(113), caption: 'Detrás de escena: así nace nuestra nueva etiqueta', format: 'feed', status: 'en_aprobacion', scheduled_at: at(0, '20:00'), client_name: 'Bodega Los Altos', color_tag: '#9333EA' },
    ],
    tasks: [
      { id: id(71), title: 'Propuestas de logo (3 rutas)', due_date: addDays(today, -1), priority: 'urgente', column: 'en_proceso', project_name: 'Identidad visual completa', client_name: 'Bodega Los Altos', assignee_name: 'Martín Techera', overdue: true },
      { id: id(72), title: 'Diseñar carrusel de la carta de verano', due_date: today, priority: 'alta', column: 'en_proceso', project_name: 'Redes: plan del mes', client_name: 'Café Rambla', assignee_name: 'Valeria Costa', overdue: false },
      { id: id(74), title: 'Armar shotlist de la sesión', due_date: today, priority: 'media', column: 'en_revision', project_name: 'Sesión de fotos de temporada', client_name: 'Pilates Pocitos', assignee_name: null, overdue: false },
      { id: id(73), title: 'Editar reel del brunch', due_date: today, priority: 'media', column: 'por_hacer', project_name: 'Redes: plan del mes', client_name: 'Café Rambla', assignee_name: 'Valeria Costa', overdue: false },
      { id: id(75), title: 'Confirmar modelos y vestuario', due_date: addDays(today, 1), priority: 'alta', column: 'por_hacer', project_name: 'Sesión de fotos de temporada', client_name: 'Pilates Pocitos', assignee_name: null, overdue: false },
      { id: id(76), title: 'Copys de la semana', due_date: addDays(today, 2), priority: 'baja', column: 'por_hacer', project_name: 'Redes: plan del mes', client_name: 'Café Rambla', assignee_name: null, overdue: false },
    ],
    unread: [
      { id: id(171), channel: 'whatsapp', contact_name: 'Café Rambla', preview: '¿Podemos cambiar la foto del carrusel de hoy?', unread_count: 2, last_message_at: ago(25), is_new_contact: false },
      { id: id(172), channel: 'instagram', contact_name: 'lucia.eventos', preview: 'Hola! Quería saber precios de branding', unread_count: 1, last_message_at: ago(120), is_new_contact: true },
      { id: id(173), channel: 'whatsapp', contact_name: 'Ferretería El Tornillo', preview: 'Confirmo la reunión de mañana', unread_count: 1, last_message_at: ago(300), is_new_contact: false },
    ],
    kpis: {
      active_projects: 3,
      active_clients: 3,
      billed_month_uyu: isAdmin ? 33000 : null,
      pending_uyu: isAdmin ? 27000 : null,
      pending_count: isAdmin ? 2 : null,
      overdue_count: isAdmin ? 1 : null,
      followers: 2310,
      followers_30d_ago: 2160,
    },
    account_alerts: [
      { id: id(103), username: 'bodegalosaltos', platform: 'instagram', status: 'por_vencer', client_name: 'Bodega Los Altos', token_expires_at: at(4, '12:00') },
    ],
    activity: [
      { id: id(701), summary: 'Publicación "Llegó la carta de verano: 5 bebidas frías para la rambla" pasó a programado', action: 'cambio_estado', entity_type: 'content_posts', entity_id: id(111), created_at: ago(12), actor_name: 'Martín Techera', client_name: 'Café Rambla' },
      { id: id(702), summary: 'Tarea "Armar shotlist de la sesión" pasó a en revisión', action: 'cambio_estado', entity_type: 'tasks', entity_id: id(74), created_at: ago(48), actor_name: 'Valeria Costa', client_name: 'Pilates Pocitos' },
      ...(isAdmin
        ? [{ id: id(703), summary: 'Cobro creado: EJ-0002', action: 'creo', entity_type: 'invoices', entity_id: id(142), created_at: ago(95), actor_name: 'Martín Techera', client_name: 'Pilates Pocitos' }]
        : []),
      { id: id(704), summary: 'Evento creado: Primera reunión: redes', action: 'creo', entity_type: 'events', entity_id: id(123), created_at: ago(160), actor_name: 'Martín Techera', client_name: 'Ferretería El Tornillo' },
      { id: id(705), summary: 'Cliente creado: Ferretería El Tornillo', action: 'creo', entity_type: 'clients', entity_id: id(5), created_at: ago(170), actor_name: 'Martín Techera', client_name: 'Ferretería El Tornillo' },
      { id: id(706), summary: 'Proyecto creado: Sesión de fotos de temporada', action: 'creo', entity_type: 'projects', entity_id: id(63), created_at: ago(60 * 22), actor_name: 'Valeria Costa', client_name: 'Pilates Pocitos' },
      { id: id(707), summary: 'Tarea "Moodboard" pasó a entregado', action: 'cambio_estado', entity_type: 'tasks', entity_id: id(77), created_at: ago(60 * 30), actor_name: 'Martín Techera', client_name: 'Bodega Los Altos' },
    ],
  }
}
