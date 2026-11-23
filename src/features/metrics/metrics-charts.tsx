import { useState } from 'react'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

export const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('es-UY', { maximumFractionDigits: 1 })} M` : n >= 10_000 ? `${(n / 1000).toLocaleString('es-UY', { maximumFractionDigits: 1 })} mil` : formatNumber(Math.round(n)))
const dayLabel = (d: string) => `${Number(d.slice(8))}/${Number(d.slice(5, 7))}`

/** Línea simple (seguidores) con punto y valor al pasar el mouse. */
export function LineChart({ points, height = 180, color = '#0300FF' }: { points: { date: string; value: number | null }[]; height?: number; color?: string }) {
  const data = points.filter((p) => p.value != null) as { date: string; value: number }[]
  const [hover, setHover] = useState<number | null>(null)
  if (data.length < 2) return <p className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>Todavía no hay suficientes días para dibujar la evolución.</p>
  const values = data.map((d) => d.value)
  let min = Math.min(...values)
  let max = Math.max(...values)
  if (max === min) {
    max += 1
    min -= 1
  }
  const pad = (max - min) * 0.15
  min -= pad
  max += pad
  const W = 600
  const x = (i: number) => (i / (data.length - 1)) * W
  const y = (v: number) => height - ((v - min) / (max - min)) * height
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ')
  const area = `${line} L${W},${height} L0,${height} Z`
  const h = hover != null ? data[hover] : null
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        className="w-full overflow-visible"
        style={{ height }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          setHover(Math.max(0, Math.min(data.length - 1, Math.round(((e.clientX - r.left) / r.width) * (data.length - 1)))))
        }}
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`Seguidores: de ${formatNumber(data[0].value)} a ${formatNumber(data[data.length - 1].value)}`}
      >
        <defs>
          <linearGradient id="ig-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.18" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#ig-area)" />
        <path d={line} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {h && <line x1={x(hover!)} x2={x(hover!)} y1={0} y2={height} stroke="currentColor" strokeOpacity="0.15" vectorEffect="non-scaling-stroke" />}
      </svg>
      {h && (
        <div className="pointer-events-none absolute -top-2 rounded-md border bg-card px-2 py-1 text-xs shadow-soft" style={{ left: `clamp(0px, calc(${(hover! / (data.length - 1)) * 100}% - 40px), calc(100% - 90px))` }}>
          <span className="text-muted-foreground">{dayLabel(h.date)}</span> <strong className="tabular-nums">{formatNumber(h.value)}</strong>
        </div>
      )}
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>{dayLabel(data[0].date)}</span>
        <span>{dayLabel(data[Math.floor(data.length / 2)].date)}</span>
        <span>{dayLabel(data[data.length - 1].date)}</span>
      </div>
    </div>
  )
}

/** Barras diarias (alcance) con el valor al pasar el mouse. */
export function DailyBars({ points, height = 160, color = '#0300FF' }: { points: { date: string; value: number | null }[]; height?: number; color?: string }) {
  const max = Math.max(1, ...points.map((p) => p.value ?? 0))
  const [hover, setHover] = useState<number | null>(null)
  if (!points.some((p) => p.value)) return <p className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>Sin datos de alcance en este período.</p>
  return (
    <div>
      <div className="relative flex items-end gap-[2px]" style={{ height }} onMouseLeave={() => setHover(null)}>
        {points.map((p, i) => (
          <div key={p.date} className="flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
            <div className={cn('w-full rounded-t-[2px] transition-opacity', hover != null && hover !== i && 'opacity-50')} style={{ height: `${((p.value ?? 0) / max) * 100}%`, minHeight: p.value ? 2 : 0, background: color }} />
          </div>
        ))}
        {hover != null && (
          <div className="pointer-events-none absolute -top-2 rounded-md border bg-card px-2 py-1 text-xs shadow-soft" style={{ left: `clamp(0px, calc(${(hover / points.length) * 100}% - 40px), calc(100% - 100px))` }}>
            <span className="text-muted-foreground">{dayLabel(points[hover].date)}</span> <strong className="tabular-nums">{points[hover].value == null ? '—' : formatNumber(points[hover].value)}</strong>
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground tabular-nums">
        <span>{dayLabel(points[0].date)}</span>
        <span>{dayLabel(points[points.length - 1].date)}</span>
      </div>
    </div>
  )
}
