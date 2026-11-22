import { DndContext, DragOverlay, PointerSensor, TouchSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { Lightbulb, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { Post } from '@/data/content'
import { addDays } from '@/lib/format'
import { cn } from '@/lib/utils'
import { MONTHS, WEEKDAYS, isToday, localDate, localTime, monthGrid, startOfWeek } from '@/features/agenda/dates'
import { FormatIcon, PostThumb, statusDot, statusLabel } from './post-ui'

const MAX_VISIBLE = 3
const UNSCHEDULED = 'sin-fecha'

/** Envuelve el calendario: arrastrar una publicación a otro día (o a la bandeja de ideas). */
export function CalendarDnd({ posts, onMove, children }: { posts: Post[]; onMove: (post: Post, day: string | null) => void; children: ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }))
  const [active, setActive] = useState<Post | null>(null)
  const onEnd = (e: DragEndEvent) => {
    setActive(null)
    const post = posts.find((p) => p.id === e.active.id)
    const target = e.over?.id as string | undefined
    if (!post || !target) return
    const day = target === UNSCHEDULED ? null : target
    const current = post.scheduled_at ? localDate(post.scheduled_at) : null
    if (day !== current) onMove(post, day)
  }
  return (
    <DndContext sensors={sensors} onDragStart={(e) => setActive(posts.find((p) => p.id === e.active.id) ?? null)} onDragEnd={onEnd} onDragCancel={() => setActive(null)}>
      {children}
      <DragOverlay dropAnimation={null}>{active && <ChipBody post={active} className="w-44 rotate-2 shadow-lg" />}</DragOverlay>
    </DndContext>
  )
}

function ChipBody({ post, className, showTime = true }: { post: Post; className?: string; showTime?: boolean }) {
  return (
    <span
      className={cn('flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] leading-tight', className)}
      style={{ background: `${post.client_color ?? '#64748B'}1f`, boxShadow: `inset 2px 0 0 ${post.client_color ?? '#64748B'}` }}
    >
      <span className={cn('size-1.5 shrink-0 rounded-full', statusDot[post.status])} title={statusLabel[post.status]} />
      <FormatIcon format={post.format} className="size-3 shrink-0 text-muted-foreground" />
      {showTime && post.scheduled_at && <span className="hidden shrink-0 tabular-nums text-muted-foreground sm:inline">{localTime(post.scheduled_at)}</span>}
      <span className="truncate">{post.caption || post.client_name}</span>
    </span>
  )
}

/** Publicación arrastrable (las publicadas no se mueven). */
function Chip({ post, onOpen, children }: { post: Post; onOpen: (p: Post) => void; children?: ReactNode }) {
  const fixed = post.status === 'publicado'
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id: post.id, disabled: fixed })
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation()
        onOpen(post)
      }}
      className={cn('block w-full text-left hover:brightness-95', isDragging && 'opacity-30', !fixed && 'cursor-grab active:cursor-grabbing')}
      title={`${post.client_name} · ${statusLabel[post.status]}${post.caption ? ` · ${post.caption}` : ''}`}
    >
      {children ?? <ChipBody post={post} />}
    </button>
  )
}

function DayCell({ day, className, children, onClick }: { day: string; className?: string; children: ReactNode; onClick?: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: day })
  return (
    <div ref={setNodeRef} onClick={onClick} className={cn(className, isOver && 'bg-brand/8 ring-2 ring-inset ring-brand')}>
      {children}
    </div>
  )
}

// ================================================================ Mes
export function MonthView({ date, posts, onOpen, onCreate, onDay }: { date: string; posts: Post[]; onOpen: (p: Post) => void; onCreate: (day: string) => void; onDay: (day: string) => void }) {
  const days = monthGrid(date)
  const month = date.slice(0, 7)
  const byDay = groupByDay(posts)
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-soft">
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {WEEKDAYS.map((d) => <div key={d} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const items = byDay.get(day) ?? []
          const other = !day.startsWith(month)
          return (
            <DayCell
              key={day}
              day={day}
              onClick={() => onCreate(day)}
              className={cn('group relative min-h-24 cursor-pointer border-b border-r p-1 sm:min-h-28 sm:p-1.5', (i + 1) % 7 === 0 && 'border-r-0', i >= 35 && 'border-b-0', other && 'bg-muted/30')}
            >
              <div className="mb-1 flex items-center justify-between">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDay(day)
                  }}
                  className={cn('flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums hover:bg-muted', other && 'text-muted-foreground/60', isToday(day) && 'bg-primary text-primary-foreground hover:bg-primary')}
                  aria-label={`Ver la semana del ${day}`}
                >
                  {Number(day.slice(8))}
                </button>
                <Plus className="mr-0.5 hidden size-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 sm:block" aria-hidden />
              </div>
              <div className="space-y-0.5">
                {items.slice(0, MAX_VISIBLE).map((p) => <Chip key={p.id} post={p} onOpen={onOpen} />)}
                {items.length > MAX_VISIBLE && (
                  <button
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onDay(day)
                    }}
                    className="px-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    +{items.length - MAX_VISIBLE} más
                  </button>
                )}
              </div>
            </DayCell>
          )
        })}
      </div>
    </div>
  )
}

