// Fase 4: Finanzas (solo admin). Igual que el resto: Supabase o demo en memoria.
import { todayMvd } from '@/lib/format'
import { isDemo, sb } from '@/lib/supabase'
import type { Database, Tables, TablesUpdate } from '@/types/database'
import { DEMO_USER_ID, demo } from './demo'
import { db, finance } from './demo-db'

type Enums = Database['public']['Enums']
export type Currency = Enums['currency_code']
export type InvoiceStatus = Enums['invoice_status']
export type QuoteStatus = Enums['quote_status']
export type ExpenseCategory = Enums['expense_category']
export type LineItem = { description: string; quantity: number; unit_price: number }

export type Invoice = Tables<'invoices'> & { client_name: string; client_color: string | null; project_name: string | null; items: Tables<'invoice_items'>[] }
export type Quote = Tables<'quotes'> & { client_name: string; client_color: string | null; project_name: string | null; items: Tables<'quote_items'>[] }
export type Expense = Tables<'expenses'> & { client_name: string | null; project_name: string | null }
export type Fee = Tables<'recurring_fees'> & { client_name: string; client_color: string | null }

const wait = (ms = 200) => new Promise((r) => setTimeout(r, ms))
function check<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}
const round2 = (n: number) => Math.round(n * 100) / 100
export const itemsSubtotal = (items: LineItem[]) => round2(items.reduce((s, i) => s + round2(i.quantity * i.unit_price), 0))

// ---------------------------------------------------------------- demo helpers
function demoFx(currency: Currency, date: string): number {
  if (currency === 'UYU') return 1
  const r = [...demo.exchangeRates].filter((x) => x.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0]
  if (!r) throw new Error('Falta el tipo de cambio del dólar. Cargalo en Configuración → Tipo de cambio y volvé a intentar.')
  return Number(r.usd_to_uyu)
}
function demoNumber(kind: 'R' | 'P') {
  const s = demo.settings
  const n = kind === 'R' ? s.next_invoice_number++ : s.next_quote_number++
  return `${s.invoice_prefix}-${kind}-${String(n).padStart(4, '0')}`
}
const clientOf = (id: string | null) => (id ? db.clients.get(id) : undefined)
const projectOf = (id: string | null) => (id ? db.projects.get(id) : undefined)

/** IVA a aplicar en documentos nuevos según Configuración. */
export async function defaultVatRate(): Promise<number> {
  if (isDemo) return demo.settings.vat_mode === 'iva' ? Number(demo.settings.vat_rate) : 0
  const { data: s, error } = await sb().from('settings').select('vat_mode, vat_rate').maybeSingle()
  if (error) throw error
  return s?.vat_mode === 'iva' ? Number(s.vat_rate) : 0
}

/** Genera fees del mes, gastos recurrentes y marca vencidos. */
export async function runFinanceJobs() {
  if (isDemo) {
    const today = todayMvd()
    finance.invoices.rows.forEach((i) => {
      if (i.status === 'pendiente' && i.due_date && i.due_date < today) i.status = 'vencido'
    })
    return
  }
  check(await sb().rpc('run_finance_jobs'))
}

// ================================================================ Cobros (invoices)
function demoInvoice(i: Tables<'invoices'>): Invoice {
  const c = clientOf(i.client_id)
  return {
    ...i,
    client_name: c?.brand_name ?? '—',
    client_color: c?.color_tag ?? null,
    project_name: projectOf(i.project_id)?.name ?? null,
    items: finance.invoiceItems.rows.filter((x) => x.invoice_id === i.id).sort((a, b) => a.position - b.position),
  }
}

