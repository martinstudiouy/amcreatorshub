// Base de datos en memoria para el modo demo (Fase 2 en adelante).
// Mismos datos que supabase/seed.sql. Se reinicia al recargar la página.
import { addDays, todayMvd } from '@/lib/format'
import type { Tables } from '@/types/database'
import { DEMO_USER_ID } from './demo'

type Row = { id: string; created_at: string; updated_at: string }

const iso = () => new Date().toISOString()
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()
const id = (n: number) => `00000000-0000-4000-a000-${String(n).padStart(12, '0')}`
const today = todayMvd()
const d = (offset: number) => addDays(today, offset)
const monthStart = today.slice(0, 8) + '01'

export const VALERIA_ID = '22222222-2222-4222-8222-222222222222'

/** Tabla en memoria con insert/update/delete y timestamps automáticos. */
class DemoTable<T extends Row> {
  rows: T[]
  constructor(rows: Omit<T, 'created_at' | 'updated_at'>[]) {
    this.rows = rows.map((r) => ({ created_at: ago(60 * 24 * 7), updated_at: ago(60 * 24 * 7), ...r }) as T)
  }
  get(rowId: string) {
    return this.rows.find((r) => r.id === rowId)
  }
  insert(row: Omit<T, 'id' | 'created_at' | 'updated_at'> & Partial<Row>): T {
    const full = { id: crypto.randomUUID(), created_at: iso(), updated_at: iso(), ...row } as T
    this.rows.push(full)
    return full
  }
  update(rowId: string, patch: Partial<T>): T {
    const r = this.get(rowId)
    if (!r) throw new Error('No encontramos ese registro.')
    Object.assign(r, patch, { updated_at: iso() })
    return r
  }
  remove(rowId: string) {
    this.rows = this.rows.filter((r) => r.id !== rowId)
  }
}

const base = { created_by: null as string | null, deleted_at: null as string | null }

