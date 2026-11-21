import { CalendarClock, MapPin, Video } from 'lucide-react'
import { EmptyState } from '@/components/common/empty-state'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { CalendarEvent } from '@/data/agenda'
import { eventTypeLabel } from '@/data/labels'
import { addDays, formatLongDate, todayMvd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { localDate, localTime } from './dates'
import { eventColor, eventTypeIcon } from './event-style'

/** Próximos eventos agrupados por día. */
export function ListView({ events, onOpen, onCreate }: { events: CalendarEvent[]; onOpen: (e: CalendarEvent) => void; onCreate: () => void }) {
  if (!events.length)
    return (
      <Card>
        <EmptyState icon={CalendarClock} title="No hay nada agendado en estas fechas" description="Agendá una reunión, una sesión de fotos o una entrega." action={<button onClick={onCreate} className="text-sm font-medium text-brand hover:underline">Agendar algo</button>} />
      </Card>
    )
  const groups = new Map<string, CalendarEvent[]>()
  events.forEach((e) => {
    const k = localDate(e.starts_at)
    groups.set(k, [...(groups.get(k) ?? []), e])
  })
  const today = todayMvd()
  return (
    <div className="space-y-6">
      {[...groups.entries()].map(([day, items]) => (
        <section key={day}>
          <h3 className="mb-2 text-sm font-semibold first-letter:uppercase">
            {day === today ? 'Hoy' : day === addDays(today, 1) ? 'Mañana' : formatLongDate(day)}
            {day === today && <span className="ml-2 font-normal text-muted-foreground">{formatLongDate(day)}</span>}
          </h3>
          <Card className="divide-y overflow-hidden">
            {items.map((e) => {
              const Icon = eventTypeIcon[e.type]
              return (
                <button key={e.id} onClick={() => onOpen(e)} className="flex w-full items-start gap-4 px-4 py-3 text-left hover:bg-muted/40">
                  <div className="w-14 shrink-0 pt-0.5 text-sm font-semibold tabular-nums">{e.all_day ? 'Todo el día' : localTime(e.starts_at)}</div>
                  <span className="mt-1 h-9 w-1 shrink-0 rounded-full" style={{ background: eventColor(e) }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{e.title}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><Icon className="size-3.5" /> {eventTypeLabel[e.type]}</span>
                      {e.client_name && <span>{e.client_name}</span>}
                      {!e.all_day && <span className="tabular-nums">hasta {localTime(e.ends_at)}</span>}
                      {e.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" /> {e.location}</span>}
                      {e.meet_url && <span className="inline-flex items-center gap-1 text-brand"><Video className="size-3.5" /> Videollamada</span>}
                    </p>
                  </div>
                  <div className={cn('flex shrink-0 flex-col items-end gap-1')}>
                    {e.source === 'google' && <Badge variant="neutral">Google</Badge>}
                    {e.sync_status === 'error' && <Badge variant="danger">No sincronizó</Badge>}
                  </div>
                </button>
              )
            })}
          </Card>
        </section>
      ))}
    </div>
  )
}