export async function listInvoices(filter: { clientId?: string } = {}): Promise<Invoice[]> {
  if (isDemo) {
    await wait()
    return finance.invoices.rows
      .filter((i) => !i.deleted_at && (!filter.clientId || i.client_id === filter.clientId))
      .map(demoInvoice)
      .sort((a, b) => b.issue_date.localeCompare(a.issue_date) || (b.number ?? '').localeCompare(a.number ?? ''))
  }
  let q = sb()
    .from('invoices')
    .select('*, client:clients(brand_name, color_tag), project:projects(name), items:invoice_items(*)')
    .is('deleted_at', null)
  if (filter.clientId) q = q.eq('client_id', filter.clientId)
  const rows = check(await q.order('issue_date', { ascending: false }).order('number', { ascending: false }).limit(1000))
  return rows.map(({ client, project, items, ...i }) => ({
    ...i,
    client_name: client?.brand_name ?? '—',
    client_color: client?.color_tag ?? null,
    project_name: project?.name ?? null,
    items: [...items].sort((a, b) => a.position - b.position),
  }))
}

export interface InvoiceInput {
  client_id: string
  project_id: string | null
  issue_date: string
  due_date: string | null
  currency: Currency
  vat_rate: number
  notes: string | null
  cfe_number: string | null
  items: LineItem[]
}

export async function saveInvoice(input: InvoiceInput, invoiceId?: string): Promise<string> {
  const { items, ...head } = input
  if (isDemo) {
    await wait()
    const subtotal = itemsSubtotal(items)
    const fx = demoFx(head.currency, head.issue_date)
    const values = { ...head, fx_rate: fx, subtotal, total: round2(subtotal * (1 + head.vat_rate / 100)) }
    let id = invoiceId
    if (id) finance.invoices.update(id, values)
    else
      id = finance.invoices.insert({
        ...values, number: demoNumber('R'), recurring_fee_id: null, status: 'pendiente', paid_at: null, payment_method: null,
        pdf_path: null, created_by: DEMO_USER_ID, deleted_at: null,
      } as Tables<'invoices'>).id
    finance.invoiceItems.rows = finance.invoiceItems.rows.filter((x) => x.invoice_id !== id)
    items.forEach((it, i) => finance.invoiceItems.insert({ invoice_id: id!, ...it, position: i + 1 }))
    return id
  }
  let id = invoiceId
  if (id) check(await sb().from('invoices').update(head).eq('id', id))
  else {
    const res = await sb().from('invoices').insert(head).select('id').single()
    if (res.error) throw res.error
    id = res.data.id
  }
  check(await sb().from('invoice_items').delete().eq('invoice_id', id))
  if (items.length) check(await sb().from('invoice_items').insert(items.map((it, i) => ({ invoice_id: id!, ...it, position: i + 1 }))))
  return id
}

export async function updateInvoice(invoiceId: string, patch: TablesUpdate<'invoices'>) {
  if (isDemo) {
    await wait(120)
    const p = { ...patch }
    if (p.status === 'cobrado' && !p.paid_at) p.paid_at = new Date().toISOString()
    if (p.status && p.status !== 'cobrado') p.paid_at = null
    finance.invoices.update(invoiceId, p)
    return
  }
  check(await sb().from('invoices').update(patch).eq('id', invoiceId))
}

export const deleteInvoice = (invoiceId: string) => updateInvoice(invoiceId, { deleted_at: new Date().toISOString() })

// ================================================================ Presupuestos (quotes)
function demoQuote(q: Tables<'quotes'>): Quote {
  const c = clientOf(q.client_id)
  return {
    ...q,
    client_name: c?.brand_name ?? '—',
    client_color: c?.color_tag ?? null,
    project_name: projectOf(q.project_id)?.name ?? null,
    items: finance.quoteItems.rows.filter((x) => x.quote_id === q.id).sort((a, b) => a.position - b.position),
  }
}

