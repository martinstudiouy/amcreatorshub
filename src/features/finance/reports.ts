// Cálculos de reportes de Finanzas. Todo se pasa a pesos (UYU) con el tipo de
// cambio que quedó guardado en cada cobro o gasto, así los meses pasados no cambian.
import type { Expense, Fee, Invoice } from '@/data/finance'

export type MonthKey = string // AAAA-MM

export const MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']
export const monthShort = (k: MonthKey) => `${MONTHS_SHORT[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`

export function addMonthsKey(k: MonthKey, n: number): MonthKey {
  const [y, m] = k.split('-').map(Number)
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

const uyu = (amount: number | string, fx: number | string) => Number(amount) * Number(fx)
/** Fecha local de Montevideo (AAAA-MM-DD) de un instante */
const mvdDate = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 10)

/** Cobros que cuentan: no anulados ni borrados */
export const countable = (i: Invoice) => i.status !== 'anulado' && !i.deleted_at
/** Gastos reales (no las plantillas de gastos recurrentes) */
export const realExpense = (e: Expense) => !e.is_recurring && !e.deleted_at

export interface MonthRow {
  month: MonthKey
  billed: number // facturado (por fecha de emisión)
  collected: number // cobrado (por fecha de cobro)
  expenses: number
  result: number // facturado − gastos
}

/** Últimos `n` meses terminando en `lastMonth` (incluido). */
export function monthlySeries(invoices: Invoice[], expenses: Expense[], lastMonth: MonthKey, n = 6): MonthRow[] {
  const months = Array.from({ length: n }, (_, i) => addMonthsKey(lastMonth, i - (n - 1)))
  return months.map((m) => {
    const billed = invoices.filter((i) => countable(i) && i.issue_date.startsWith(m)).reduce((s, i) => s + uyu(i.total, i.fx_rate), 0)
    const collected = invoices
      .filter((i) => i.status === 'cobrado' && !i.deleted_at && i.paid_at && mvdDate(i.paid_at).startsWith(m))
      .reduce((s, i) => s + uyu(i.total, i.fx_rate), 0)
    const exp = expenses.filter((e) => realExpense(e) && e.date.startsWith(m)).reduce((s, e) => s + uyu(e.amount, e.fx_rate), 0)
    return { month: m, billed: round(billed), collected: round(collected), expenses: round(exp), result: round(billed - exp) }
  })
}

export interface Receivables {
  pending: number
  pendingCount: number
  overdue: number
  overdueCount: number
}

export function receivables(invoices: Invoice[]): Receivables {
  const p = invoices.filter((i) => i.status === 'pendiente' && !i.deleted_at)
  const o = invoices.filter((i) => i.status === 'vencido' && !i.deleted_at)
  const sum = (xs: Invoice[]) => round(xs.reduce((s, i) => s + uyu(i.total, i.fx_rate), 0))
  return { pending: sum(p), pendingCount: p.length, overdue: sum(o), overdueCount: o.length }
}

export interface ClientRow {
  clientId: string
  clientName: string
  color: string | null
  billed: number
  collected: number
  expenses: number
  margin: number
  marginPct: number | null
}

/** Rentabilidad por cliente en un período [from, to] (fechas AAAA-MM-DD). */
export function byClient(invoices: Invoice[], expenses: Expense[], from: string, to: string): ClientRow[] {
  const map = new Map<string, ClientRow>()
  const row = (id: string, name: string, color: string | null) => {
    if (!map.has(id)) map.set(id, { clientId: id, clientName: name, color, billed: 0, collected: 0, expenses: 0, margin: 0, marginPct: null })
    return map.get(id)!
  }
  invoices
    .filter((i) => countable(i) && i.issue_date >= from && i.issue_date <= to)
    .forEach((i) => {
      const r = row(i.client_id, i.client_name, i.client_color)
      r.billed += uyu(i.total, i.fx_rate)
      if (i.status === 'cobrado') r.collected += uyu(i.total, i.fx_rate)
    })
  expenses
    .filter((e) => realExpense(e) && e.client_id && e.date >= from && e.date <= to)
    .forEach((e) => {
      row(e.client_id!, e.client_name ?? '—', null).expenses += uyu(e.amount, e.fx_rate)
    })
  return [...map.values()]
    .map((r) => {
      const margin = r.billed - r.expenses
      return { ...r, billed: round(r.billed), collected: round(r.collected), expenses: round(r.expenses), margin: round(margin), marginPct: r.billed > 0 ? Math.round((margin / r.billed) * 100) : null }
    })
    .sort((a, b) => b.margin - a.margin)
}

