import { useQuery } from '@tanstack/react-query'
import { Columns3, FolderKanban, GanttChart, LayoutGrid, List, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { listClients, listMembers, listProjects, listTasks } from '@/data/crm'
import type { TaskColumn } from '@/data/types'
import { useAuth } from '@/features/auth/auth-context'
import { KanbanBoard } from './kanban-board'
import { NewTaskDialog } from './new-task-dialog'
import { ProjectCard } from './project-card'
import { ProjectFormDialog } from './project-form-dialog'
import { TaskList } from './task-list'
import { TaskSheet } from './task-sheet'
import { ProjectTimeline } from './timeline'
import { useParam, useTaskSheet } from './use-task-sheet'
import { ViewSwitch } from './view-switch'

const VIEWS = ['proyectos', 'tablero', 'lista', 'timeline'] as const
type View = (typeof VIEWS)[number]
const STATUS = ['en_curso', 'terminados', 'todos'] as const

export function ProjectsPage() {
  const navigate = useNavigate()
  const { userId } = useAuth()
  const [view, setView] = useParam<View>('vista', 'proyectos', VIEWS)
  const [clientId, setClientId] = useParam<string>('cliente', 'todos')
  const [assignee, setAssignee] = useParam<string>('responsable', 'todos')
  const [status, setStatus] = useParam<(typeof STATUS)[number]>('estado', 'en_curso', STATUS)
  const [showDone, setShowDone] = useState(false)
  const sheet = useTaskSheet()
  const [creatingProject, setCreatingProject] = useState(false)
  const [newTaskColumn, setNewTaskColumn] = useState<TaskColumn | null>(null)

  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: listClients })
  const { data: members } = useQuery({ queryKey: ['members'], queryFn: listMembers })
  const projectsQ = useQuery({ queryKey: ['projects', {}], queryFn: () => listProjects() })
  const tasksQ = useQuery({ queryKey: ['tasks', {}], queryFn: () => listTasks() })

  const projects = useMemo(
    () =>
      (projectsQ.data ?? []).filter(
        (p) =>
          (clientId === 'todos' || p.client_id === clientId) &&
          (status === 'todos' || (status === 'en_curso' ? p.status === 'activo' || p.status === 'en_pausa' : p.status === 'terminado' || p.status === 'cancelado')),
      ),
    [projectsQ.data, clientId, status],
  )
  const tasks = useMemo(
    () =>
      (tasksQ.data ?? []).filter(
        (t) =>
          (clientId === 'todos' || t.client_id === clientId) &&
          (assignee === 'todos' || (assignee === 'none' ? !t.assignee_id : t.assignee_id === assignee)),
      ),
    [tasksQ.data, clientId, assignee],
  )

  const loading = projectsQ.isLoading || tasksQ.isLoading
  const error = projectsQ.error || tasksQ.error
  const noProjects = !loading && !projectsQ.data?.length

  return (
    <>
      <PageHeader
        title="Proyectos"
        description={projectsQ.data ? `${projectsQ.data.filter((p) => p.status === 'activo').length} activos · ${tasksQ.data?.filter((t) => t.column !== 'aprobado' && t.column !== 'entregado').length ?? 0} tareas pendientes` : undefined}
        actions={
          <>
            {view !== 'proyectos' && view !== 'timeline' && !noProjects && (
              <Button variant="outline" onClick={() => setNewTaskColumn('por_hacer')}>
                <Plus /> Tarea
              </Button>
            )}
            <Button onClick={() => setCreatingProject(true)}>
              <Plus /> Nuevo proyecto
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <ViewSwitch
          value={view}
          onChange={setView}
          options={[
            { id: 'proyectos', label: 'Proyectos', icon: LayoutGrid },
            { id: 'tablero', label: 'Tablero', icon: Columns3 },
            { id: 'lista', label: 'Lista', icon: List },
            { id: 'timeline', label: 'Timeline', icon: GanttChart },
          ]}
        />
        <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por cliente"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los clientes</SelectItem>
              {clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.brand_name}</SelectItem>)}
            </SelectContent>
          </Select>
          {(view === 'tablero' || view === 'lista') && (
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por responsable"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todo el equipo</SelectItem>
                {userId && <SelectItem value={userId}>Mis tareas</SelectItem>}
                <SelectItem value="none">Sin responsable</SelectItem>
                {members?.filter((m) => m.id !== userId).map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {(view === 'proyectos' || view === 'timeline') && (
            <Select value={status} onValueChange={(v) => setStatus(v as (typeof STATUS)[number])}>
              <SelectTrigger className="w-full sm:w-40" aria-label="Filtrar por estado"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en_curso">En curso</SelectItem>
                <SelectItem value="terminados">Terminados</SelectItem>
                <SelectItem value="todos">Todos</SelectItem>
              </SelectContent>
            </Select>
          )}
          {view === 'lista' && (
            <span className="flex items-center gap-2 px-1">
              <Checkbox id="show-done" checked={showDone} onCheckedChange={(v) => setShowDone(v === true)} />
              <Label htmlFor="show-done" className="font-normal">Mostrar terminadas</Label>
            </span>
          )}
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => { void projectsQ.refetch(); void tasksQ.refetch() }} />
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36" />)}</div>
      ) : noProjects ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title="Todavía no hay proyectos"
            description="Creá el primero. Si usás una plantilla, las tareas se arman solas con sus fechas."
            action={<Button onClick={() => setCreatingProject(true)}><Plus /> Crear proyecto</Button>}
          />
        </Card>
      ) : view === 'proyectos' ? (
        projects.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projects.map((p) => <ProjectCard key={p.id} p={p} />)}</div>
        ) : (
          <Card><EmptyState compact icon={FolderKanban} title="No hay proyectos con esos filtros" /></Card>
        )
      ) : view === 'tablero' ? (
        <KanbanBoard tasks={tasks} onOpen={sheet.open} onCreate={setNewTaskColumn} />
      ) : view === 'lista' ? (
        <TaskList tasks={tasks} onOpen={sheet.open} showDone={showDone} />
      ) : (
        <ProjectTimeline projects={projects} tasks={tasks} />
      )}

      <TaskSheet taskId={sheet.taskId} onClose={sheet.close} />
      <NewTaskDialog open={!!newTaskColumn} onOpenChange={(o) => !o && setNewTaskColumn(null)} column={newTaskColumn ?? undefined} onCreated={sheet.open} />
      <ProjectFormDialog open={creatingProject} onOpenChange={setCreatingProject} defaultClientId={clientId !== 'todos' ? clientId : undefined} onSaved={(id) => navigate(`/proyectos/${id}`)} />
    </>
  )
}
