import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Grid3x3, List, Plus, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/common/error-state'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { friendlyError } from '@/data/api'
import { listPosts, updatePost, type Post, type PostFormat, type PostStatus } from '@/data/content'
import { listClients } from '@/data/crm'
import { useParam } from '@/features/projects/use-task-sheet'
import { ViewSwitch } from '@/features/projects/view-switch'
import { addDays, todayMvd } from '@/lib/format'
import { addMonths, localTime, monthGrid, monthLabel, startOfWeek, toIso, weekLabel } from '@/features/agenda/dates'
import { ApprovalDialog } from './approval-dialog'
import { CalendarDnd, IdeasTray, MonthView, WeekView } from './calendar-views'
import { GridView } from './grid-view'
import { ListView } from './list-view'
import { PostSheet, type PostDraft } from './post-sheet'
import { FORMATS, STATUSES, formatLabel, invalidateContent, statusLabel, useMediaUrls } from './post-ui'

const VIEWS = ['mes', 'semana', 'lista', 'grilla'] as const
type View = (typeof VIEWS)[number]
const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches

export function ContentPage() {
  const qc = useQueryClient()
  const [view, setView] = useParam<View>('vista', isMobile() ? 'lista' : 'mes', VIEWS)
  const [date, setDate] = useParam<string>('fecha', todayMvd())
  const [postId, setPostId] = useParam<string>('post', '')
  const [clientId, setClientId] = useParam<string>('cliente', 'todos')
  const [format, setFormat] = useState<PostFormat | 'todos'>('todos')
  const [status, setStatus] = useState<PostStatus | 'todos'>('todos')
  const [draft, setDraft] = useState<PostDraft | null>(null)
  const [approval, setApproval] = useState<{ clientId?: string; postIds?: string[] } | null>(null)

  const range = useMemo(() => {
    if (view === 'mes') {
      const g = monthGrid(date)
      return { from: toIso(g[0], '00:00'), to: toIso(addDays(g[41], 1), '00:00') }
    }
    if (view === 'semana') {
      const s = startOfWeek(date)
      return { from: toIso(s, '00:00'), to: toIso(addDays(s, 7), '00:00') }
    }
    return { from: toIso(date, '00:00'), to: toIso(addDays(date, 60), '00:00') }
  }, [view, date])

  const queryKey = ['posts', range]
  const { data, isLoading, error, refetch } = useQuery({ queryKey, queryFn: () => listPosts(range), enabled: view !== 'grilla' })
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: listClients })
  const posts = useMemo(
    () => (data ?? []).filter((p) => (clientId === 'todos' || p.client_id === clientId) && (format === 'todos' || p.format === format) && (status === 'todos' || p.status === status)),
    [data, clientId, format, status],
  )
  const urls = useMediaUrls(view === 'semana' ? posts : [])

  const open = (p: Post) => setPostId(p.id)
  const create = (d: PostDraft) => setDraft({ clientId: clientId !== 'todos' ? clientId : undefined, ...d })

  /** Arrastrar: cambia el día y mantiene la hora (las ideas toman las 12:00). */
  async function move(p: Post, day: string | null) {
    const scheduled_at = day ? toIso(day, p.scheduled_at ? localTime(p.scheduled_at) : '12:00') : null
    qc.setQueryData<Post[]>(queryKey, (old) => old?.map((x) => (x.id === p.id ? { ...x, scheduled_at } : x)))
    try {
      await updatePost(p.id, { scheduled_at, ...(day === null && ['programado'].includes(p.status) ? { status: 'aprobado' as const } : {}) })
      toast.success(day ? 'Fecha cambiada.' : 'Quedó como idea sin fecha.')
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      invalidateContent(qc)
    }
  }

  const step = (dir: -1 | 1) => {
    if (view === 'mes') setDate(addMonths(date, dir))
    else if (view === 'semana') setDate(addDays(date, 7 * dir))
    else setDate(addDays(date, 30 * dir))
  }
  const label = view === 'mes' ? monthLabel(date) : view === 'semana' ? weekLabel(date) : `Desde el ${Number(date.slice(8))}/${date.slice(5, 7)}`
  const ideas = posts.filter((p) => !p.scheduled_at)
  const selectedClient = clients?.find((c) => c.id === clientId)

  return (
    <>
      <PageHeader
        title="Contenidos"
        description="El calendario de publicaciones de todos los clientes."
        actions={
          <>
            <Button variant="outline" onClick={() => setApproval({ clientId: clientId !== 'todos' ? clientId : undefined })}>
              <Send /> <span className="hidden sm:inline">Pedir aprobación</span>
            </Button>
            <Button onClick={() => create({ date: view === 'mes' || view === 'grilla' ? todayMvd() : date })}>
              <Plus /> Nueva publicación
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
        {view !== 'grilla' ? (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-9" onClick={() => setDate(todayMvd())}>Hoy</Button>
            <Button variant="ghost" size="icon" onClick={() => step(-1)} aria-label="Anterior"><ChevronLeft /></Button>
            <Button variant="ghost" size="icon" onClick={() => step(1)} aria-label="Siguiente"><ChevronRight /></Button>
            <h2 className="min-w-44 text-lg font-semibold">{label}</h2>
          </div>
        ) : (
          <h2 className="text-lg font-semibold">Vista previa del feed</h2>
        )}
        <div className="flex flex-1 flex-wrap items-center gap-2 xl:justify-end">
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por cliente"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">{view === 'grilla' ? 'Elegí un cliente' : 'Todos los clientes'}</SelectItem>
              {clients?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: c.color_tag ?? '#64748B' }} /> {c.brand_name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {view !== 'grilla' && (
            <>
              <Select value={format} onValueChange={(v) => setFormat(v as PostFormat | 'todos')}>
                <SelectTrigger className="w-[calc(50%-0.25rem)] whitespace-nowrap sm:w-48" aria-label="Filtrar por formato"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los formatos</SelectItem>
                  {FORMATS.map((f) => <SelectItem key={f} value={f}>Instagram · {formatLabel[f]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => setStatus(v as PostStatus | 'todos')}>
                <SelectTrigger className="w-[calc(50%-0.25rem)] whitespace-nowrap sm:w-44" aria-label="Filtrar por estado"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  {STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          )}
          <ViewSwitch
            value={view}
            onChange={setView}
            options={[
              { id: 'mes', label: 'Mes', icon: CalendarDays },
              { id: 'semana', label: 'Semana', icon: CalendarRange },
              { id: 'lista', label: 'Lista', icon: List },
              { id: 'grilla', label: 'Grilla', icon: Grid3x3 },
            ]}
          />
        </div>
      </div>

      {view === 'grilla' ? (
        <GridView client={selectedClient} onOpen={open} />
      ) : error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-[560px]" />
      ) : view === 'lista' ? (
        <ListView posts={posts} onOpen={open} onCreate={() => create({ date })} onApprove={(c, ids) => setApproval({ clientId: c, postIds: ids })} />
      ) : (
        <CalendarDnd posts={posts} onMove={(p, day) => void move(p, day)}>
          <IdeasTray posts={ideas} onOpen={open} onCreate={() => create({})} />
          {view === 'mes' ? (
            <MonthView
              date={date}
              posts={posts}
              onOpen={open}
              onCreate={(day) => create({ date: day })}
              onDay={(day) => {
                setDate(day)
                setView('semana')
              }}
            />
          ) : (
            <WeekView date={date} posts={posts} urls={urls} onOpen={open} onCreate={(day) => create({ date: day })} />
          )}
        </CalendarDnd>
      )}

      <PostSheet
        open={!!postId || !!draft}
        postId={postId || null}
        draft={draft ?? undefined}
        onClose={() => {
          setDraft(null)
          if (postId) setPostId('')
        }}
        onRequestApproval={(c, ids) => {
          setPostId('')
          setApproval({ clientId: c, postIds: ids })
        }}
      />
      <ApprovalDialog open={!!approval} onOpenChange={(o) => !o && setApproval(null)} clientId={approval?.clientId} postIds={approval?.postIds} />
    </>
  )
}
