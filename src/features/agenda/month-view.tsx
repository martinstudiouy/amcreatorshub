import type { CalendarEvent } from '@/data/agenda'
import { cn } from '@/lib/utils'
import { WEEKDAYS, coversDay, isToday, localDate, localTime, monthGrid } from './dates'
import { eventColor } from './event-style'

const MAX_VISIBLE = 3

export function MonthView({ date, events, onOpen, onCreate, onDay }: {
  date: string
  events: CalendarEvent[]
  onOpen: (e: CalendarEvent) => void
  onCreate: (day: string) => void
  onDay: (day: string) => void
}) {
  const days = monthGrid(date)
  const month = date.slice(0, 7)
  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-soft">
      <div className="grid grid-cols-7 border-b bg-muted/50">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          const items = events.filter((e) => coversDay(e, day))
          const other = !day.startsWith(month)
          return (
            <div
              key={day}
              className={cn('group relative min-h-24 border-b border-r p-1 sm:min-h-28 sm:p-1.5', (i + 1) % 7 === 0 && 'border-r-0', i >= 35 && 'border-b-0', other && 'bg-muted/30')}
              onClick={() => onCreate(day)}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onDay(day)
                }}
                className={cn(
                  'mb-1 flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums hover:bg-muted',
                  other && 'text-muted-foreground/60',
                  isToday(day) && 'bg-primary text-primary-foreground hover:bg-primary',
                )}
                aria-label={`Ver el ${day}`}
              >
                {Number(day.slice(8))}
              </button>
              <div className="space-y-0.5">
                {items.slice(0, MAX_VISIBLE).map((e) => (
                  <button
                    key={e.id}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onOpen(e)
                    }}
                    className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] leading-tight hover:brightness-95"
                    style={{ background: `${eventColor(e)}1f`, color: 'var(--foreground)' }}
                    title={e.title}
                  >
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: eventColor(e) }} />
                    {!e.all_day && localDate(e.starts_at) === day && <span className="hidden shrink-0 tabular-nums text-muted-foreground sm:inline">{localTime(e.starts_at)}</span>}
                    <span className="truncate">{e.title}</span>
                  </button>
                ))}
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