// ================================================================ Semana
export function WeekView({ date, posts, urls, onOpen, onCreate }: { date: string; posts: Post[]; urls: Record<string, string>; onOpen: (p: Post) => void; onCreate: (day: string) => void }) {
  const start = startOfWeek(date)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const byDay = groupByDay(posts)
  return (
    <div className="overflow-x-auto rounded-lg border bg-card shadow-soft">
      <div className="grid min-w-[880px] grid-cols-7 divide-x">
        {days.map((day, i) => {
          const items = byDay.get(day) ?? []
          return (
            <DayCell key={day} day={day} className="flex min-h-[460px] flex-col">
              <div className={cn('border-b px-2 py-2 text-center', isToday(day) && 'bg-brand/8')}>
                <p className="text-xs font-medium text-muted-foreground">{WEEKDAYS[i]}</p>
                <p className={cn('text-lg font-semibold tabular-nums', isToday(day) && 'text-brand')}>{Number(day.slice(8))}</p>
              </div>
              <div className="flex-1 space-y-2 p-2">
                {items.map((p) => (
                  <Chip key={p.id} post={p} onOpen={onOpen}>
                    <div className="overflow-hidden rounded-lg border bg-card shadow-soft transition-shadow hover:shadow-md" style={{ borderTop: `3px solid ${p.client_color ?? '#64748B'}` }}>
                      <PostThumb post={p} urls={urls} className="aspect-[4/5] w-full" />
                      <div className="space-y-1 p-2">
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <span className="tabular-nums">{p.scheduled_at && localTime(p.scheduled_at)}</span>·<FormatIcon format={p.format} className="size-3" />
                          <span className="truncate">{p.client_name}</span>
                        </p>
                        <p className="line-clamp-2 text-xs leading-snug">{p.caption || <span className="text-muted-foreground">Sin copy</span>}</p>
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><span className={cn('size-1.5 rounded-full', statusDot[p.status])} />{statusLabel[p.status]}</p>
                      </div>
                    </div>
                  </Chip>
                ))}
                <button onClick={() => onCreate(day)} className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed py-2 text-xs text-muted-foreground hover:border-brand hover:text-brand" aria-label={`Nueva publicación el ${day}`}>
                  <Plus className="size-3.5" />
                </button>
              </div>
            </DayCell>
          )
        })}
      </div>
    </div>
  )
}

// ================================================================ Bandeja de ideas (sin fecha)
export function IdeasTray({ posts, onOpen, onCreate }: { posts: Post[]; onOpen: (p: Post) => void; onCreate: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: UNSCHEDULED })
  return (
    <div ref={setNodeRef} className={cn('mb-4 rounded-lg border border-dashed bg-card/60 p-3 transition-colors', isOver && 'border-brand bg-brand/5')}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium"><Lightbulb className="size-4 text-brand" /> Ideas sin fecha</span>
        <span className="text-xs text-muted-foreground">Arrastralas a un día para agendarlas.</span>
        <button onClick={onCreate} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"><Plus className="size-3.5" /> Idea</button>
      </div>
      {posts.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {posts.map((p) => (
            <div key={p.id} className="w-48 max-w-full">
              <Chip post={p} onOpen={onOpen}><ChipBody post={p} showTime={false} className="py-1 text-xs" /></Chip>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">Vacía. Si arrastrás una publicación acá, le sacás la fecha.</p>
      )}
    </div>
  )
}

export function groupByDay(posts: Post[]) {
  const m = new Map<string, Post[]>()
  for (const p of posts) {
    if (!p.scheduled_at) continue
    const k = localDate(p.scheduled_at)
    m.set(k, [...(m.get(k) ?? []), p])
  }
  for (const list of m.values()) list.sort((a, b) => a.scheduled_at!.localeCompare(b.scheduled_at!))
  return m
}

export const dayHeading = (day: string) => {
  const dow = WEEKDAYS[(new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7]
  return `${dow} ${Number(day.slice(8))} de ${MONTHS[Number(day.slice(5, 7)) - 1]}`
}
