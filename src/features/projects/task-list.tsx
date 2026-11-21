import { ArrowDown, ArrowUp, ListTodo } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ClientChip } from '@/components/common/client-chip'
import { EmptyState } from '@/components/common/empty-state'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { TaskOverview } from '@/data/crm'
import { COLUMNS, PRIORITIES, columnLabel } from '@/data/labels'
import { cn } from '@/lib/utils'
import { AssigneeAvatar, DueBadge, PriorityBadge, TaskCounters } from './task-bits'

type SortKey = 'due' | 'priority' | 'status' | 'title'

/** Vista lista: todas las tareas en una tabla ordenable. */
export function TaskList({ tasks, onOpen, showProject = true, showDone }: { tasks: TaskOverview[]; onOpen: (id: string) => void; showProject?: boolean; showDone: boolean }) {
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'due', asc: true })
  const rows = useMemo(() => {
    const list = tasks.filter((t) => showDone || (t.column !== 'aprobado' && t.column !== 'entregado'))
    const cmp: Record<SortKey, (a: TaskOverview, b: TaskOverview) => number> = {
      due: (a, b) => (a.due_date ?? '9999').localeCompare(b.due_date ?? '9999'),
      priority: (a, b) => PRIORITIES.indexOf(b.priority) - PRIORITIES.indexOf(a.priority),
      status: (a, b) => COLUMNS.indexOf(a.column) - COLUMNS.indexOf(b.column),
      title: (a, b) => a.title.localeCompare(b.title),
    }
    return [...list].sort((a, b) => cmp[sort.key](a, b) * (sort.asc ? 1 : -1))
  }, [tasks, sort, showDone])

  if (!rows.length)
    return (
      <Card>
        <EmptyState compact icon={ListTodo} title="No hay tareas para mostrar" description={showDone ? 'Creá una con el botón "Nueva tarea".' : 'Todas están aprobadas o entregadas. Mostrá las terminadas para verlas.'} />
      </Card>
    )

  const Th = ({ k, children, className }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={cn('px-4 py-3 font-medium', className)}>
      <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setSort((s) => ({ key: k, asc: s.key === k ? !s.asc : true }))}>
        {children}
        {sort.key === k && (sort.asc ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  )

  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <Th k="title">Tarea</Th>
            {showProject && <th className="px-4 py-3 font-medium">Proyecto</th>}
            <th className="px-4 py-3 font-medium">Responsable</th>
            <Th k="due">Vence</Th>
            <Th k="priority">Prioridad</Th>
            <Th k="status">Estado</Th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((t) => (
            <tr key={t.id} className="cursor-pointer hover:bg-muted/40" onClick={() => onOpen(t.id)}>
              <td className="px-4 py-3">
                <button className="text-left font-medium hover:text-brand" onClick={(e) => { e.stopPropagation(); onOpen(t.id) }}>{t.title}</button>
                <div className="mt-1"><TaskCounters t={t} /></div>
              </td>
              {showProject && (
                <td className="px-4 py-3">
                  <span className="block truncate">{t.project_name}</span>
                  <ClientChip name={t.client_name} color={t.client_color} className="text-xs text-muted-foreground" />
                </td>
              )}
              <td className="px-4 py-3">
                <span className="flex items-center gap-2">
                  <AssigneeAvatar name={t.assignee_name} />
                  <span className={cn(!t.assignee_name && 'text-muted-foreground')}>{t.assignee_name ?? 'Sin asignar'}</span>
                </span>
              </td>
              <td className="px-4 py-3"><DueBadge task={t} /></td>
              <td className="px-4 py-3"><PriorityBadge priority={t.priority} /></td>
              <td className="px-4 py-3"><Badge variant={t.column === 'entregado' || t.column === 'aprobado' ? 'success' : t.column === 'en_revision' ? 'warning' : 'neutral'}>{columnLabel[t.column]}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}