export async function listQuotes(filter: { clientId?: string } = {}): Promise<Quote[]> {
  if (isDemo) {
    await wait()
    const today = todayMvd()
    return finance.quotes.rows
      .filter((q) => !q.deleted_at && (!filter.clientId || q.client_id === filter.clientId))
      .map((q) => (q.status === 'enviado' && q.valid_until && q.valid_until < today ? { ...q, status: 'vencido' as const } : q))
      .map(demoQuote)
      .sort((a, b) => b.issue_date.localeCompare(a.issue_date))
  }
  let q = sb().from('quotes').select('*, client:clients(brand_name, color_tag), project:projects(name), items:quote_items(*)').is('deleted_at', null)
  if (filter.clientId) q = q.eq('client_id', filter.clientId)
  const rows = check(await q.order('issue_date', { ascending: false }).limit(500))
  const today = todayMvd()
  return rows.map(({ client, project, items, ...x }) => ({
    ...x,
    // Un presupuesto enviado cuya validez pasó se muestra como vencido
    status: x.status === 'enviado' && x.valid_until && x.valid_until < today ? 'vencido' : x.status,
    client_name: client?.brand_name ?? '—',
    client_color: client?.color_tag ?? null,
    project_name: project?.name ?? null,
    items: [...items].sort((a, b) => a.position - b.position),
  }))
}

export interface QuoteInput {
  client_id: string
  project_id: string | null
  issue_date: string
  valid_until: string | null
  currency: Currency
  vat_rate: number
  discount: number
  notes: string | null
  items: LineItem[]
}

export async function saveQuote(input: QuoteInput, quoteId?: string): Promise<string> {
  const { items, ...head } = input
  if (isDemo) {
    await wait()
    const subtotal = itemsSubtotal(items)
    const values = { ...head, fx_rate: demoFx(head.currency, head.issue_date), subtotal, total: round2((subtotal - head.discount) * (1 + head.vat_rate / 100)) }
    let id = quoteId
    if (id) finance.quotes.update(id, values)
    else id = finance.quotes.insert({ ...values, number: demoNumber('P'), status: 'borrador', pdf_path: null, created_by: DEMO_USER_ID, deleted_at: null } as Tables<'quotes'>).id
    finance.quoteItems.rows = finance.quoteItems.rows.filter((x) => x.quote_id !== id)
    items.forEach((it, i) => finance.quoteItems.insert({ quote_id: id!, ...it, position: i + 1 }))
    return id
  }
  let id = quoteId
  if (id) check(await sb().from('quotes').update(head).eq('id', id))
  else {
    const res = await sb().from('quotes').insert(head).select('id').single()
    if (res.error) throw res.error
    id = res.data.id
  }
  check(await sb().from('quote_items').delete().eq('quote_id', id))
  if (items.length) check(await sb().from('quote_items').insert(items.map((it, i) => ({ quote_id: id!, ...it, position: i + 1 }))))
  return id
}

export async function updateQuote(quoteId: string, patch: TablesUpdate<'quotes'>) {
  if (isDemo) {
    finance.quotes.update(quoteId, patch)
    return
  }
  check(await sb().from('quotes').update(patch).eq('id', quoteId))
}

export const deleteQuote = (quoteId: string) => updateQuote(quoteId, { deleted_at: new Date().toISOString() })

/** Presupuesto aceptado → cobro pendiente con los mismos ítems. Devuelve el id del cobro. */
export async function quoteToInvoice(q: Quote): Promise<string> {
  const items: LineItem[] = q.items.map((i) => ({ description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price) }))
  if (Number(q.discount) > 0) items.push({ description: 'Descuento', quantity: 1, unit_price: -Number(q.discount) })
  const id = await saveInvoice({
    client_id: q.client_id,
    project_id: q.project_id,
    issue_date: todayMvd(),
    due_date: null,
    currency: q.currency,
    vat_rate: Number(q.vat_rate),
    notes: `Según presupuesto ${q.number}.`,
    cfe_number: null,
    items,
  })
  await updateQuote(q.id, { status: 'aceptado' })
  return id
}

// ================================================================ Gastos
function demoExpense(e: Tables<'expenses'>): Expense {
  return { ...e, client_name: clientOf(e.client_id)?.brand_name ?? null, project_name: projectOf(e.project_id)?.name ?? null }
}

