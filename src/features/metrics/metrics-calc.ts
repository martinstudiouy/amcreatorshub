// Cálculos de métricas de Instagram (sin dependencias de React: se prueban solos).
import type { DailyMetric, PostMetric } from '@/data/instagram'

export interface Summary {
  followersStart: number | null
  followersEnd: number | null
  followersDelta: number | null
  reach: number
  views: number
  interactions: number
  engaged: number
  linkClicks: number
  /** Interacciones / alcance, en % */
  engagementRate: number | null
  posts: number
  days: number
}

const sum = (rows: DailyMetric[], k: keyof DailyMetric) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0)

/** Resume un período (las fechas son YYYY-MM-DD, ambas incluidas). */
export function summarize(daily: DailyMetric[], posts: PostMetric[], from: string, to: string): Summary {
  const rows = daily.filter((d) => d.date >= from && d.date <= to).sort((a, b) => a.date.localeCompare(b.date))
  const withFollowers = rows.filter((r) => r.followers != null)
  // Seguidores al inicio: el último dato antes del período (o el primero del período)
  const before = daily.filter((d) => d.date < from && d.followers != null).sort((a, b) => b.date.localeCompare(a.date))[0]
  const start = before?.followers ?? withFollowers[0]?.followers ?? null
  const end = withFollowers[withFollowers.length - 1]?.followers ?? null
  const reach = sum(rows, 'reach')
  const interactions = sum(rows, 'interactions')
  return {
    followersStart: start,
    followersEnd: end,
    followersDelta: start != null && end != null ? end - start : null,
    reach,
    views: sum(rows, 'views'),
    interactions,
    engaged: sum(rows, 'accounts_engaged'),
    linkClicks: sum(rows, 'link_clicks'),
    engagementRate: reach ? Math.round((interactions / reach) * 1000) / 10 : null,
    posts: posts.filter((p) => p.posted_at && p.posted_at.slice(0, 10) >= from && p.posted_at.slice(0, 10) <= to).length,
    days: rows.length,
  }
}

/** Variación porcentual (null si no se puede comparar). */
export const pctChange = (now: number | null, before: number | null) => (now == null || before == null || before === 0 ? null : Math.round(((now - before) / Math.abs(before)) * 100))

export const postInteractions = (p: PostMetric) => p.interactions ?? (p.likes ?? 0) + (p.comments ?? 0) + (p.saves ?? 0) + (p.shares ?? 0)
export const postEngagement = (p: PostMetric) => (p.reach ? Math.round((postInteractions(p) / p.reach) * 1000) / 10 : null)

export function topPosts(posts: PostMetric[], n = 5) {
  return [...posts].sort((a, b) => postInteractions(b) - postInteractions(a) || (b.reach ?? 0) - (a.reach ?? 0)).slice(0, n)
}

export const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const SLOTS = [
  { label: '6 a 9', from: 6, to: 9 },
  { label: '9 a 12', from: 9, to: 12 },
  { label: '12 a 15', from: 12, to: 15 },
  { label: '15 a 18', from: 15, to: 18 },
  { label: '18 a 21', from: 18, to: 21 },
  { label: '21 a 24', from: 21, to: 24 },
]

/** Hora y día de Montevideo de una fecha ISO. */
function mvdParts(iso: string) {
  const d = new Date(new Date(iso).getTime() - 3 * 3600_000)
  return { weekday: (d.getUTCDay() + 6) % 7, hour: d.getUTCHours() }
}

export interface BestTimes {
  /** [día][franja] = interacciones promedio por publicación (null si no hay datos) */
  grid: (number | null)[][]
  counts: number[][]
  best: { weekday: number; slot: number; avg: number } | null
  bestSlot: { slot: number; avg: number } | null
  bestDay: { weekday: number; avg: number } | null
  sample: number
}

/** Mejor día y franja horaria según las interacciones de las publicaciones. */
export function bestTimes(posts: PostMetric[]): BestTimes {
  const total = Array.from({ length: 7 }, () => SLOTS.map(() => 0))
  const counts = Array.from({ length: 7 }, () => SLOTS.map(() => 0))
  const valid = posts.filter((p) => p.posted_at)
  for (const p of valid) {
    const { weekday, hour } = mvdParts(p.posted_at!)
    const slot = SLOTS.findIndex((s) => hour >= s.from && hour < s.to)
    if (slot < 0) continue
    total[weekday][slot] += postInteractions(p)
    counts[weekday][slot] += 1
  }
  const grid = total.map((row, d) => row.map((t, s) => (counts[d][s] ? Math.round(t / counts[d][s]) : null)))
  let best: BestTimes['best'] = null
  grid.forEach((row, d) => row.forEach((v, s) => v != null && (!best || v > best.avg) && (best = { weekday: d, slot: s, avg: v })))
  const avg = (t: number[], c: number[]) => (c.reduce((a, b) => a + b, 0) ? t.reduce((a, b) => a + b, 0) / c.reduce((a, b) => a + b, 0) : null)
  let bestSlot: BestTimes['bestSlot'] = null
  SLOTS.forEach((_, s) => {
    const v = avg(total.map((r) => r[s]), counts.map((r) => r[s]))
    if (v != null && (!bestSlot || v > bestSlot.avg)) bestSlot = { slot: s, avg: Math.round(v) }
  })
  let bestDay: BestTimes['bestDay'] = null
  total.forEach((r, d) => {
    const v = avg(r, counts[d])
    if (v != null && (!bestDay || v > bestDay.avg)) bestDay = { weekday: d, avg: Math.round(v) }
  })
  return { grid, counts, best, bestSlot, bestDay, sample: valid.length }
}

/** Primer y último día de un mes (YYYY-MM) y del mes anterior. */
export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const prevDate = new Date(Date.UTC(y, m - 2, 1))
  const prev = prevDate.toISOString().slice(0, 7)
  const prevLast = new Date(Date.UTC(prevDate.getUTCFullYear(), prevDate.getUTCMonth() + 1, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}`, prevFrom: `${prev}-01`, prevTo: `${prev}-${String(prevLast).padStart(2, '0')}`, prev }
}

/** Rango ISO (para filtrar publicaciones por fecha y hora de Montevideo). */
export const isoRange = (from: string, to: string) => ({ from: new Date(`${from}T00:00:00-03:00`).toISOString(), to: new Date(new Date(`${to}T00:00:00-03:00`).getTime() + 864e5).toISOString() })
