import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, BarChart3, ChevronLeft, ChevronRight, Clapperboard, ExternalLink, FileDown, Images, Image as ImageIcon, LoaderCircle, MousePointerClick, RefreshCw, Sparkles, Eye, Users, Heart } from 'lucide-react'
import { useMemo } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { getSettings } from '@/data/api'
import { friendlyError } from '@/data/api'
import { listDailyMetrics, listPostMetrics, syncInstagramNow, type PostMetric, type SocialAccount } from '@/data/instagram'
import { addDays, formatDate, formatNumber, timeAgo, todayMvd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { addMonths, monthLabel } from '@/features/agenda/dates'
import { AccountAvatar, AccountStatus, invalidateInstagram } from './instagram-accounts'
import { DailyBars, LineChart, compact } from './metrics-charts'
import { SLOTS, WEEKDAYS_SHORT, bestTimes, isoRange, monthRange, pctChange, postEngagement, postInteractions, summarize, topPosts, type Summary } from './metrics-calc'

export const mediaTypeLabel = (p: Pick<PostMetric, 'media_type' | 'media_product_type'>) =>
  p.media_product_type === 'REELS' ? 'Reel' : p.media_type === 'CAROUSEL_ALBUM' ? 'Carrusel' : p.media_type === 'VIDEO' ? 'Video' : 'Foto'
const MediaIcon = ({ p }: { p: PostMetric }) => {
  const Icon = p.media_product_type === 'REELS' || p.media_type === 'VIDEO' ? Clapperboard : p.media_type === 'CAROUSEL_ALBUM' ? Images : ImageIcon
  return <Icon className="size-3.5" />
}

/** Métricas de una cuenta de Instagram por mes, con comparativa contra el mes anterior. */
export function MetricsView({ accounts, accountId, onAccount, month, onMonth }: { accounts: SocialAccount[]; accountId: string; onAccount: (id: string) => void; month: string; onMonth: (m: string) => void }) {
  const qc = useQueryClient()
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0]
  const r = monthRange(month)
  const today = todayMvd()
  const isCurrent = month === today.slice(0, 7)

  const daily = useQuery({ queryKey: ['ig-daily', account.id, r.prevFrom, r.to], queryFn: () => listDailyMetrics(account.id, addDays(r.prevFrom, -1), r.to) })
  const span = isoRange(r.prevFrom, r.to)
  const posts = useQuery({ queryKey: ['ig-posts', account.id, span.from, span.to], queryFn: () => listPostMetrics(account.id, span.from, span.to) })
  const last90 = isoRange(addDays(today, -90), today)
  const recent = useQuery({ queryKey: ['ig-posts', account.id, 'last90', last90.from], queryFn: () => listPostMetrics(account.id, last90.from, last90.to) })

  const sync = useMutation({
    mutationFn: () => syncInstagramNow(account.id),
    onSuccess: () => {
      invalidateInstagram(qc)
      toast.success('Métricas actualizadas.')
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const data = useMemo(() => {
    if (!daily.data || !posts.data) return null
    const cur = isoRange(r.from, r.to)
    const monthPosts = posts.data.filter((p) => p.posted_at! >= cur.from && p.posted_at! < cur.to)
    const prevPosts = posts.data.filter((p) => p.posted_at! < cur.from)
    const now = summarize(daily.data, monthPosts, r.from, r.to)
    const before = summarize(daily.data, prevPosts, r.prevFrom, r.prevTo)
    const days: string[] = []
    for (let d = r.from; d <= r.to && d <= today; d = addDays(d, 1)) days.push(d)
    const byDate = new Map(daily.data.map((d) => [d.date, d]))
    return {
      now,
      before,
      monthPosts,
      top: topPosts(monthPosts, 5),
      followers: days.map((d) => ({ date: d, value: byDate.get(d)?.followers ?? null })),
      reach: days.filter((d) => d < today).map((d) => ({ date: d, value: byDate.get(d)?.reach ?? null })),
    }
  }, [daily.data, posts.data, r.from, r.to, r.prevFrom, r.prevTo, today])
  const times = useMemo(() => (recent.data ? bestTimes(recent.data) : null), [recent.data])

  const report = useMutation({
    mutationFn: async () => {
      const [{ downloadMetricsReport }, studio] = await Promise.all([import('./report-pdf'), getSettings()])
      await downloadMetricsReport({ account, month, monthLabel: monthLabel(`${month}-01`), prevLabel: monthLabel(`${r.prev}-01`), now: data!.now, before: data!.before, followers: data!.followers, reach: data!.reach, top: data!.top, times, studio })
    },
    onSuccess: () => toast.success('Reporte listo.'),
    onError: (e) => toast.error(friendlyError(e)),
  })

  const error = daily.error ?? posts.error
  return (
    <div className="space-y-6">
      {/* Barra de herramientas */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <AccountAvatar a={account} className="size-11" />
          <div className="min-w-0">
            {accounts.length > 1 ? (
              <Select value={account.id} onValueChange={onAccount}>
                <SelectTrigger className="h-9 w-64 font-semibold" aria-label="Cuenta"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>@{a.username}{a.client_name ? ` · ${a.client_name}` : ' · Estudio'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="truncate font-semibold">@{account.username}</p>
            )}
            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <AccountStatus a={account} />
              {account.last_synced_at ? `Actualizado ${timeAgo(account.last_synced_at)}` : 'Sin datos todavía'}
            </p>
          </div>
        </div>
        <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" onClick={() => onMonth(addMonths(`${month}-01`, -1).slice(0, 7))} aria-label="Mes anterior"><ChevronLeft /></Button>
            <span className="min-w-36 text-center font-semibold capitalize">{monthLabel(`${month}-01`)}</span>
            <Button variant="ghost" size="icon" onClick={() => onMonth(addMonths(`${month}-01`, 1).slice(0, 7))} disabled={isCurrent} aria-label="Mes siguiente"><ChevronRight /></Button>
          </div>
          <Button variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending || account.status === 'desconectada'}>
            {sync.isPending ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} <span className="hidden sm:inline">Actualizar</span>
          </Button>
          <Button onClick={() => report.mutate()} disabled={!data || report.isPending}>
            {report.isPending ? <LoaderCircle className="animate-spin" /> : <FileDown />} Reporte mensual
          </Button>
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => { void daily.refetch(); void posts.refetch() }} />
      ) : !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : !data.now.days && !data.monthPosts.length ? (
        <Card>
          <EmptyState icon={BarChart3} title={`Sin datos de ${monthLabel(`${month}-01`)}`} description="Las métricas se guardan desde el día que se conectó la cuenta. Probá con otro mes o tocá Actualizar." />
        </Card>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4" aria-label="Indicadores del mes">
            <Kpi icon={Users} label="Seguidores" value={data.now.followersEnd} delta={data.now.followersDelta} deltaLabel="en el mes" />
            <Kpi icon={Eye} label="Alcance" value={data.now.reach} change={pctChange(data.now.reach, data.before.reach)} hint="Cuentas únicas que vieron el contenido (suma diaria)" />
            <Kpi icon={Sparkles} label="Visualizaciones" value={data.now.views} change={pctChange(data.now.views, data.before.views)} />
            <Kpi icon={Heart} label="Interacciones" value={data.now.interactions} change={pctChange(data.now.interactions, data.before.interactions)} hint="Me gusta, comentarios, guardados y compartidos" />
            <Kpi icon={BarChart3} label="Engagement" value={data.now.engagementRate} suffix="%" decimals change={data.now.engagementRate != null && data.before.engagementRate != null ? Math.round((data.now.engagementRate - data.before.engagementRate) * 10) / 10 : null} changeIsPoints hint="Interacciones ÷ alcance" />
            <Kpi icon={MousePointerClick} label="Clics al link" value={data.now.linkClicks} change={pctChange(data.now.linkClicks, data.before.linkClicks)} hint="Toques en el link y los botones del perfil" />
          </section>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 [&>*]:min-w-0">
            <Card>
              <CardHeader><CardTitle>Seguidores</CardTitle></CardHeader>
              <CardContent><LineChart points={data.followers} /></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Alcance por día</CardTitle></CardHeader>
              <CardContent><DailyBars points={data.reach} /></CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_26rem] [&>*]:min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>Top 5 del mes</CardTitle>
                <p className="text-xs text-muted-foreground">Ordenadas por interacciones. {data.monthPosts.length} publicaciones en el mes.</p>
              </CardHeader>
              <CardContent>
                {!data.top.length ? (
                  <p className="text-sm text-muted-foreground">No hubo publicaciones en este mes.</p>
                ) : (
                  <ol className="space-y-3">
                    {data.top.map((p, i) => <TopPost key={p.ig_media_id} p={p} rank={i + 1} />)}
                  </ol>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Mejor horario para publicar</CardTitle>
                <p className="text-xs text-muted-foreground">Interacciones promedio según día y hora, con las publicaciones de los últimos 90 días ({times?.sample ?? 0}).</p>
              </CardHeader>
              <CardContent>{times ? <Heatmap t={times} /> : <Skeleton className="h-48" />}</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Este mes contra {monthLabel(`${r.prev}-01`)}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <CompareTable now={data.now} before={data.before} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Publicaciones del mes</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <PostsTable posts={data.monthPosts} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function Kpi({ icon: Icon, label, value, suffix, decimals, change, changeIsPoints, delta, deltaLabel, hint }: { icon: typeof Users; label: string; value: number | null; suffix?: string; decimals?: boolean; change?: number | null; changeIsPoints?: boolean; delta?: number | null; deltaLabel?: string; hint?: string }) {
  const shown = value == null ? '—' : decimals ? value.toLocaleString('es-UY', { maximumFractionDigits: 1 }) : compact(value)
  const d = delta ?? change
  return (
    <Card title={hint}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand"><Icon className="size-4" /></span>
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight tabular-nums">{shown}{value != null && suffix}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {d == null ? (
            'Sin comparación'
          ) : (
            <span className={cn('inline-flex items-center font-medium', d >= 0 ? 'text-success' : 'text-destructive')}>
              {d >= 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
              {delta != null ? `${d >= 0 ? '+' : ''}${formatNumber(d)} ${deltaLabel}` : `${Math.abs(d).toLocaleString('es-UY')}${changeIsPoints ? ' pts' : '%'}`}
            </span>
          )}
          {d != null && delta == null && ' vs. mes anterior'}
        </p>
      </CardContent>
    </Card>
  )
}

function TopPost({ p, rank }: { p: PostMetric; rank: number }) {
  return (
    <li className="flex gap-3">
      <span className="relative shrink-0">
        {p.thumbnail_url ? (
          <img src={p.thumbnail_url} alt="" className="size-16 rounded-md object-cover" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} />
        ) : (
          <span className="flex size-16 items-center justify-center rounded-md bg-muted text-muted-foreground"><MediaIcon p={p} /></span>
        )}
        <span className="absolute -left-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-brand text-[11px] font-bold text-white">{rank}</span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-medium">{p.caption || 'Sin texto'}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <MediaIcon p={p} /> {mediaTypeLabel(p)} · {formatDate(p.posted_at)}
          {p.permalink && (
            <a href={p.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand hover:underline">Ver <ExternalLink className="size-3" /></a>
          )}
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 text-xs tabular-nums">
          <span><strong>{compact(postInteractions(p))}</strong> interacciones</span>
          <span className="text-muted-foreground">{compact(p.reach ?? 0)} alcance</span>
          <span className="text-muted-foreground">{formatNumber(p.likes)} me gusta · {formatNumber(p.comments)} coment. · {formatNumber(p.saves)} guard. · {formatNumber(p.shares)} compart.</span>
        </p>
      </div>
    </li>
  )
}

function Heatmap({ t }: { t: ReturnType<typeof bestTimes> }) {
  const max = Math.max(1, ...t.grid.flat().map((v) => v ?? 0))
  if (!t.sample) return <p className="text-sm text-muted-foreground">Todavía no hay publicaciones para calcularlo.</p>
  return (
    <div>
      {t.best && (
        <p className="mb-4 rounded-lg bg-brand/8 px-3 py-2 text-sm">
          Lo que mejor funciona: <strong>{['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados', 'domingos'][t.best.weekday]} de {SLOTS[t.best.slot].label} h</strong>
          {t.bestSlot && t.bestSlot.slot !== t.best.slot && <> · en general, de {SLOTS[t.bestSlot.slot].label} h</>}.
        </p>
      )}
      <div className="grid grid-cols-[2.5rem_repeat(6,minmax(0,1fr))] gap-1 text-[11px]">
        <span />
        {SLOTS.map((s) => <span key={s.label} className="text-center text-muted-foreground">{s.label}</span>)}
        {t.grid.map((row, d) => (
          <div key={d} className="contents">
            <span className="flex items-center text-muted-foreground">{WEEKDAYS_SHORT[d]}</span>
            {row.map((v, s) => (
              <span
                key={s}
                className={cn('flex h-7 items-center justify-center rounded tabular-nums', v == null ? 'bg-muted/60' : (v / max) > 0.55 ? 'text-white' : 'text-foreground')}
                style={v == null ? undefined : { background: `color-mix(in srgb, #0300FF ${Math.round(12 + (v / max) * 88)}%, transparent)` }}
                title={v == null ? 'Sin publicaciones' : `${WEEKDAYS_SHORT[d]} ${SLOTS[s].label} h: ${formatNumber(v)} interacciones promedio (${t.counts[d][s]} publicaciones)`}
              >
                {v == null ? '' : compact(v)}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function CompareTable({ now, before }: { now: Summary; before: Summary }) {
  const rows: { label: string; a: number | null; b: number | null; pct?: boolean; abs?: boolean }[] = [
    { label: 'Seguidores al cierre', a: now.followersEnd, b: before.followersEnd },
    { label: 'Seguidores ganados', a: now.followersDelta, b: before.followersDelta, abs: true },
    { label: 'Alcance', a: now.reach, b: before.reach },
    { label: 'Visualizaciones', a: now.views, b: before.views },
    { label: 'Interacciones', a: now.interactions, b: before.interactions },
    { label: 'Engagement', a: now.engagementRate, b: before.engagementRate, pct: true },
    { label: 'Clics al link', a: now.linkClicks, b: before.linkClicks },
    { label: 'Publicaciones', a: now.posts, b: before.posts },
  ]
  const fmt = (v: number | null, pct?: boolean) => (v == null ? '—' : pct ? `${v.toLocaleString('es-UY', { maximumFractionDigits: 1 })}%` : formatNumber(v))
  return (
    <table className="w-full min-w-[460px] text-sm">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th className="py-2 font-medium">Métrica</th>
          <th className="py-2 text-right font-medium">Este mes</th>
          <th className="py-2 text-right font-medium">Mes anterior</th>
          <th className="py-2 text-right font-medium">Cambio</th>
        </tr>
      </thead>
      <tbody className="divide-y tabular-nums">
        {rows.map((r) => {
          const c = r.pct || r.abs ? (r.a != null && r.b != null ? Math.round((r.a - r.b) * 10) / 10 : null) : pctChange(r.a, r.b)
          return (
            <tr key={r.label}>
              <td className="py-2">{r.label}</td>
              <td className="py-2 text-right font-semibold">{fmt(r.a, r.pct)}</td>
              <td className="py-2 text-right text-muted-foreground">{fmt(r.b, r.pct)}</td>
              <td className={cn('py-2 text-right font-medium', c == null ? 'text-muted-foreground' : c >= 0 ? 'text-success' : 'text-destructive')}>
                {c == null ? '—' : `${c >= 0 ? '+' : ''}${c.toLocaleString('es-UY')}${r.pct ? ' pts' : r.abs ? '' : '%'}`}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function PostsTable({ posts }: { posts: PostMetric[] }) {
  if (!posts.length) return <p className="text-sm text-muted-foreground">No hubo publicaciones en este mes.</p>
  return (
    <table className="w-full min-w-[760px] text-sm">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          <th className="py-2 font-medium">Publicación</th>
          <th className="py-2 text-right font-medium">Alcance</th>
          <th className="py-2 text-right font-medium">Reproducc.</th>
          <th className="py-2 text-right font-medium">Me gusta</th>
          <th className="py-2 text-right font-medium">Coment.</th>
          <th className="py-2 text-right font-medium">Guardados</th>
          <th className="py-2 text-right font-medium">Compart.</th>
          <th className="py-2 text-right font-medium">Engagement</th>
        </tr>
      </thead>
      <tbody className="divide-y tabular-nums">
        {posts.map((p) => (
          <tr key={p.ig_media_id}>
            <td className="max-w-72 py-2 pr-3">
              <a href={p.permalink ?? undefined} target="_blank" rel="noreferrer" className="line-clamp-1 hover:text-brand">{p.caption || 'Sin texto'}</a>
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><MediaIcon p={p} /> {mediaTypeLabel(p)} · {formatDate(p.posted_at)}</span>
            </td>
            <td className="py-2 text-right">{formatNumber(p.reach)}</td>
            <td className="py-2 text-right">{p.media_product_type === 'REELS' || p.media_type === 'VIDEO' ? formatNumber(p.views) : '—'}</td>
            <td className="py-2 text-right">{formatNumber(p.likes)}</td>
            <td className="py-2 text-right">{formatNumber(p.comments)}</td>
            <td className="py-2 text-right">{formatNumber(p.saves)}</td>
            <td className="py-2 text-right">{formatNumber(p.shares)}</td>
            <td className="py-2 text-right font-semibold">{postEngagement(p) == null ? '—' : `${postEngagement(p)!.toLocaleString('es-UY')}%`}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
