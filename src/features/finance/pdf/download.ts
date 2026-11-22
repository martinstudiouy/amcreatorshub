import { getSettings } from '@/data/api'
import type { Invoice, Quote } from '@/data/finance'
import type { PdfDoc } from './finance-pdf'

type ClientInfo = { brand_name: string; name?: string | null; email?: string | null; whatsapp?: string | null }

export function invoiceToPdf(i: Invoice, client: ClientInfo): PdfDoc {
  return {
    kind: 'recibo', number: i.number, issue_date: i.issue_date, due_date: i.due_date, currency: i.currency,
    items: i.items.map((x) => ({ description: x.description, quantity: Number(x.quantity), unit_price: Number(x.unit_price) })),
    subtotal: Number(i.subtotal), vat_rate: Number(i.vat_rate), total: Number(i.total), notes: i.notes, status: i.status,
    paid_at: i.paid_at, payment_method: i.payment_method, cfe_number: i.cfe_number, fx_rate: Number(i.fx_rate), client, project_name: i.project_name,
  }
}

export function quoteToPdf(q: Quote, client: ClientInfo): PdfDoc {
  return {
    kind: 'presupuesto', number: q.number, issue_date: q.issue_date, valid_until: q.valid_until, currency: q.currency,
    items: q.items.map((x) => ({ description: x.description, quantity: Number(x.quantity), unit_price: Number(x.unit_price) })),
    subtotal: Number(q.subtotal), discount: Number(q.discount), vat_rate: Number(q.vat_rate), total: Number(q.total), notes: q.notes,
    fx_rate: Number(q.fx_rate), client, project_name: q.project_name,
  }
}

/** Genera el PDF y lo descarga (si el navegador no deja descargar, lo abre en otra pestaña). */
export async function downloadPdf(doc: PdfDoc) {
  const [{ renderFinancePdf, pdfFileName }, studio] = await Promise.all([import('./finance-pdf'), getSettings()])
  const blob = await renderFinancePdf(doc, studio)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = pdfFileName(doc)
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
