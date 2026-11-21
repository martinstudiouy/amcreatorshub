import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, List, LoaderCircle, Plus, RefreshCw } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ErrorState } from '@/components/common/error-state'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getEvent, getGoogleStatus, listEvents, syncGoogleNow, type CalendarEvent } from '@/data/agenda'
import { friendlyError } from '@/data/api'
import { listClients } from '@/data/crm'
import { eventTypeLabel } from '@/data/labels'
import type { EventType } from '@/data/types'
import { useRole } from '@/features/auth/auth-context'
import { useParam } from '@/features/projects/use-task-sheet'
import { ViewSwitch } from '@/features/projects/view-switch'
import { addDays, timeAgo, todayMvd } from '@/lib/format'
import { isDemo } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { addMonths, localDate, monthGrid, monthLabel, startOfWeek, toIso, weekLabel } from './dates'
import { EventDialog, type EventDraft } from './event-dialog'
import { eventTypeColor } from './event-style'
import { ListView } from './list-view'
import { MonthView } from './month-view'
import { WeekView } from './week-view'

const VIEWS = ['mes', 'semana', 'lista'] as const
type View = (typeof VIEWS)[number]
const isMobile = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches

export function AgendaPage() {
  const [view, setView] = useParam<View>('vista', isMobile() ? 'lista' : 'mes', VIEWS)
  const [date, setDate] = useParam<string>('fecha', todayMvd())
  const [eventId, setEventId] = useParam<string>('evento', '')
  const [type, setType] = useState<EventType | 'todos'>('todos')
  const [clientId, setClientId] = useState('todos')
  const [dialog, setDialog] = useState<{ event?: CalendarEvent | null; draft?: EventDraft } | null>(null)

  // Rango que hace falta traer según la vista
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

  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['events', range], queryFn: () => listEvents(range.from, range.to) })
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: listClients })
  const events = useMemo(
    () => (data ?? []).filter((e) => (type === 'todos' || e.type === type) && (clientId === 'todos' || e.client_id === clientId)),
    [data, type, clientId],
  )

  // Abrir un evento desde un link (notificaciones, dashboard)
  useEffect(() => {
    if (!eventId) return
    void getEvent(eventId).then((e) => {
      if (e) {
        setDialog({ event: e })
        if (localDate(e.starts_at) !== date) setDate(localDate(e.starts_at))
      } else toast.error('Ese evento ya no existe.')
    })
  }, [eventId]) // eslint-disable-line react-hooks/exhaustive-deps

  const move = (dir: -1 | 1) => {
    if (view === 'mes') setDate(addMonths(date, dir))
    else if (view === 'semana') setDate(addDays(date, 7 * dir))
    else setDate(addDays(date, 30 * dir))
  }
  const label = view === 'mes' ? monthLabel(date) : view === 'semana' ? weekLabel(date) : `Desde el ${Number(date.slice(8))}/${date.slice(5, 7)}`

  return (
    <>
      <PageHeader
        title="Agenda"
        description="Reuniones, eventos, sesiones de fotos y entregas."
        actions={
          <>
            <GoogleChip />
            <Button onClick={() => setDialog({ draft: { date: view === 'mes' ? todayMvd() : date } })}>
              <Plus /> Agendar
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={() => setDate(todayMvd())}>Hoy</Button>
          <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label="Anterior"><ChevronLeft /></Button>
          <Button variant="ghost" size="icon" onClick={() => move(1)} aria-label="Siguiente"><ChevronRight /></Button>
          <h2 className="min-w-44 text-lg font-semibold">{label}</h2>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
          <Select value={type} onValueChange={(v) => setType(v as EventType | 'todos')}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Filtrar por tipo"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los tipos</SelectItem>
              {(Object.keys(eventTypeLabel) as EventType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  <span className="inline-flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: eventTypeColor[t] }} /> {eventTypeLabel[t]}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Filtrar por cliente"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los clientes</SelectItem>
              {clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.brand_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <ViewSwitch
            value={view}
            onChange={setView}
            options={[
              { id: 'mes', label: 'Mes', icon: CalendarDays },
              { id: 'semana', label: 'Semana', icon: CalendarRange },
              { id: 'lista', label: 'Lista', icon: List },
            ]}
          />
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-[560px]" />
      ) : view === 'mes' ? (
        <MonthView
          date={date}
          events={events}
          onOpen={(e) => setDialog({ event: e })}
          onCreate={(day) => setDialog({ draft: { date: day } })}
          onDay={(day) => {
            setDate(day)
            setView('semana')
          }}
        />
      ) : view === 'semana' ? (
        <WeekView date={date} events={events} onOpen={(e) => setDialog({ event: e })} onCreate={(day, time) => setDialog({ draft: { date: day, time } })} />
      ) : (
        <ListView events={events} onOpen={(e) => setDialog({ event: e })} onCreate={() => setDialog({ draft: { date } })} />
      )}

      <EventDialog
        open={!!dialog}
        onOpenChange={(o) => {
          if (!o) {
            setDialog(null)
            if (eventId) setEventId('')
          }
        }}
        event={dialog?.event}
        draft={dialog?.draft}
      />
    </>
  )
}

/** Estado de Google Calendar con botón para sincronizar ya. */
function GoogleChip() {
  const qc = useQueryClient()
  const isAdmin = useRole() === 'admin'
  const { data } = useQuery({ queryKey: ['google-status'], queryFn: getGoogleStatus, refetchInterval: 60_000 })
  const sync = useMutation({
    mutationFn: syncGoogleNow,
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ['events'] })
      void qc.invalidateQueries({ queryKey: ['google-status'] })
      if (r.errors?.length) toast.error(`Algunos eventos no se pudieron subir: ${r.errors[0]}`)
      else toast.success(`Sincronizado con Google${r.pulled || r.pushed ? `: ${r.pushed ?? 0} subidos, ${r.pulled ?? 0} traídos` : ''}.`)
    },
    onError: (e) => toast.error(friendlyError(e)),
  })
  if (isDemo || !data) return null
  if (!data.connected)
    return isAdmin ? (
      <Button variant="outline" asChild>
        <Link to="/configuracion?tab=integraciones">Conectar Google Calendar</Link>
      </Button>
    ) : null
  const broken = data.status === 'desconectado'
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending} className={cn(broken && 'border-destructive/50 text-destructive')}>
          {sync.isPending ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
          <span className="hidden sm:inline">{broken ? 'Google desconectado' : data.last_synced_at ? `Google · ${timeAgo(data.last_synced_at)}` : 'Sincronizar'}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{broken ? 'Hay que volver a conectar la cuenta en Configuración → Integraciones' : `Sincronizado con ${data.email}. Tocá para sincronizar ahora.`}</TooltipContent>
    </Tooltip>
  )
}
