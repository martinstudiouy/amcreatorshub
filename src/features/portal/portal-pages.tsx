import { useQuery } from '@tanstack/react-query'
import { ArrowRight, BarChart3, CalendarRange, CheckCircle2, Grid3x3, List } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { listPosts, type Post } from '@/data/content'
import { listAccounts, listDailyMetrics } from '@/data/instagram'
import { PORTAL_STATUSES } from '@/data/portal'
import { useAuth } from '@/features/auth/auth-context'
import { localDate, localTime, toIso } from '@/features/agenda/dates'
import { dayHeading, groupByDay } from '@/features/content/calendar-views'
import { GridView } from '@/features/content/grid-view'
import { FormatIcon, PostStatusBadge, PostThumb, formatLabel, useMediaUrls } from '@/features/content/post-ui'
import { compact } from '@/features/metrics/metrics-charts'
import { summarize } from '@/features/metrics/metrics-calc'
import { MetricsView } from '@/features/metrics/metrics-view'
import { useParam } from '@/features/projects/use-task-sheet'
import { ViewSwitch } from '@/features/projects/view-switch'
import { addDays, todayMvd } from '@/lib/format'
import { PortalPostSheet } from './portal-post-sheet'
import { usePortalClient } from './portal-layout'

const visible = (p: Post) => (PORTAL_STATUSES as readonly string[]).includes(p.status)

function usePortalPosts(fromDays: number, toDays: number) {
  const { profile } = useAuth()
  const clientId = profile?.client_id ?? undefined
  const range = useMemo(() => ({ from: toIso(addDays(todayMvd(), fromDays), '00:00'), to: toIso(addDays(todayMvd(), toDays), '00:00'), clientId }), [clientId, fromDays, toDays])
  return useQuery({ queryKey: ['posts', 'portal', range], queryFn: () => listPosts(range), enabled: !!clientId, select: (d) => d.filter((p) => p.scheduled_at && visible(p)) })
}

