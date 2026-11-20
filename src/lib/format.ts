// Formatos de AM Creators Hub: zona horaria America/Montevideo, fechas DD/MM/AAAA,
// moneda principal UYU con soporte para USD.
export const TZ = 'America/Montevideo'
export type Currency = 'UYU' | 'USD'

const dateFmt = new Intl.DateTimeFormat('es-UY', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' })
const timeFmt = new Intl.DateTimeFormat('es-UY', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false })
const longDateFmt = new Intl.DateTimeFormat('es-UY', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })

function toDate(v: string | Date) {
  if (v instanceof Date) return v
  // Las fechas sin hora ("2026-11-20") se interpretan como día calendario, no como UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d, 15))
  }
  return new Date(v)
}

/** 20/11/2026 */
export const formatDate = (v: string | Date | null | undefined) => (v ? dateFmt.format(toDate(v)) : '')
/** 14:30 */
export const formatTime = (v: string | Date | null | undefined) => (v ? timeFmt.format(toDate(v)) : '')
/** 20/11/2026 14:30 */
export const formatDateTime = (v: string | Date | null | undefined) => (v ? `${formatDate(v)} ${formatTime(v)}` : '')
/** viernes 20 de noviembre */
export const formatLongDate = (v: string | Date) => longDateFmt.format(toDate(v))

/** Fecha de hoy en Montevideo como AAAA-MM-DD */
export function todayMvd(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  return parts
}

export function addDays(isoDate: string, days: number) {
  const d = toDate(isoDate)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** $ 18.000 / US$ 900 */
export function formatMoney(amount: number | string | null | undefined, currency: Currency = 'UYU', opts: { decimals?: boolean } = {}) {
  if (amount === null || amount === undefined || amount === '') return '—'
  const n = typeof amount === 'string' ? Number(amount) : amount
  const fmt = new Intl.NumberFormat('es-UY', {
    minimumFractionDigits: opts.decimals ? 2 : 0,
    maximumFractionDigits: opts.decimals ? 2 : 0,
  })
  return `${currency === 'USD' ? 'US$' : '$'} ${fmt.format(n)}`
}

export const formatNumber = (n: number | null | undefined) =>
  n === null || n === undefined ? '—' : new Intl.NumberFormat('es-UY').format(n)

/** "hace 5 min", "hace 2 h", "ayer", o la fecha */
export function timeAgo(v: string | Date) {
  const d = toDate(v)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'recién'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  if (diff < 172800) return 'ayer'
  return formatDate(d)
}
