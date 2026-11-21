import { CalendarDays, CheckSquare, MessageSquare, Paperclip } from 'lucide-react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import type { TaskOverview } from '@/data/crm'
import { priorityLabel } from '@/data/labels'
import type { TaskPriority } from '@/data/types'
import { addDays, formatDate, todayMvd } from '@/lib/format'
import { cn } from '@/lib/utils'

const priorityColor: Record<TaskPriority, string> = {
  baja: 'bg-muted-foreground/40',
  media: 'bg-brand/60',
  alta: 'bg-warning',
  urgente: 'bg-destructive',
}

export function PriorityDot({ priority, className }: { priority: TaskPriority; className?: string }) {
  return <span className={cn('inline-block size-2.5 shrink-0 rounded-full', priorityColor[priority], className)} title={`Prioridad ${priorityLabel[priority].toLowerCase()}`} />
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <PriorityDot priority={priority} />
      {priorityLabel[priority]}
    </span>
  )
}

const isDone = (t: Pick<TaskOverview, 'column'>) => t.column === 'aprobado' || t.column === 'entregado'

/** "Vencida", "Hoy", "Mañana" o la fecha */
export function DueBadge({ task, compact }: { task: Pick<TaskOverview, 'due_date' | 'column'>; compact?: boolean }) {
  if (!task.due_date) return null
  const today = todayMvd()
  if (!isDone(task) && task.due_date < today) return <Badge variant="danger">Vencida {compact ? '' : formatDate(task.due_date)}</Badge>
  if (!isDone(task) && task.due_date === today) return <Badge variant="warning">Hoy</Badge>
  if (!isDone(task) && task.due_date === addDays(today, 1)) return <Badge variant="neutral">Mañana</Badge>
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <CalendarDays className="size-3.5" />
      {formatDate(task.due_date).slice(0, 5)}
    </span>
  )
}

export function TaskCounters({ t }: { t: TaskOverview }) {
  const total = t.checklist_total ?? 0
  const done = t.checklist_done ?? 0
  return (
    <span className="flex items-center gap-2.5 text-xs text-muted-foreground">
      {total > 0 && (
        <span className={cn('inline-flex items-center gap-1', done === total && 'text-success')}>
          <CheckSquare className="size-3.5" /> {done}/{total}
        </span>
      )}
      {(t.comments_count ?? 0) > 0 && (
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="size-3.5" /> {t.comments_count}
        </span>
      )}
      {(t.attachments_count ?? 0) > 0 && (
        <span className="inline-flex items-center gap-1">
          <Paperclip className="size-3.5" /> {t.attachments_count}
        </span>
      )}
    </span>
  )
}

export function AssigneeAvatar({ name }: { name: string | null }) {
  if (!name) return <span className="inline-block size-6 shrink-0 rounded-full border border-dashed border-muted-foreground/40" title="Sin responsable" />
  return <Avatar name={name} className="size-6 text-[10px]" />
}
