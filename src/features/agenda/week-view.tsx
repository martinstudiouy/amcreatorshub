import { addDays } from '@/lib/format'
import type { CalendarEvent } from '@/data/agenda'
import { cn } from '@/lib/utils'
import { WEEKDAYS, coversDay, isToday, localDate, localMinutes, localTime, startOfWeek } from './dates'
import { eventColor } from './event-style'

const START_H = 7
const END_H = 22
const HOUR_PX = 52

type Placed = { e: CalendarEvent; top: number; height: number; lane: number; lanes: number }

/** Acomoda los eventos que se superponen en columnas, una al lado de la otra. */
function layout(events: CalendarEvent[], day: string): Placed[] {
  const items = events
    .filter((e) => !e.all_day && localDate(e.starts_at) === day)
    .map((e) => {
      const s = Math.max(localMinutes(e.starts_at), START_H * 60)
      const sameDay = localDate(e.ends_at) === day
      const end = Math.min(sameDay ? localMinutes(e.ends_at) : 24 * 60, END_H * 60)
      return { e, s, end: Math.max(end, s + 20) }
    })
    .sort((a, b) => a.s - b.s || b.end - a.end)

  const placed: Placed[] = []
  let cluster: typeof placed = []
  let clusterEnd = -1
  const laneEnds: number[] = []
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((p) => p.lane + 1))
    cluster.forEach((p) => (p.lanes = lanes))
    cluster = []
    laneEnds.length = 0
  }
  for (const it of items) {
    if (it.s >= clusterEnd) flush()
    let lane = laneEnds.findIndex((end) => end <= it.s)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = it.end
    const p: Placed = { e: it.e, top: ((it.s - START_H * 60) / 60) * HOUR_PX, height: ((it.end - it.s) / 60) * HOUR_PX, lane, lanes: 1 }
    cluster.push(p)
    placed.push(p)
    clusterEnd = Math.max(clusterEnd, it.end)
  }
  flush()
  return placed
}

export function WeekView({ date, events, onOpen, onCreate }: {
  date: string
  events: CalendarEvent[]
  onOpen: (e: CalendarEvent) => void
  onCreate: (day: string, time?: string) => void
}) {
  const start = startOfWeek(date)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const hours = Array.from({ length: END_H - START_H }, (_, i) => START_H + i)
  const now = new Date().toISOString()
  const nowMin = localMinutes(now)
  const hasAllDay = days.some((d) => events.some((e) => e.all_day && coversDay(e, d)))

  return (
    <div className="overflow-x-auto rounded-lg border bg-card shadow-soft">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b">
          <div />
          {days.map((d, i) => (
            <div key={d} className="border-l px-2 py-2 text-center">
              <p className="text-xs text-muted-foreground">{WEEKDAYS[i]}</p>
              <p className={cn('mx-auto mt-0.5 flex size-7 items-center justify-center rounded-full text-sm font-semibold tabular-nums', isToday(d) && 'bg-primary text-primary-foreground')}>{Number(d.slice(8))}</p>
            </div>
          ))}
        </div>
        {hasAllDay && (
          <div className="grid grid-cols-[3.5rem_repeat(7,1fr)] border-b">
            <div className="py-1.5 pr-2 text-right text-[10px] text-muted-foreground">Todo el día</div>
            {days.map((d) => (
              <div key={d} className="space-y-0.5 border-l p-1">
                {events.filter((e) => e.all_day && coversDay(e, d)).map((e) => (
                  <button key={e.id} onClick={() => onOpen(e)} className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium" style={{ background: `${eventColor(e)}26` }}>
                    {e.title}
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
        <div className="grid max-h-[70vh] grid-cols-[3.5rem_repeat(7,1fr)] overflow-y-auto pt-2">
          <div className="relative">
            {hours.map((h) => (
              <div key={h} className="relative text-right text-[10px] text-muted-foreground tabular-nums" style={{ height: HOUR_PX }}>
                <span className="absolute -top-1.5 right-2">{String(h).padStart(2, '0')}:00</span>
              </div>
            ))}
          </div>
          {days.map((d) => (
            <div key={d} className="relative border-l">
              {hours.map((h) => (
                <div key={h} className="border-b border-border/60" style={{ height: HOUR_PX }}>
                  <button className="block h-1/2 w-full hover:bg-accent/40" onClick={() => onCreate(d, `${String(h).padStart(2, '0')}:00`)} aria-label={`Nuevo evento el ${d} a las ${h}:00`} />
                  <button className="block h-1/2 w-full hover:bg-accent/40" onClick={() => onCreate(d, `${String(h).padStart(2, '0')}:30`)} aria-label={`Nuevo evento el ${d} a las ${h}:30`} />
                </div>
              ))}
              {isToday(d) && nowMin >= START_H * 60 && nowMin <= END_H * 60 && (
                <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-destructive" style={{ top: ((nowMin - START_H * 60) / 60) * HOUR_PX }}>
                  <span className="absolute -left-1 -top-[5px] size-2 rounded-full bg-destructive" />
                </div>
              )}
              {layout(events, d).map(({ e, top, height, lane, lanes }) => (
                <button
                  key={e.id}
                  onClick={() => onOpen(e)}
                  className="absolute overflow-hidden rounded-md border-l-[3px] px-1.5 py-1 text-left text-[11px] leading-tight shadow-soft hover:z-20 hover:brightness-95"
                  style={{
                    top,
                    height: Math.max(height - 2, 18),
                    left: `calc(${(lane / lanes) * 100}% + 2px)`,
                    width: `calc(${100 / lanes}% - 4px)`,
                    background: `color-mix(in srgb, ${eventColor(e)} 14%, var(--card))`,
                    borderLeftColor: eventColor(e),
                  }}
                  title={e.title}
                >
                  <span className="block truncate font-semibold">{e.title}</span>
                  {height > 34 && <span className="block truncate text-muted-foreground tabular-nums">{localTime(e.starts_at)}–{localTime(e.ends_at)}{e.client_name ? ` · ${e.client_name}` : ''}</span>}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
