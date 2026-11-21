import { CalendarDays } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ClientChip } from '@/components/common/client-chip'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { ProjectOverview } from '@/data/crm'
import { projectStatusLabel, projectStatusVariant, serviceLabel } from '@/data/labels'
import { formatDate, formatMoney, todayMvd } from '@/lib/format'
import { cn } from '@/lib/utils'

export function ProjectProgress({ done, total, className }: { done: number; total: number; className?: string }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{total ? `${done} de ${total} tareas` : 'Sin tareas'}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export function ProjectCard({ p, showClient = true }: { p: ProjectOverview; showClient?: boolean }) {
  const late = p.status === 'activo' && p.due_date && p.due_date < todayMvd()
  return (
    <Link to={`/proyectos/${p.id}`} className="block">
      <Card className="flex h-full flex-col gap-3 p-5 transition-colors hover:border-foreground/15">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">{p.name}</p>
            {showClient && <ClientChip name={p.client_name} color={p.client_color} className="mt-1 text-xs text-muted-foreground" />}
          </div>
          <Badge variant={projectStatusVariant[p.status]}>{projectStatusLabel[p.status]}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          <span>{serviceLabel[p.type]}</span>
          {p.due_date && (
            <span className={cn('inline-flex items-center gap-1', late && 'font-medium text-destructive')}>
              <CalendarDays className="size-3.5" />
              {late ? 'Venció el ' : 'Entrega '}
              {formatDate(p.due_date)}
            </span>
          )}
          {p.budget != null && <span className="tabular-nums">{formatMoney(p.budget, p.currency)}</span>}
        </div>
        <ProjectProgress done={p.tasks_done ?? 0} total={p.tasks_total ?? 0} className="mt-auto" />
      </Card>
    </Link>
  )
}
