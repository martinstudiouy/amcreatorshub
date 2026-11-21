import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, Columns3, Ellipsis, FolderKanban, List, Pencil, Plus, Trash2, Wallet } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ClientChip } from '@/components/common/client-chip'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { friendlyError } from '@/data/api'
import { archiveProject, getProject, listTasks } from '@/data/crm'
import { projectStatusLabel, projectStatusVariant, serviceLabel } from '@/data/labels'
import type { TaskColumn } from '@/data/types'
import { useRole } from '@/features/auth/auth-context'
import { formatDate, formatMoney, todayMvd } from '@/lib/format'
import { invalidateCrm } from '@/lib/invalidate'
import { KanbanBoard } from './kanban-board'
import { NewTaskDialog } from './new-task-dialog'
import { ProjectProgress } from './project-card'
import { ProjectFormDialog } from './project-form-dialog'
import { TaskList } from './task-list'
import { TaskSheet } from './task-sheet'
import { useParam, useTaskSheet } from './use-task-sheet'
import { ViewSwitch } from './view-switch'

const VIEWS = ['tablero', 'lista'] as const

export function ProjectDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isAdmin = useRole() === 'admin'
  const [view, setView] = useParam<(typeof VIEWS)[number]>('vista', 'tablero', VIEWS)
  const [showDone, setShowDone] = useState(true)
  const sheet = useTaskSheet()
  const [editing, setEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const [newTaskColumn, setNewTaskColumn] = useState<TaskColumn | null>(null)

  const { data: p, isLoading, error, refetch } = useQuery({ queryKey: ['project', id], queryFn: () => getProject(id) })
  const tasksQ = useQuery({ queryKey: ['tasks', { projectId: id }], queryFn: () => listTasks({ projectId: id }) })
  const archive = useMutation({
    mutationFn: () => archiveProject(id),
    onSuccess: () => {
      toast.success('Proyecto enviado a la papelera.')
      invalidateCrm(qc)
      navigate('/proyectos')
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />
  if (isLoading) return <Skeleton className="h-40" />
  if (!p)
    return (
      <Card>
        <EmptyState icon={FolderKanban} title="No encontramos este proyecto" description="Puede que lo hayan borrado." action={<Button variant="outline" onClick={() => navigate('/proyectos')}>Volver a proyectos</Button>} />
      </Card>
    )

  const late = p.status === 'activo' && p.due_date && p.due_date < todayMvd()

  return (
    <>
      <Link to="/proyectos" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Proyectos
      </Link>

      <Card className="mb-6 p-5 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{p.name}</h1>
              <Badge variant={projectStatusVariant[p.status]}>{projectStatusLabel[p.status]}</Badge>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
              <Link to={`/clientes/${p.client_id}`} className="hover:text-brand"><ClientChip name={p.client_name} color={p.client_color} /></Link>
              <span>{serviceLabel[p.type]}</span>
              {(p.start_date || p.due_date) && (
                <span className={late ? 'inline-flex items-center gap-1.5 font-medium text-destructive' : 'inline-flex items-center gap-1.5'}>
                  <CalendarDays className="size-4" />
                  {formatDate(p.start_date) || '¿?'} → {formatDate(p.due_date) || '¿?'}
                  {late && ' (atrasado)'}
                </span>
              )}
              {isAdmin && p.budget != null && (
                <span className="inline-flex items-center gap-1.5"><Wallet className="size-4" /> {formatMoney(p.budget, p.currency)}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}><Pencil /> Editar</Button>
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Más opciones"><Ellipsis /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-destructive" onSelect={() => setArchiving(true)}><Trash2 /> Enviar a la papelera</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <ProjectProgress done={p.tasks_done ?? 0} total={p.tasks_total ?? 0} className="mt-5 max-w-md" />
      </Card>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ViewSwitch value={view} onChange={setView} options={[{ id: 'tablero', label: 'Tablero', icon: Columns3 }, { id: 'lista', label: 'Lista', icon: List }]} />
        <div className="flex items-center gap-3">
          {view === 'lista' && (
            <span className="flex items-center gap-2">
              <Checkbox id="pd-done" checked={showDone} onCheckedChange={(v) => setShowDone(v === true)} />
              <Label htmlFor="pd-done" className="font-normal">Mostrar terminadas</Label>
            </span>
          )}
          <Button onClick={() => setNewTaskColumn('por_hacer')}><Plus /> Nueva tarea</Button>
        </div>
      </div>

      {tasksQ.error ? (
        <ErrorState error={tasksQ.error} onRetry={() => void tasksQ.refetch()} />
      ) : tasksQ.isLoading ? (
        <Skeleton className="h-64" />
      ) : view === 'tablero' ? (
        <KanbanBoard tasks={tasksQ.data ?? []} onOpen={sheet.open} onCreate={setNewTaskColumn} showProject={false} />
      ) : (
        <TaskList tasks={tasksQ.data ?? []} onOpen={sheet.open} showProject={false} showDone={showDone} />
      )}

      <TaskSheet taskId={sheet.taskId} onClose={sheet.close} />
      <NewTaskDialog open={!!newTaskColumn} onOpenChange={(o) => !o && setNewTaskColumn(null)} projectId={p.id} column={newTaskColumn ?? undefined} onCreated={sheet.open} />
      <ProjectFormDialog open={editing} onOpenChange={setEditing} project={p} />
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={`¿Enviar "${p.name}" a la papelera?`}
        description="El proyecto y sus tareas dejan de aparecer en las listas. Se puede recuperar."
        confirmLabel="Enviar a la papelera"
        destructive
        onConfirm={() => archive.mutateAsync()}
      />
    </>
  )
}
