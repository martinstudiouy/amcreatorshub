import { CalendarRange, Send } from 'lucide-react'
import { useState } from 'react'
import { ClientChip } from '@/components/common/client-chip'
import { EmptyState } from '@/components/common/empty-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import type { Post } from '@/data/content'
import { cn } from '@/lib/utils'
import { localTime } from '@/features/agenda/dates'
import { dayHeading, groupByDay } from './calendar-views'
import { FormatIcon, PostStatusBadge, PostThumb, formatLabel, useMediaUrls } from './post-ui'

/** Lista por día, con selección para mandar a aprobar varias juntas. */
export function ListView({ posts, onOpen, onCreate, onApprove, hideClient }: { posts: Post[]; onOpen: (p: Post) => void; onCreate: () => void; onApprove: (clientId: string, ids: string[]) => void; hideClient?: boolean }) {
  const urls = useMediaUrls(posts)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const days = [...groupByDay(posts).entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const ideas = posts.filter((p) => !p.scheduled_at)
  const chosen = posts.filter((p) => selected.has(p.id))
  const sameClient = chosen.length > 0 && chosen.every((p) => p.client_id === chosen[0].client_id)

  if (!posts.length)
    return (
      <Card>
        <EmptyState icon={CalendarRange} title="No hay publicaciones en estas fechas" description="Creá una publicación o mirá otro período." action={<Button onClick={onCreate}>Nueva publicación</Button>} />
      </Card>
    )

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const row = (p: Post) => (
    <li key={p.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 sm:px-4">
      <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} aria-label="Elegir para aprobación" disabled={p.status === 'publicado'} />
      <button onClick={() => onOpen(p)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <PostThumb post={p} urls={urls} className="size-12 shrink-0 rounded-md" showIcons={false} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{p.caption || <span className="text-muted-foreground">Sin copy</span>}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            {p.scheduled_at && <span className="tabular-nums">{localTime(p.scheduled_at)}</span>}
            <span className="inline-flex items-center gap-1"><FormatIcon format={p.format} />{formatLabel[p.format]}</span>
            {!hideClient && <ClientChip name={p.client_name} color={p.client_color} />}
            {p.media.length > 0 && <span>{p.media.length} archivo{p.media.length > 1 ? 's' : ''}</span>}
          </span>
        </span>
        <PostStatusBadge status={p.status} className="shrink-0" />
      </button>
    </li>
  )

  return (
    <div className="space-y-5">
      {chosen.length > 0 && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-2.5 shadow-soft">
          <span className="text-sm font-medium">{chosen.length} elegida{chosen.length > 1 ? 's' : ''}</span>
          {!sameClient && <span className="text-xs text-warning">Para pedir aprobación tienen que ser del mismo cliente.</span>}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Limpiar</Button>
            <Button
              size="sm"
              disabled={!sameClient}
              onClick={() => {
                onApprove(chosen[0].client_id, chosen.map((p) => p.id))
                setSelected(new Set())
              }}
            >
              <Send /> Pedir aprobación
            </Button>
          </div>
        </div>
      )}
      {ideas.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Ideas sin fecha</h3>
          <Card><ul className="divide-y">{ideas.map(row)}</ul></Card>
        </section>
      )}
      {days.map(([day, list]) => (
        <section key={day}>
          <h3 className={cn('mb-2 text-sm font-semibold first-letter:uppercase')}>{dayHeading(day)}</h3>
          <Card><ul className="divide-y">{list.map(row)}</ul></Card>
        </section>
      ))}
    </div>
  )
}
