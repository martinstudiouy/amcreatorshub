import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ClientChip } from '@/components/common/client-chip'
import { friendlyError } from '@/data/api'
import { updateTask, type TaskOverview } from '@/data/crm'
import { COLUMNS, columnLabel } from '@/data/labels'
import type { TaskColumn } from '@/data/types'
import { invalidateCrm } from '@/lib/invalidate'
import { cn } from '@/lib/utils'
import { AssigneeAvatar, DueBadge, PriorityDot, TaskCounters } from './task-bits'

type Board = Record<TaskColumn, TaskOverview[]>

const columnAccent: Record<TaskColumn, string> = {
  por_hacer: 'bg-muted-foreground/40',
  en_proceso: 'bg-brand',
  en_revision: 'bg-warning',
  aprobado: 'bg-success',
  entregado: 'bg-foreground/70',
}

function toBoard(tasks: TaskOverview[]): Board {
  const b = Object.fromEntries(COLUMNS.map((c) => [c, [] as TaskOverview[]])) as Board
  tasks.forEach((t) => b[t.column].push(t))
  COLUMNS.forEach((c) => b[c].sort((a, z) => a.position - z.position))
  return b
}

/** Tablero Kanban con arrastrar y soltar (mouse, touch y teclado). */
export function KanbanBoard({
  tasks,
  onOpen,
  onCreate,
  showProject = true,
}: {
  tasks: TaskOverview[]
  onOpen: (id: string) => void
  onCreate: (column: TaskColumn) => void
  showProject?: boolean
}) {
  const qc = useQueryClient()
  const [board, setBoard] = useState<Board>(() => toBoard(tasks))
  const [activeId, setActiveId] = useState<string | null>(null)
  useEffect(() => {
    if (!activeId) setBoard(toBoard(tasks))
  }, [tasks, activeId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const findColumn = (id: string): TaskColumn | null => {
    if ((COLUMNS as readonly string[]).includes(id)) return id as TaskColumn
    return COLUMNS.find((c) => board[c].some((t) => t.id === id)) ?? null
  }
  const active = useMemo(() => tasks.find((t) => t.id === activeId) ?? null, [tasks, activeId])

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id))
  }

  function onDragOver(e: DragOverEvent) {
    const { active: a, over } = e
    if (!over) return
    const from = findColumn(String(a.id))
    const to = findColumn(String(over.id))
    if (!from || !to || from === to) return
    setBoard((b) => {
      const item = b[from].find((t) => t.id === a.id)
      if (!item) return b
      const overIndex = b[to].findIndex((t) => t.id === over.id)
      const next = [...b[to]]
      next.splice(overIndex < 0 ? next.length : overIndex, 0, { ...item, column: to })
      return { ...b, [from]: b[from].filter((t) => t.id !== a.id), [to]: next }
    })
  }

  async function onDragEnd(e: DragEndEvent) {
    const { active: a, over } = e
    setActiveId(null)
    if (!over) return setBoard(toBoard(tasks))
    const col = findColumn(String(a.id))
    if (!col) return
    let list = board[col]
    const oldIndex = list.findIndex((t) => t.id === a.id)
    const overIndex = list.findIndex((t) => t.id === over.id)
    if (overIndex >= 0 && overIndex !== oldIndex) {
      list = [...list]
      const [moved] = list.splice(oldIndex, 1)
      list.splice(overIndex, 0, moved)
      setBoard((b) => ({ ...b, [col]: list }))
    }
    const idx = list.findIndex((t) => t.id === a.id)
    const prev = list[idx - 1]?.position
    const next = list[idx + 1]?.position
    const position = prev == null && next == null ? 1 : prev == null ? next! - 1 : next == null ? prev + 1 : (prev + next) / 2
    const original = tasks.find((t) => t.id === a.id)
    if (original && original.column === col && original.position === position) return
    try {
      await updateTask(String(a.id), { column: col, position })
      if (original && original.column !== col) toast.success(`Movida a ${columnLabel[col]}.`)
    } catch (err) {
      toast.error(friendlyError(err))
      setBoard(toBoard(tasks))
    } finally {
      invalidateCrm(qc)
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null)
        setBoard(toBoard(tasks))
      }}
      accessibility={{
        screenReaderInstructions: { draggable: 'Para mover una tarea, apretá espacio, movela con las flechas y apretá espacio de nuevo para soltarla.' },
      }}
    >
      <div className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:px-0">
        {COLUMNS.map((col) => (
          <Column key={col} column={col} tasks={board[col]} onOpen={onOpen} onCreate={() => onCreate(col)} showProject={showProject} />
        ))}
      </div>
      <DragOverlay>{active ? <TaskCard t={active} showProject={showProject} dragging /> : null}</DragOverlay>
    </DndContext>
  )
}

function Column({ column, tasks, onOpen, onCreate, showProject }: { column: TaskColumn; tasks: TaskOverview[]; onOpen: (id: string) => void; onCreate: () => void; showProject: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: column })
  return (
    <section className="flex w-[80vw] max-w-72 shrink-0 snap-start flex-col sm:w-72 xl:w-auto xl:min-w-52 xl:max-w-none xl:flex-1 xl:shrink" aria-label={columnLabel[column]}>
      <header className="mb-3 flex items-center gap-2 px-1">
        <span className={cn('size-2 rounded-full', columnAccent[column])} />
        <h3 className="text-sm font-semibold">{columnLabel[column]}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{tasks.length}</span>
        <button onClick={onCreate} className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Nueva tarea en ${columnLabel[column]}`}>
          <Plus className="size-4" />
        </button>
      </header>
      <div ref={setNodeRef} className={cn('flex min-h-32 flex-1 flex-col gap-2 rounded-lg bg-muted/50 p-2 transition-colors', isOver && 'bg-accent')}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((t) => (
            <SortableTask key={t.id} t={t} onOpen={onOpen} showProject={showProject} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <button onClick={onCreate} className="flex flex-1 items-center justify-center rounded-md border border-dashed py-6 text-xs text-muted-foreground hover:border-primary hover:text-foreground">
            Arrastrá una tarea acá o creá una
          </button>
        )}
      </div>
    </section>
  )
}

function SortableTask({ t, onOpen, showProject }: { t: TaskOverview; onOpen: (id: string) => void; showProject: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: t.id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && 'opacity-30')}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(t.id)}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e)
        if (e.key === 'Enter') onOpen(t.id)
      }}
      aria-label={`${t.title}. ${columnLabel[t.column]}`}
    >
      <TaskCard t={t} showProject={showProject} />
    </div>
  )
}

export function TaskCard({ t, showProject, dragging }: { t: TaskOverview; showProject: boolean; dragging?: boolean }) {
  return (
    <article className={cn('cursor-grab rounded-lg border bg-card p-3 shadow-soft transition-shadow hover:border-foreground/15 active:cursor-grabbing', dragging && 'rotate-2 shadow-lg ring-2 ring-primary/30')}>
      <div className="flex items-start gap-2">
        <PriorityDot priority={t.priority} className="mt-1.5" />
        <p className="flex-1 text-sm font-medium leading-snug">{t.title}</p>
      </div>
      {showProject && (
        <p className="mt-1.5 truncate pl-[18px] text-xs text-muted-foreground">
          <ClientChip name={t.client_name} color={t.client_color} /> · {t.project_name}
        </p>
      )}
      <div className="mt-3 flex items-center gap-2 pl-[18px]">
        <DueBadge task={t} compact />
        <TaskCounters t={t} />
        <span className="ml-auto">
          <AssigneeAvatar name={t.assignee_name} />
        </span>
      </div>
    </article>
  )
}