export interface ProjectRow {
  projectId: string
  projectName: string
  clientName: string
  budget: number | null
  billed: number
  expenses: number
  margin: number
  billedPct: number | null
}

/** Rentabilidad por proyecto (todo el historial del proyecto). */
export function byProject(
  projects: { id: string; name: string; client_name: string; budget: number | null; currency: string; status: string }[],
  invoices: Invoice[],
  expenses: Expense[],
  usdToUyu: number | null,
): ProjectRow[] {
  return projects
    .map((p) => {
      const billed = invoices.filter((i) => countable(i) && i.project_id === p.id).reduce((s, i) => s + uyu(i.total, i.fx_rate), 0)
      const exp = expenses.filter((e) => realExpense(e) && e.project_id === p.id).reduce((s, e) => s + uyu(e.amount, e.fx_rate), 0)
      const budget = p.budget == null ? null : p.currency === 'USD' ? (usdToUyu ? Number(p.budget) * usdToUyu : null) : Number(p.budget)
      return {
        projectId: p.id,
        projectName: p.name,
        clientName: p.client_name,
        budget: budget == null ? null : round(budget),
        billed: round(billed),
        expenses: round(exp),
        margin: round(billed - exp),
        billedPct: budget ? Math.round((billed / budget) * 100) : null,
      }
    })
    .filter((r) => r.billed > 0 || r.expenses > 0 || r.budget)
    .sort((a, b) => b.billed - a.billed)
}

export interface ProjectionRow {
  month: MonthKey
  fees: number
  receivables: number
  expenses: number
  result: number
}

/**
 * Proyección de los próximos `n` meses (empezando el mes siguiente a `thisMonth`):
 * fees recurrentes activos + cobros pendientes que vencen ese mes − gastos recurrentes.
 * Los montos en dólares usan el tipo de cambio vigente.
 */
export function projection(fees: Fee[], invoices: Invoice[], expenseTemplates: Expense[], thisMonth: MonthKey, usdToUyu: number | null, vatRate: number, n = 3): ProjectionRow[] {
  const fx = (cur: string) => (cur === 'USD' ? (usdToUyu ?? 0) : 1)
  return Array.from({ length: n }, (_, i) => addMonthsKey(thisMonth, i + 1)).map((m) => {
    const start = `${m}-01`
    const feesTotal = fees
      .filter((f) => f.is_active && f.start_date <= `${m}-28` && (!f.end_date || f.end_date >= start))
      .reduce((s, f) => s + Number(f.amount) * (1 + vatRate / 100) * fx(f.currency), 0)
    const recv = invoices
      .filter((i) => (i.status === 'pendiente' || i.status === 'vencido') && !i.deleted_at && i.due_date?.startsWith(m))
      .reduce((s, i) => s + uyu(i.total, i.fx_rate), 0)
    const exp = expenseTemplates
      .filter((e) => e.is_recurring && !e.deleted_at && e.date <= `${m}-28`)
      .reduce((s, e) => s + Number(e.amount) * fx(e.currency), 0)
    return { month: m, fees: round(feesTotal), receivables: round(recv), expenses: round(exp), result: round(feesTotal + recv - exp) }
  })
}

/** Gastos del período agrupados por categoría */
export function expensesByCategory(expenses: Expense[], from: string, to: string) {
  const map = new Map<string, number>()
  expenses
    .filter((e) => realExpense(e) && e.date >= from && e.date <= to)
    .forEach((e) => map.set(e.category, (map.get(e.category) ?? 0) + uyu(e.amount, e.fx_rate)))
  return [...map.entries()].map(([category, total]) => ({ category, total: round(total) })).sort((a, b) => b.total - a.total)
}

const round = (n: number) => Math.round(n * 100) / 100