/** Todos los gastos: los reales y las plantillas de gastos recurrentes (is_recurring). */
export async function listExpenses(): Promise<Expense[]> {
  if (isDemo) {
    await wait()
    return finance.expenses.rows.filter((e) => !e.deleted_at).map(demoExpense).sort((a, b) => b.date.localeCompare(a.date))
  }
  const rows = check(
    await sb().from('expenses').select('*, client:clients(brand_name), project:projects(name)').is('deleted_at', null).order('date', { ascending: false }).limit(2000),
  )
  return rows.map(({ client, project, ...e }) => ({ ...e, client_name: client?.brand_name ?? null, project_name: project?.name ?? null }))
}

export interface ExpenseInput {
  category: ExpenseCategory
  description: string
  amount: number
  currency: Currency
  date: string
  client_id: string | null
  project_id: string | null
  is_recurring: boolean
  recurrence_day: number | null
}

export async function saveExpense(input: ExpenseInput, expenseId?: string): Promise<string> {
  if (isDemo) {
    await wait()
    const values = { ...input, fx_rate: demoFx(input.currency, input.date) }
    if (expenseId) {
      finance.expenses.update(expenseId, values)
      return expenseId
    }
    const e = finance.expenses.insert({ ...values, receipt_path: null, parent_expense_id: null, created_by: DEMO_USER_ID, deleted_at: null } as Tables<'expenses'>)
    // En demo, un gasto recurrente registra el del mes en el momento
    if (e.is_recurring && e.recurrence_day) {
      const today = todayMvd()
      const d = `${today.slice(0, 8)}${String(e.recurrence_day).padStart(2, '0')}`
      if (d <= today) finance.expenses.insert({ ...values, date: d, is_recurring: false, recurrence_day: null, fx_rate: demoFx(e.currency, d), receipt_path: null, parent_expense_id: e.id, created_by: DEMO_USER_ID, deleted_at: null } as Tables<'expenses'>)
    }
    return e.id
  }
  if (expenseId) {
    check(await sb().from('expenses').update(input).eq('id', expenseId))
    return expenseId
  }
  const res = await sb().from('expenses').insert(input).select('id').single()
  if (res.error) throw res.error
  if (input.is_recurring) await runFinanceJobs()
  return res.data.id
}

export async function deleteExpense(expenseId: string) {
  if (isDemo) {
    finance.expenses.update(expenseId, { deleted_at: new Date().toISOString() })
    return
  }
  check(await sb().from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', expenseId))
}

// ================================================================ Fees recurrentes
export async function listFees(): Promise<Fee[]> {
  if (isDemo) {
    await wait()
    return finance.fees.rows.map((f) => ({ ...f, client_name: clientOf(f.client_id)?.brand_name ?? '—', client_color: clientOf(f.client_id)?.color_tag ?? null }))
  }
  const rows = check(await sb().from('recurring_fees').select('*, client:clients(brand_name, color_tag)').order('created_at'))
  return rows.map(({ client, ...f }) => ({ ...f, client_name: client?.brand_name ?? '—', client_color: client?.color_tag ?? null }))
}

export type FeeInput = Pick<Tables<'recurring_fees'>, 'client_id' | 'description' | 'amount' | 'currency' | 'billing_day' | 'start_date' | 'end_date' | 'is_active'>

export async function saveFee(input: FeeInput, feeId?: string) {
  if (isDemo) {
    await wait()
    if (feeId) finance.fees.update(feeId, input)
    else finance.fees.insert(input as Tables<'recurring_fees'>)
    return
  }
  if (feeId) check(await sb().from('recurring_fees').update(input).eq('id', feeId))
  else check(await sb().from('recurring_fees').insert(input))
  await runFinanceJobs()
}

export async function deleteFee(feeId: string) {
  if (isDemo) {
    finance.fees.remove(feeId)
    return
  }
  check(await sb().from('recurring_fees').delete().eq('id', feeId))
}

/** Tipo de cambio vigente (el último cargado). */
export async function currentFx(): Promise<number | null> {
  if (isDemo) return demo.exchangeRates.length ? Number([...demo.exchangeRates].sort((a, b) => b.date.localeCompare(a.date))[0].usd_to_uyu) : null
  const { data: r, error } = await sb().from('exchange_rates').select('usd_to_uyu').order('date', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return r ? Number(r.usd_to_uyu) : null
}
