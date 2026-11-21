// Fechas de la agenda, siempre en hora de Montevideo (UTC-3 todo el año).
import { addDays, todayMvd } from '@/lib/format'

export const MVD_OFFSET = '-03:00'
export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'setiembre', 'octubre', 'noviembre', 'diciembre']

/** AAAA-MM-DD local de un instante */
export const localDate = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(0, 10)
/** HH:MM local de un instante */
export const localTime = (iso: string) => new Date(new Date(iso).getTime() - 3 * 3600_000).toISOString().slice(11, 16)
/** Minutos desde las 00:00 locales */
export const localMinutes = (iso: string) => {
  const [h, m] = localTime(iso).split(':').map(Number)
  return h * 60 + m
}
/** Instante ISO a partir de fecha local + hora local */
export const toIso = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00${MVD_OFFSET}`).toISOString()

/** Lunes de la semana de esa fecha */
export function startOfWeek(date: string) {
  const dow = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7
  return addDays(date, -dow)
}

/** Las 6 semanas (42 días) que muestra la vista mes */
export function monthGrid(date: string) {
  const first = `${date.slice(0, 7)}-01`
  const start = startOfWeek(first)
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

export function addMonths(date: string, n: number) {
  const d = new Date(`${date.slice(0, 7)}-01T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().slice(0, 10)
}

export const isToday = (date: string) => date === todayMvd()

export function monthLabel(date: string) {
  const m = MONTHS[Number(date.slice(5, 7)) - 1]
  return `${m.charAt(0).toUpperCase()}${m.slice(1)} ${date.slice(0, 4)}`
}

export function weekLabel(date: string) {
  const s = startOfWeek(date)
  const e = addDays(s, 6)
  const sm = MONTHS[Number(s.slice(5, 7)) - 1]
  const em = MONTHS[Number(e.slice(5, 7)) - 1]
  return sm === em ? `${Number(s.slice(8))} al ${Number(e.slice(8))} de ${em}` : `${Number(s.slice(8))} de ${sm} al ${Number(e.slice(8))} de ${em}`
}

/** El evento ocupa ese día (local)? */
export const coversDay = (e: { starts_at: string; ends_at: string }, day: string) => localDate(e.starts_at) <= day && localDate(e.ends_at) >= day