function PostRow({ p, urls, onOpen }: { p: Post; urls: Record<string, string>; onOpen: (p: Post) => void }) {
  return (
    <li>
      <button onClick={() => onOpen(p)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40">
        <PostThumb post={p} urls={urls} className="size-14 shrink-0 rounded-md" showIcons={false} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{p.caption || 'Sin texto'}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <FormatIcon format={p.format} /> {formatLabel[p.format]} · <span className="first-letter:uppercase">{dayHeading(localDate(p.scheduled_at!))}</span> · {localTime(p.scheduled_at!)}
          </span>
        </span>
        <PostStatusBadge status={p.status} className="shrink-0" />
      </button>
    </li>
  )
}

// ================================================================ Inicio
export function PortalHome() {
  const { profile } = useAuth()
  const { data: client } = usePortalClient()
  const posts = usePortalPosts(-7, 45)
  const urls = useMediaUrls(posts.data)
  const [open, setOpen] = useState<Post | null>(null)
  const accounts = useQuery({ queryKey: ['ig-accounts'], queryFn: listAccounts })
  const account = accounts.data?.find((a) => a.client_id === profile?.client_id)
  const month = todayMvd().slice(0, 7)
  const daily = useQuery({ queryKey: ['ig-daily', account?.id, 'portal-home'], queryFn: () => listDailyMetrics(account!.id, addDays(`${month}-01`, -1), todayMvd()), enabled: !!account })
  const sum = daily.data ? summarize(daily.data, [], `${month}-01`, todayMvd()) : null

  const pending = (posts.data ?? []).filter((p) => p.status === 'en_aprobacion')
  const upcoming = (posts.data ?? []).filter((p) => p.status !== 'en_aprobacion' && p.status !== 'publicado' && p.scheduled_at! >= new Date().toISOString()).slice(0, 6)
  const first = profile?.full_name?.split(' ')[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Hola{first ? `, ${first}` : ''}</h1>
        <p className="mt-1 text-muted-foreground">Este es el espacio de {client?.brand_name ?? 'tu marca'} con AM Creators: tu contenido, lo que falta aprobar y cómo vienen tus redes.</p>
      </div>

      {posts.error ? (
        <ErrorState error={posts.error} onRetry={() => void posts.refetch()} />
      ) : posts.isLoading ? (
        <Skeleton className="h-40" />
      ) : (
        <Card className={pending.length ? 'border-warning/50' : undefined}>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{pending.length ? `Para aprobar (${pending.length})` : 'Para aprobar'}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pending.length ? (
              <ul className="divide-y border-t">{pending.map((p) => <PostRow key={p.id} p={p} urls={urls} onOpen={setOpen} />)}</ul>
            ) : (
              <p className="flex items-center gap-2 px-6 pb-6 text-sm text-muted-foreground"><CheckCircle2 className="size-4 text-success" /> Estás al día: no hay nada esperando tu aprobación.</p>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Próximas publicaciones</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link to="/portal/contenido">Ver todo <ArrowRight /></Link></Button>
          </CardHeader>
          <CardContent className="p-0">
            {!upcoming.length ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">Todavía no hay publicaciones aprobadas en agenda.</p>
            ) : (
              <ul className="divide-y border-t">{upcoming.map((p) => <PostRow key={p.id} p={p} urls={urls} onOpen={setOpen} />)}</ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Instagram este mes</CardTitle>
            {account && <Button variant="ghost" size="sm" asChild><Link to="/portal/metricas">Ver métricas <ArrowRight /></Link></Button>}
          </CardHeader>
          <CardContent>
            {!account ? (
              <p className="text-sm text-muted-foreground">Cuando conectemos tu Instagram, acá vas a ver cómo vienen tus redes.</p>
            ) : !sum ? (
              <Skeleton className="h-24" />
            ) : (
              <dl className="grid grid-cols-2 gap-4">
                {[
                  ['Seguidores', sum.followersEnd, sum.followersDelta != null ? `${sum.followersDelta >= 0 ? '+' : ''}${sum.followersDelta} este mes` : null],
                  ['Alcance', sum.reach, null],
                  ['Interacciones', sum.interactions, null],
                  ['Engagement', sum.engagementRate, null],
                ].map(([label, value, hint]) => (
                  <div key={label as string} className="rounded-lg bg-muted/50 p-3">
                    <dt className="text-xs text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-xl font-bold tabular-nums">
                      {value == null ? '—' : label === 'Engagement' ? `${(value as number).toLocaleString('es-UY')}%` : compact(value as number)}
                    </dd>
                    {hint && <dd className="text-xs text-success">{hint}</dd>}
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
      <PortalPostSheet post={open} onClose={() => setOpen(null)} />
    </div>
  )
}

// ================================================================ Contenido
export function PortalContent() {
  const { data: client } = usePortalClient()
  const [view, setView] = useParam<'lista' | 'grilla'>('vista', 'lista', ['lista', 'grilla'])
  const posts = usePortalPosts(-30, 90)
  const urls = useMediaUrls(view === 'lista' ? posts.data : [])
  const [open, setOpen] = useState<Post | null>(null)
  const days = [...groupByDay(posts.data ?? []).entries()].sort((a, b) => a[0].localeCompare(b[0]))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Contenido</h1>
          <p className="mt-1 text-sm text-muted-foreground">Del último mes y los próximos 3. Tocá una publicación para verla, aprobarla o pedir cambios.</p>
        </div>
        <ViewSwitch value={view} onChange={setView} options={[{ id: 'lista', label: 'Lista', icon: List }, { id: 'grilla', label: 'Grilla', icon: Grid3x3 }]} />
      </div>
      {view === 'grilla' ? (
        <GridView client={client ?? undefined} onOpen={(p) => visible(p) && setOpen(p)} />
      ) : posts.error ? (
        <ErrorState error={posts.error} onRetry={() => void posts.refetch()} />
      ) : posts.isLoading ? (
        <Skeleton className="h-64" />
      ) : !days.length ? (
        <Card><EmptyState icon={CalendarRange} title="Todavía no hay contenido para mostrar" description="Cuando el equipo te mande publicaciones para aprobar, aparecen acá." /></Card>
      ) : (
        days.map(([day, list]) => (
          <section key={day}>
            <h2 className="mb-2 text-sm font-semibold first-letter:uppercase">{dayHeading(day)}</h2>
            <Card><ul className="divide-y">{list.map((p) => <PostRow key={p.id} p={p} urls={urls} onOpen={setOpen} />)}</ul></Card>
          </section>
        ))
      )}
      <PortalPostSheet post={open} onClose={() => setOpen(null)} />
    </div>
  )
}

// ================================================================ Métricas
export function PortalMetrics() {
  const { profile } = useAuth()
  const accounts = useQuery({ queryKey: ['ig-accounts'], queryFn: listAccounts })
  const mine = (accounts.data ?? []).filter((a) => a.client_id === profile?.client_id)
  const [accountId, setAccountId] = useParam<string>('cuenta', '')
  const [month, setMonth] = useParam<string>('mes', todayMvd().slice(0, 7))
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Métricas</h1>
        <p className="mt-1 text-sm text-muted-foreground">Cómo viene tu Instagram mes a mes. Podés descargar el reporte mensual en PDF.</p>
      </div>
      {accounts.isLoading ? (
        <Skeleton className="h-96" />
      ) : !mine.length ? (
        <Card><EmptyState icon={BarChart3} title="Tu Instagram todavía no está conectado" description="Cuando el equipo lo conecte, acá vas a ver seguidores, alcance, tus mejores publicaciones y el reporte mensual." /></Card>
      ) : (
        <MetricsView accounts={mine} accountId={accountId || mine[0].id} onAccount={setAccountId} month={month} onMonth={setMonth} readOnly />
      )}
    </div>
  )
}
