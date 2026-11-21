import { GanttChart } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/common/empty-state'
import { Card } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { ProjectOverview, TaskOverview } from '@/data/crm'
import { formatDate, todayMvd } from '@/lib/format'

const DAY = 86_400_000
const toMs = (iso: string) => Date.parse(`${iso}T12:00:00Z`)
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']

/** Timeline: cada proyecto es una barra de inicio a entrega; los puntos son las tareas pendientes. */
export function ProjectTimeline({ projects, tasks }: { projects: ProjectOverview[]; tasks: TaskOverview[] }) {
  const today = todayMvd()
  const rows = projects.filter((p) => p.start_date || p.due_date)

  const range = useMemo(() => {
    const dates = rows.flatMap((p) => [p.start_date, p.due_date]).filter(Boolean).map((d) => toMs(d!))
    let from = Math.min(toMs(today) - 14 * DAY, ...dates)
    let to = Math.max(toMs(today) + 30 * DAY, ...dates)
    // Empieza un lunes y no pasa de ~8 meses para que se lea
    const dow = (new Date(from).getUTCDay() + 6) % 7
    from -= dow * DAY
    to = Math.min(to + 7 * DAY, from + 240 * DAY)
    return { from, to, days: Math.round((to - from) / DAY) }
  }, [rows, today])

  if (!rows.length)
    return (
      <Card>
        <EmptyState compact icon={GanttChart} title="No hay proyectos con fechas" description="Poné fecha de inicio y de entrega a tus proyectos para verlos en el timeline." />
      </Card>
    )

  const pct = (ms: number) => Math.max(0, Math.min(100, ((ms - range.from) / (range.to - range.from)) * 100))
  const weeks = Array.from({ length: Math.ceil(range.days / 7) }, (_, i) => range.from + i * 7 * DAY)
  const months: { label: string; left: number }[] = []
  for (let ms = range.from; ms < range.to; ms += DAY) {
    const d = new Date(ms)
    if (d.getUTCDate() === 1 || ms === range.from) months.push({ label: `${MONTHS[d.getUTCMonth()].replace(/^./, (x) => x.toUpperCase())} ${String(d.getUTCFullYear()).slice(2)}`, left: pct(ms) })
  }
  const todayLeft = pct(toMs(today))

  return (
    <Card className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className="relative ml-56 h-12 border-b">
          {months.map((m) => (
            <span key={m.left} className="absolute top-2 text-xs font-semibold" style={{ left: `${m.left}%` }}>
              {m.label}
            </span>
          ))}
          {weeks.map((w) => (
            <span key={w} className="absolute bottom-1.5 text-[10px] text-muted-foreground tabular-nums" style={{ left: `${pct(w)}%` }}>
              {new Date(w).getUTCDate()}
            </span>
          ))}
        </div>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-56 right-0">
            {weeks.map((w) => (
              <span key={w} className="absolute inset-y-0 border-l border-border/60" style={{ left: `${pct(w)}%` }} />
            ))}
            <span className="absolute inset-y-0 z-10 border-l-2 border-primary" style={{ left: `${todayLeft}%` }}>
              <span className="absolute -top-0.5 -translate-x-1/2 rounded bg-primary px-1 text-[10px] font-semibold text-primary-foreground">Hoy</span>
            </span>
          </div>
          {rows.map((p) => {
            const start = toMs(p.start_date ?? p.due_date!)
            const end = toMs(p.due_date ?? p.start_date!) + DAY
            const left = pct(start)
            const width = Math.max(pct(end) - left, 1.2)
            const done = p.tasks_total ? (p.tasks_done ?? 0) / p.tasks_total : 0
            const color = p.client_color ?? '#64748B'
            const late = p.status === 'activo' && p.due_date && p.due_date < today
            const pending = tasks.filter((t) => t.project_id === p.id && t.due_date && t.column !== 'aprobado' && t.column !== 'entregado')
            return (
              <div key={p.id} className="flex h-14 items-center border-b last:border-b-0">
                <Link to={`/proyectos/${p.id}`} className="w-56 shrink-0 truncate px-4 hover:text-brand">
                  <span className="block truncate text-sm font-medium">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{p.client_name}</span>
                </Link>
                <div className="relative h-full flex-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        to={`/proyectos/${p.id}`}
                        className="absolute top-1/2 h-7 -translate-y-1/2 overflow-hidden rounded-md border"
                        style={{ left: `${left}%`, width: `${width}%`, borderColor: color, background: `${color}22`, opacity: p.status === 'activo' ? 1 : 0.55 }}
                        aria-label={`${p.name}: ${formatDate(p.start_date)} a ${formatDate(p.due_date)}`}
                      >
                        <span className="absolute inset-y-0 left-0" style={{ width: `${done * 100}%`, background: `${color}55` }} />
                        {late && <span className="absolute inset-y-0 right-0 w-1 bg-destructive" />}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>
                      {p.name} · {formatDate(p.start_date) || '¿?'} → {formatDate(p.due_date) || '¿?'} · {Math.round(done * 100)}% hecho
                    </TooltipContent>
                  </Tooltip>
                  {pending.map((t) => (
                    <Tooltip key={t.id}>
                      <TooltipTrigger asChild>
                        <span className="absolute top-1/2 z-[5] size-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-card" style={{ left: `${pct(toMs(t.due_date!) + DAY / 2)}%`, background: t.due_date! < today ? 'var(--destructive)' : color }} />
                      </TooltipTrigger>
                      <TooltipContent>{t.title} · vence {formatDate(t.due_date)}</TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex flex-wrap gap-4 border-t px-4 py-2.5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><span className="h-3 w-6 rounded border border-primary bg-primary/15" /> Proyecto (lo oscuro es lo avanzado)</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rotate-45 bg-primary" /> Tarea pendiente</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rotate-45 bg-destructive" /> Tarea vencida</span>
      </div>
    </Card>
  )
}