export const db = {
  clients: new DemoTable<Tables<'clients'>>([
    { ...base, id: id(1), name: 'Sofía Pereira', brand_name: 'Café Rambla', industry: 'Gastronomía', email: 'hola@caferambla.uy', whatsapp: '+59899123456', instagram_handle: 'caferambla', monthly_fee: 18000, currency: 'UYU', start_date: d(-240), status: 'activo', color_tag: '#0300FF' },
    { ...base, id: id(2), name: 'Valentina Ruiz', brand_name: 'Pilates Pocitos', industry: 'Salud y bienestar', email: 'contacto@pilatespocitos.uy', whatsapp: '+59898765432', instagram_handle: 'pilatespocitos', monthly_fee: 15000, currency: 'UYU', start_date: d(-120), status: 'activo', color_tag: '#16A34A' },
    { ...base, id: id(3), name: 'Diego Fernández', brand_name: 'Bodega Los Altos', industry: 'Vinos', email: 'diego@bodegalosaltos.uy', whatsapp: '+59894111222', instagram_handle: 'bodegalosaltos', monthly_fee: null, currency: 'USD', start_date: d(-30), status: 'activo', color_tag: '#9333EA' },
    { ...base, id: id(4), name: 'Martina Silva', brand_name: 'Nómade Surf', industry: 'Deportes', email: 'martina@nomadesurf.uy', whatsapp: '+59892333444', instagram_handle: 'nomadesurf.uy', monthly_fee: 12000, currency: 'UYU', start_date: d(-300), status: 'pausado', color_tag: '#EA580C' },
    { ...base, id: id(5), name: 'Jorge Méndez', brand_name: 'Ferretería El Tornillo', industry: 'Comercio', email: 'ventas@eltornillo.uy', whatsapp: '+59891555666', instagram_handle: 'ferreteriaeltornillo', monthly_fee: null, currency: 'UYU', start_date: null, status: 'lead', color_tag: '#64748B' },
  ]),

  services: new DemoTable<Tables<'client_services'>>([
    { id: id(11), client_id: id(1), service: 'redes', description: 'Gestión de Instagram: 12 posts y 8 reels por mes', is_active: true },
    { id: id(12), client_id: id(2), service: 'redes', description: 'Gestión de Instagram: 8 posts por mes', is_active: true },
    { id: id(13), client_id: id(2), service: 'fotografia', description: 'Sesión mensual en estudio', is_active: true },
    { id: id(14), client_id: id(3), service: 'branding', description: 'Identidad visual completa', is_active: true },
    { id: id(15), client_id: id(4), service: 'web', description: 'Sitio institucional', is_active: true },
  ]),

  assets: new DemoTable<Tables<'client_assets'>>([
    { id: id(21), client_id: id(1), kind: 'color', name: 'Azul Rambla', value: '#1E3A8A', storage_path: null, sort_order: 1, created_by: null },
    { id: id(22), client_id: id(1), kind: 'color', name: 'Crema', value: '#F5EFE6', storage_path: null, sort_order: 2, created_by: null },
    { id: id(23), client_id: id(1), kind: 'font', name: 'Títulos', value: 'Playfair Display', storage_path: null, sort_order: 3, created_by: null },
  ]),

  notes: new DemoTable<Tables<'client_notes'>>([
    { id: id(31), client_id: id(1), body: 'Prefiere aprobar el contenido los lunes. Nada de fondos negros.', is_pinned: true, author_id: DEMO_USER_ID },
  ]),

  templates: new DemoTable<Tables<'project_templates'>>([
    { id: id(41), name: 'Identidad visual completa', project_type: 'branding', description: 'Desde el brief hasta el manual de marca', default_budget: 60000, created_by: null },
    { id: id(42), name: 'Gestión mensual de redes', project_type: 'redes', description: 'Planificación, producción y publicación del mes', default_budget: null, created_by: null },
  ]),

  templateTasks: new DemoTable<Tables<'template_tasks'>>([
    { id: id(51), template_id: id(41), title: 'Brief y reunión de arranque', description: null, day_offset: 0, default_priority: 'alta', checklist: ['Cuestionario de marca', 'Referencias visuales'], position: 1 },
    { id: id(52), template_id: id(41), title: 'Moodboard', description: null, day_offset: 5, default_priority: 'media', checklist: [], position: 2 },
    { id: id(53), template_id: id(41), title: 'Propuestas de logo', description: null, day_offset: 14, default_priority: 'alta', checklist: ['3 rutas creativas'], position: 3 },
    { id: id(54), template_id: id(41), title: 'Manual de marca', description: null, day_offset: 28, default_priority: 'media', checklist: [], position: 4 },
    { id: id(55), template_id: id(42), title: 'Planificación del mes', description: null, day_offset: 0, default_priority: 'alta', checklist: ['Fechas clave', 'Grilla'], position: 1 },
    { id: id(56), template_id: id(42), title: 'Producción de piezas', description: null, day_offset: 5, default_priority: 'media', checklist: [], position: 2 },
    { id: id(57), template_id: id(42), title: 'Reporte mensual', description: null, day_offset: 29, default_priority: 'media', checklist: [], position: 3 },
  ]),

  projects: new DemoTable<Tables<'projects'>>([
    { ...base, id: id(61), client_id: id(1), name: 'Redes: plan del mes', type: 'redes', start_date: monthStart, due_date: addDays(monthStart, 29), budget: 18000, currency: 'UYU', status: 'activo', template_id: id(42) },
    { ...base, id: id(62), client_id: id(3), name: 'Identidad visual completa', type: 'branding', start_date: d(-20), due_date: d(25), budget: 1800, currency: 'USD', status: 'activo', template_id: id(41) },
    { ...base, id: id(63), client_id: id(2), name: 'Sesión de fotos de temporada', type: 'fotografia', start_date: d(-5), due_date: d(7), budget: 9000, currency: 'UYU', status: 'activo', template_id: null },
    { ...base, id: id(64), client_id: id(4), name: 'Web institucional', type: 'web', start_date: d(-90), due_date: d(30), budget: 45000, currency: 'UYU', status: 'en_pausa', template_id: null },
  ]),

  tasks: new DemoTable<Tables<'tasks'>>([
    { ...base, id: id(71), project_id: id(62), title: 'Propuestas de logo (3 rutas)', description: 'Tres rutas: clásica, moderna y artesanal. Presentar en PDF.', assignee_id: DEMO_USER_ID, due_date: d(-1), priority: 'urgente', column: 'en_proceso', position: 1 },
    { ...base, id: id(72), project_id: id(61), title: 'Diseñar carrusel de la carta de verano', description: null, assignee_id: VALERIA_ID, due_date: d(0), priority: 'alta', column: 'en_proceso', position: 2 },
    { ...base, id: id(73), project_id: id(61), title: 'Editar reel del brunch', description: null, assignee_id: VALERIA_ID, due_date: d(0), priority: 'media', column: 'por_hacer', position: 3 },
    { ...base, id: id(74), project_id: id(63), title: 'Armar shotlist de la sesión', description: null, assignee_id: null, due_date: d(0), priority: 'media', column: 'en_revision', position: 4 },
    { ...base, id: id(75), project_id: id(63), title: 'Confirmar modelos y vestuario', description: null, assignee_id: null, due_date: d(1), priority: 'alta', column: 'por_hacer', position: 5 },
    { ...base, id: id(76), project_id: id(61), title: 'Copys de la semana', description: null, assignee_id: null, due_date: d(2), priority: 'baja', column: 'por_hacer', position: 6 },
    { ...base, id: id(77), project_id: id(62), title: 'Moodboard', description: null, assignee_id: DEMO_USER_ID, due_date: d(-10), priority: 'media', column: 'entregado', position: 7 },
    { ...base, id: id(78), project_id: id(62), title: 'Manual de marca', description: null, assignee_id: null, due_date: d(20), priority: 'media', column: 'por_hacer', position: 8 },
    { ...base, id: id(79), project_id: id(61), title: 'Planificación del mes', description: null, assignee_id: DEMO_USER_ID, due_date: monthStart, priority: 'alta', column: 'aprobado', position: 9 },
  ]),

  checklist: new DemoTable<Tables<'task_checklist_items'>>([
    { id: id(81), task_id: id(71), label: 'Ruta clásica', is_done: true, position: 1 },
    { id: id(82), task_id: id(71), label: 'Ruta moderna', is_done: true, position: 2 },
    { id: id(83), task_id: id(71), label: 'Ruta artesanal', is_done: false, position: 3 },
  ]),

  comments: new DemoTable<Tables<'task_comments'>>([
    { id: id(91), task_id: id(71), author_id: VALERIA_ID, body: 'La ruta artesanal la puedo bocetar yo a mano si querés.' },
  ]),

  attachments: new DemoTable<Tables<'task_attachments'>>([]),

  events: new DemoTable<Tables<'events'>>([
    demoEvent(121, id(3), 'reunion', 'Presentación de rutas de logo', 0, '10:00', '11:00', { meet_url: 'https://meet.google.com/abc-defg-hij', notes: 'Llevar las 3 rutas impresas en PDF', attendee_ids: [DEMO_USER_ID] }),
    demoEvent(122, id(2), 'sesion_fotos', 'Sesión de fotos de temporada', 0, '15:00', '17:30', { location: 'Estudio AM Creators', attendee_ids: [DEMO_USER_ID, VALERIA_ID] }),
    demoEvent(123, id(5), 'reunion', 'Primera reunión: redes', 1, '09:30', '10:15', { location: 'Ferretería El Tornillo, Av. Italia' }),
    demoEvent(124, id(1), 'entrega', 'Entrega del plan de diciembre', 5, '00:00', '23:59', { all_day: true }),
    demoEvent(125, null, 'evento', 'Feria de emprendedores (Google)', 3, '18:00', '21:00', { location: 'Espacio Modo', source: 'google' }),
    demoEvent(126, id(1), 'reunion', 'Revisión mensual con Café Rambla', -2, '11:00', '11:45', { meet_url: 'https://meet.google.com/xyz-abcd-efg' }),
    demoEvent(127, id(4), 'reunion', 'Retomar la web', 8, '16:00', '17:00', {}),
  ]),
}

