import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  ArrowUpRight,
  CalendarClock,
  CalendarRange,
  Camera,
  CircleAlert,
  FolderKanban,
  Inbox,
  ListTodo,
  MapPin,
  PackageCheck,
  TrendingUp,
  Users,
  Video,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChannelIcon, channelLabel } from '@/components/common/channel-icon'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { getDashboard } from '@/data/api'
import { columnLabel, eventTypeLabel, formatLabel, postStatusLabel, priorityLabel } from '@/data/labels'
import type { DashboardSummary, EventType, PostStatus, TaskPriority } from '@/data/types'
import { useAuth } from '@/features/auth/auth-context'
import { formatDate, formatLongDate, formatMoney, formatNumber, formatTime, timeAgo, todayMvd } from '@/lib/format'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const { profile } = useAuth()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard, refetchInterval: 60_000 })
  const firstName = profile?.full_name?.split(' ')[0]

  return (
    <>
      <PageHeader title={firstName ? `Hola, ${firstName}` : 'Hola'} description={formatLongDate(todayMvd())} />
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <DashboardSkeleton />
      ) : (
        <DashboardContent data={data} />
      )}
    </>
  )
}

function DashboardContent({ data }: { data: DashboardSummary }) {
  const k = data.kpis
  const growth = k.followers != null && k.followers_30d_ago != null ? k.followers - k.followers_30d_ago : null

  return (
    <div className="space-y-6">
      {data.account_alerts.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/8 px-4 py-3 text-sm">
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <div className="flex-1">
            {data.account_alerts.map((a) => (
              <p key={a.id}>
                <strong>@{a.username}</strong>
                {a.client_name ? ` (${a.client_name})` : ''}{' '}
                {a.status === 'desconectada'
                  ? 'se desconectó. Hay que volver a conectarla para publicar y ver métricas.'
                  : `vence el ${formatDate(a.token_expires_at)}. Renovala para que no deje de publicar.`}
              </p>
            ))}
          </div>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" aria-label="Indicadores">
        <Kpi icon={FolderKanban} label="Proyectos activos" value={formatNumber(k.active_projects)} to="/proyectos" />
        {data.is_admin ? (
          <>
            <Kpi icon={Wallet} label="Facturado en el mes" value={formatMoney(k.billed_month_uyu)} hint="En pesos, con el tipo de cambio de cada cobro" to="/finanzas" />
            <Kpi
              icon={Inbox}
              label="Cobros pendientes"
              value={formatMoney(k.pending_uyu)}
              hint={k.pending_count ? `${k.pending_count} cobro${k.pending_count > 1 ? 's' : ''}${k.overdue_count ? `, ${k.overdue_count} vencido${k.overdue_count > 1 ? 's' : ''}` : ''}` : 'Nada pendiente'}
              tone={k.overdue_count ? 'danger' : undefined}
              to="/finanzas"
            />
          </>
        ) : (
          <>
            <Kpi icon={Users} label="Clientes activos" value={formatNumber(k.active_clients)} to="/clientes" />
            <Kpi icon={ListTodo} label="Tareas para hoy" value={formatNumber(data.tasks.filter((t) => !t.overdue && t.due_date === data.today).length)} />
          </>
        )}
        <Kpi
          icon={TrendingUp}
          label="Seguidores (@amcreators)"
          value={k.followers != null ? formatNumber(k.followers) : '—'}
          hint={growth != null ? `${growth >= 0 ? '+' : ''}${formatNumber(growth)} en 30 días` : 'Conectá Instagram en la Fase 6'}
          tone={growth != null && growth > 0 ? 'success' : undefined}
          to="/metricas"
        />
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 lg:col-span-2 lg:gap-6">
          <Panel icon={CalendarClock} title="Reuniones de hoy" count={data.meetings.length} to="/agenda">
            {data.meetings.length === 0 ? (
              <EmptyState compact icon={CalendarClock} title="Hoy no tenés reuniones" description="Cuando agendes una, aparece acá." />
            ) : (
              <ul className="divide-y">
                {data.meetings.map((m) => (
                  <li key={m.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="w-12 shrink-0 text-sm font-semibold tabular-nums">{formatTime(m.starts_at)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{m.title}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                        <EventIcon type={m.type} />
                        {[m.client_name, eventTypeLabel[m.type]].filter(Boolean).join(' · ')}
                      </p>
                      {m.meet_url ? (
                        <a href={m.meet_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                          <Video className="size-3.5" /> Unirse a Meet
                        </a>
                      ) : m.location ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="size-3.5" /> {m.location}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel icon={CalendarRange} title="Publicaciones de hoy" count={data.posts.length} to="/contenidos">
            {data.posts.length === 0 ? (
              <EmptyState compact icon={CalendarRange} title="Hoy no hay publicaciones" description="Las publicaciones programadas para hoy aparecen acá." />
            ) : (
              <ul className="divide-y">
                {data.posts.map((p) => (
                  <li key={p.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="w-12 shrink-0 text-sm font-semibold tabular-nums">{formatTime(p.scheduled_at)}</div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm">{p.caption || 'Sin texto'}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="size-2 rounded-full" style={{ background: p.color_tag ?? 'var(--muted-foreground)' }} />
                          {p.client_name}
                        </span>
                        <span>·</span>
                        <span>{formatLabel[p.format]}</span>
                        <PostStatusBadge status={p.status} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel icon={ListTodo} title="Tareas que vencen" count={data.tasks.length} to="/proyectos">
            {data.tasks.length === 0 ? (
              <EmptyState compact icon={ListTodo} title="Nada por vencer" description="No hay tareas atrasadas ni que venzan en los próximos 2 días." />
            ) : (
              <ul className="divide-y">
                {data.tasks.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <PriorityDot priority={t.priority} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.title}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {t.client_name} · {columnLabel[t.column]}
                        {t.assignee_name ? ` · ${t.assignee_name}` : ''}
                      </p>
                    </div>
                    <DueLabel due={t.due_date} today={data.today} overdue={t.overdue} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel icon={Inbox} title="Mensajes sin responder" count={data.unread.reduce((s, c) => s + c.unread_count, 0)} to="/mensajes">
            {data.unread.length === 0 ? (
              <EmptyState compact icon={Inbox} title="Bandeja al día" description="No hay mensajes sin responder." />
            ) : (
              <ul className="divide-y">
                {data.unread.map((c) => (
                  <li key={c.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted" title={channelLabel[c.channel]}>
                      <ChannelIcon channel={c.channel} className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium">
                        {c.contact_name}
                        {c.is_new_contact && <Badge variant="neutral">Nuevo contacto</Badge>}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{c.preview}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-[11px] text-muted-foreground">{timeAgo(c.last_message_at)}</span>
                      <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">{c.unread_count}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel icon={Activity} title="Actividad reciente">
          {data.activity.length === 0 ? (
            <EmptyState compact icon={Activity} title="Todavía no hay actividad" description="Cuando el equipo cree clientes, mueva tareas o programe contenido, lo vas a ver acá." />
          ) : (
            <ol className="relative space-y-4 before:absolute before:bottom-1 before:left-[5px] before:top-1 before:w-px before:bg-border">
              {data.activity.map((a) => (
                <li key={a.id} className="relative pl-6">
                  <span className={cn('absolute left-0 top-1.5 size-[11px] rounded-full border-2 border-card', a.action === 'creo' ? 'bg-brand' : 'bg-muted-foreground/50')} />
                  <p className="text-sm leading-snug">{a.summary}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {[a.actor_name, timeAgo(a.created_at)].filter(Boolean).join(' · ')}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>
    </div>
  )
}

function Kpi({ icon: Icon, label, value, hint, tone, to }: { icon: LucideIcon; label: string; value: string; hint?: string; tone?: 'success' | 'danger'; to?: string }) {
  const body = (
    <Card className={cn('h-full p-4 transition-colors lg:p-5', to && 'hover:border-foreground/15')}>
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-medium sm:text-sm">{label}</span>
        <Icon className="size-4 shrink-0" />
      </div>
      <p className="mt-2 text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{value}</p>
      {hint && <p className={cn('mt-1 text-xs', tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-destructive' : 'text-muted-foreground')}>{hint}</p>}
    </Card>
  )
  return to ? <Link to={to}>{body}</Link> : body
}

function Panel({ icon: Icon, title, count, to, children }: { icon: LucideIcon; title: string; count?: number; to?: string; children: ReactNode }) {
  return (
    <Card className="flex min-w-0 flex-col">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 text-brand" />
          {title}
          {count ? <span className="rounded-md bg-muted px-1.5 text-xs font-semibold text-muted-foreground">{count}</span> : null}
        </CardTitle>
        {to && (
          <Link to={to} className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-brand">
            Ver todo <ArrowUpRight className="size-3.5" />
          </Link>
        )}
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  )
}

const statusVariant: Record<PostStatus, 'neutral' | 'default' | 'success' | 'warning' | 'danger'> = {
  idea: 'neutral',
  borrador: 'neutral',
  en_aprobacion: 'warning',
  aprobado: 'default',
  programado: 'default',
  publicado: 'success',
  error: 'danger',
}

function PostStatusBadge({ status }: { status: PostStatus }) {
  return <Badge variant={statusVariant[status]}>{postStatusLabel[status]}</Badge>
}

const priorityColor: Record<TaskPriority, string> = {
  baja: 'bg-muted-foreground/40',
  media: 'bg-brand/60',
  alta: 'bg-warning',
  urgente: 'bg-destructive',
}

function PriorityDot({ priority }: { priority: TaskPriority }) {
  return <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', priorityColor[priority])} title={`Prioridad ${priorityLabel[priority].toLowerCase()}`} />
}

function DueLabel({ due, today, overdue }: { due: string; today: string; overdue: boolean }) {
  if (overdue) return <Badge variant="danger">Vencida</Badge>
  if (due === today) return <Badge variant="warning">Hoy</Badge>
  return <span className="shrink-0 text-xs text-muted-foreground">{formatDate(due)}</span>
}

const eventIcons: Record<EventType, LucideIcon> = { reunion: Users, evento: CalendarClock, sesion_fotos: Camera, entrega: PackageCheck }
function EventIcon({ type }: { type: EventType }) {
  const I = eventIcons[type]
  return <I className="size-3.5 shrink-0" />
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="space-y-3 p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-28" />
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:col-span-2 lg:gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="space-y-4 p-5">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </Card>
          ))}
        </div>
        <Card className="space-y-4 p-5">
          <Skeleton className="h-5 w-36" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </Card>
      </div>
    </div>
  )
}