// ---------------------------------------------------------------- Finanzas (igual que seed.sql)
const fin = { created_by: null as string | null, deleted_at: null as string | null }
const prevMonth = (() => {
  const dt = new Date(`${monthStart}T12:00:00Z`)
  dt.setUTCMonth(dt.getUTCMonth() - 1)
  return dt.toISOString().slice(0, 10)
})()

export const finance = {
  fees: new DemoTable<Tables<'recurring_fees'>>([
    { id: id(131), client_id: id(1), description: 'Gestión de redes', amount: 18000, currency: 'UYU', billing_day: 1, start_date: d(-240), end_date: null, is_active: true },
    { id: id(132), client_id: id(2), description: 'Gestión de redes', amount: 15000, currency: 'UYU', billing_day: 5, start_date: d(-120), end_date: null, is_active: true },
  ]),
  invoices: new DemoTable<Tables<'invoices'>>([
    { ...fin, id: id(145), client_id: id(1), project_id: null, recurring_fee_id: id(131), number: 'AMC-R-0001', issue_date: prevMonth, due_date: addDays(prevMonth, 10), currency: 'UYU', fx_rate: 1, subtotal: 18000, vat_rate: 0, total: 18000, status: 'cobrado', paid_at: new Date(`${addDays(prevMonth, 4)}T15:00:00Z`).toISOString(), payment_method: 'Transferencia', cfe_number: null, pdf_path: null, notes: null },
    { ...fin, id: id(141), client_id: id(1), project_id: null, recurring_fee_id: id(131), number: 'AMC-R-0002', issue_date: monthStart, due_date: addDays(monthStart, 10), currency: 'UYU', fx_rate: 1, subtotal: 18000, vat_rate: 0, total: 18000, status: 'cobrado', paid_at: ago(60 * 24 * 8), payment_method: 'Transferencia', cfe_number: 'A-104233', pdf_path: null, notes: null },
    { ...fin, id: id(142), client_id: id(2), project_id: null, recurring_fee_id: id(132), number: 'AMC-R-0003', issue_date: addDays(monthStart, 4), due_date: d(5), currency: 'UYU', fx_rate: 1, subtotal: 15000, vat_rate: 0, total: 15000, status: 'pendiente', paid_at: null, payment_method: null, cfe_number: null, pdf_path: null, notes: null },
    { ...fin, id: id(143), client_id: id(3), project_id: id(62), recurring_fee_id: null, number: 'AMC-R-0004', issue_date: d(-20), due_date: d(-15), currency: 'USD', fx_rate: 39.65, subtotal: 900, vat_rate: 0, total: 900, status: 'cobrado', paid_at: ago(60 * 24 * 17), payment_method: 'Transferencia', cfe_number: null, pdf_path: null, notes: null },
    { ...fin, id: id(144), client_id: id(4), project_id: id(64), recurring_fee_id: null, number: 'AMC-R-0005', issue_date: d(-40), due_date: d(-25), currency: 'UYU', fx_rate: 1, subtotal: 12000, vat_rate: 0, total: 12000, status: 'vencido', paid_at: null, payment_method: null, cfe_number: null, pdf_path: null, notes: null },
  ]),
  invoiceItems: new DemoTable<Tables<'invoice_items'>>([
    { id: id(150), invoice_id: id(145), description: 'Gestión de redes · mes anterior', quantity: 1, unit_price: 18000, position: 1 },
    { id: id(151), invoice_id: id(141), description: 'Gestión de redes · mes en curso', quantity: 1, unit_price: 18000, position: 1 },
    { id: id(152), invoice_id: id(142), description: 'Gestión de redes · mes en curso', quantity: 1, unit_price: 15000, position: 1 },
    { id: id(153), invoice_id: id(143), description: 'Identidad visual: anticipo 50%', quantity: 1, unit_price: 900, position: 1 },
    { id: id(154), invoice_id: id(144), description: 'Web institucional: segunda cuota', quantity: 1, unit_price: 12000, position: 1 },
  ]),
  quotes: new DemoTable<Tables<'quotes'>>([
    { ...fin, id: id(155), client_id: id(5), project_id: null, number: 'AMC-P-0001', issue_date: d(-3), valid_until: d(12), currency: 'UYU', fx_rate: 1, subtotal: 54000, discount: 4000, vat_rate: 0, total: 50000, status: 'enviado', pdf_path: null, notes: 'Incluye 3 rutas creativas y 2 rondas de cambios.' },
  ]),
  quoteItems: new DemoTable<Tables<'quote_items'>>([
    { id: id(156), quote_id: id(155), description: 'Identidad visual: logo, paleta y tipografías', quantity: 1, unit_price: 42000, position: 1 },
    { id: id(157), quote_id: id(155), description: 'Manual de marca (PDF)', quantity: 1, unit_price: 12000, position: 2 },
  ]),
  expenses: new DemoTable<Tables<'expenses'>>([
    { ...fin, id: id(161), category: 'software', description: 'Adobe Creative Cloud', amount: 60, currency: 'USD', fx_rate: 39.8, date: d(-60), client_id: null, project_id: null, is_recurring: true, recurrence_day: 15, receipt_path: null, parent_expense_id: null },
    { ...fin, id: id(162), category: 'software', description: 'Supabase Pro', amount: 25, currency: 'USD', fx_rate: 39.8, date: d(-60), client_id: null, project_id: null, is_recurring: true, recurrence_day: 15, receipt_path: null, parent_expense_id: null },
    { ...fin, id: id(163), category: 'software', description: 'Adobe Creative Cloud', amount: 60, currency: 'USD', fx_rate: 39.65, date: addDays(monthStart, 14), client_id: null, project_id: null, is_recurring: false, recurrence_day: null, receipt_path: null, parent_expense_id: id(161) },
    { ...fin, id: id(164), category: 'software', description: 'Supabase Pro', amount: 25, currency: 'USD', fx_rate: 39.65, date: addDays(monthStart, 14), client_id: null, project_id: null, is_recurring: false, recurrence_day: null, receipt_path: null, parent_expense_id: id(162) },
    { ...fin, id: id(165), category: 'freelancers', description: 'Fotógrafo asistente: sesión Pilates', amount: 3500, currency: 'UYU', fx_rate: 1, date: d(-2), client_id: id(2), project_id: id(63), is_recurring: false, recurrence_day: null, receipt_path: null, parent_expense_id: null },
    { ...fin, id: id(166), category: 'publicidad', description: 'Pauta Instagram AM Creators', amount: 2500, currency: 'UYU', fx_rate: 1, date: addDays(prevMonth, 9), client_id: null, project_id: null, is_recurring: false, recurrence_day: null, receipt_path: null, parent_expense_id: null },
    { ...fin, id: id(167), category: 'software', description: 'Adobe Creative Cloud', amount: 60, currency: 'USD', fx_rate: 39.5, date: addDays(prevMonth, 14), client_id: null, project_id: null, is_recurring: false, recurrence_day: null, receipt_path: null, parent_expense_id: id(161) },
    { ...fin, id: id(168), category: 'equipos', description: 'Flash Godox', amount: 7900, currency: 'UYU', fx_rate: 1, date: addDays(prevMonth, 20), client_id: null, project_id: null, is_recurring: false, recurrence_day: null, receipt_path: null, parent_expense_id: null },
  ]),
}

function demoEvent(
  n: number,
  clientId: string | null,
  type: Tables<'events'>['type'],
  title: string,
  dayOffset: number,
  from: string,
  to: string,
  extra: Partial<Tables<'events'>>,
): Omit<Tables<'events'>, 'created_at' | 'updated_at'> {
  const at = (hhmm: string) => new Date(`${d(dayOffset)}T${hhmm}:00-03:00`).toISOString()
  return {
    id: id(n), client_id: clientId, type, title, starts_at: at(from), ends_at: at(to), all_day: false,
    location: null, meet_url: null, notes: null, attendee_ids: [], remind_minutes_before: 30,
    whatsapp_reminder: false, whatsapp_reminder_sent_at: null, google_event_id: null, google_etag: null,
    sync_status: 'sincronizado', created_by: DEMO_USER_ID, deleted_at: null, create_meet: false,
    reminder_sent_at: null, source: 'crm', ...extra,
  }
}

/** Archivos subidos en modo demo: ruta → URL temporal del navegador */
export const demoFiles = new Map<string, string>()
