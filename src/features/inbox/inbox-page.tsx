import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ExternalLink, Inbox, MessagesSquare, Search, Tag, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { BrandMark } from '@/components/common/client-chip'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { friendlyError } from '@/data/api'
import { listClients } from '@/data/crm'
import { LABELS, convTitle, labelText, listConversations, markRead, statusText, subscribeInbox, updateConversation, windowOpen, type Conversation, type ConvStatus, type Label } from '@/data/messages'
import { ClientFormDialog } from '@/features/clients/client-form-dialog'
import { useParam } from '@/features/projects/use-task-sheet'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ChannelBadge, Composer, MessageList, invalidateInbox } from './inbox-parts'

const FILTERS = ['abierta', 'pendiente', 'cerrada', 'todas'] as const
type Filter = (typeof FILTERS)[number]

/** Escucha la bandeja en tiempo real y refresca lo que cambió. */
export function useInboxRealtime() {
  const qc = useQueryClient()
  useEffect(
    () =>
      subscribeInbox((e) => {
        invalidateInbox(qc, e.conversationId)
      }),
    [qc],
  )
}

function Avatar({ c, className }: { c: Conversation; className?: string }) {
  return (
    <span className={cn('relative shrink-0', className)}>
      {c.contact_avatar ? (
        <img src={c.contact_avatar} alt="" className="size-10 rounded-full object-cover" />
      ) : (
        <BrandMark name={convTitle(c).replace(/^[@+]/, '')} color={c.client_color ?? '#64748B'} className="size-10 rounded-full text-sm" />
      )}
      <ChannelBadge channel={c.channel} className="absolute -bottom-0.5 -right-0.5 size-[18px] ring-2 ring-card" />
    </span>
  )
}

export function InboxPage() {
  useInboxRealtime()
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => listConversations(),
  })
  const [selectedId, setSelectedId] = useParam<string>('conversacion', '')
  const [filter, setFilter] = useState<Filter>('abierta')
  const [channel, setChannel] = useState<'todos' | 'whatsapp' | 'instagram'>('todos')
  const [label, setLabel] = useState<Label | 'todas'>('todas')
  const [q, setQ] = useState('')

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (data ?? []).filter(
      (c) =>
        (filter === 'todas' || c.status === filter) &&
        (channel === 'todos' || c.channel === channel) &&
        (label === 'todas' || c.labels.includes(label)) &&
        (!t || [convTitle(c), c.contact_name, c.contact_username, c.external_contact_id, c.last_message_preview].some((x) => x?.toLowerCase().includes(t))),
    )
  }, [data, filter, channel, label, q])
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f, (data ?? []).filter((c) => f === 'todas' || c.status === f).length])), [data])
  const selected = (data ?? []).find((c) => c.id === selectedId) ?? null

  // Al abrir una conversación con mensajes nuevos, se marca como leída
  useEffect(() => {
    if (selected && selected.unread_count > 0) void markRead(selected.id).then(() => invalidateInbox(qc))
  }, [selected?.id, selected?.unread_count]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <PageHeader title="Mensajes" description="WhatsApp e Instagram en un solo lugar. Los mensajes llegan en tiempo real." />
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : (
        <Card className="grid h-[calc(100dvh-17.5rem)] min-h-[420px] md:h-[calc(100dvh-13rem)] md:min-h-[520px] grid-cols-1 overflow-hidden md:grid-cols-[20rem_1fr] xl:grid-cols-[22rem_1fr_18rem]">
          {/* ------------------------------------------------ Lista */}
          <aside className={cn('flex min-h-0 flex-col border-r', selected && 'hidden md:flex')}>
            <div className="space-y-2 border-b p-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…" className="pl-9" aria-label="Buscar conversación" />
              </div>
              <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1" role="tablist">
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    role="tab"
                    aria-selected={filter === f}
                    onClick={() => setFilter(f)}
                    className={cn('flex-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium', filter === f ? 'bg-card shadow-soft' : 'text-muted-foreground hover:text-foreground')}
                  >
                    {f === 'todas' ? 'Todas' : statusText[f as ConvStatus]} <span className="tabular-nums opacity-60">{counts[f]}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
                  <SelectTrigger className="h-8 text-xs" aria-label="Canal">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los canales</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={label} onValueChange={(v) => setLabel(v as typeof label)}>
                  <SelectTrigger className="h-8 text-xs" aria-label="Etiqueta">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas las etiquetas</SelectItem>
                    {LABELS.map((l) => (
                      <SelectItem key={l} value={l}>
                        {labelText[l]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="space-y-2 p-3">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : !list.length ? (
                <EmptyState
                  compact
                  icon={Inbox}
                  title={data?.length ? 'Nada con ese filtro' : 'Todavía no hay mensajes'}
                  description={data?.length ? 'Probá con otro filtro.' : 'Cuando alguien te escriba por WhatsApp o Instagram, aparece acá.'}
                />
              ) : (
                <ul>
                  {list.map((c) => (
                    <li key={c.id}>
                      <button onClick={() => setSelectedId(c.id)} className={cn('flex w-full gap-3 border-b px-3 py-3 text-left hover:bg-muted/50', c.id === selectedId && 'bg-accent')}>
                        <Avatar c={c} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className={cn('truncate text-sm', c.unread_count ? 'font-bold' : 'font-medium')}>{convTitle(c)}</span>
                            <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{c.last_message_at ? timeAgo(c.last_message_at) : ''}</span>
                          </span>
                          <span className="mt-0.5 flex items-center gap-2">
                            <span className={cn('line-clamp-1 flex-1 text-xs', c.unread_count ? 'text-foreground' : 'text-muted-foreground')}>{c.last_message_preview ?? ''}</span>
                            {c.unread_count > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">{c.unread_count}</span>}
                          </span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            {!c.client_id && (
                              <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                                Nuevo contacto
                              </Badge>
                            )}
                            {c.labels
                              .filter((l) => !(l === 'cliente' && c.client_id))
                              .map((l) => (
                                <Badge key={l} variant="neutral" className="px-1.5 py-0 text-[10px]">
                                  {labelText[l as Label]}
                                </Badge>
                              ))}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          {/* ------------------------------------------------ Conversación */}
          {selected ? (
            <section className="flex min-h-0 min-w-0 flex-col">
              <header className="flex items-center gap-3 border-b px-3 py-2.5 sm:px-4">
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelectedId('')} aria-label="Volver a la lista">
                  <ArrowLeft />
                </Button>
                <Avatar c={selected} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{convTitle(selected)}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selected.channel === 'whatsapp' ? `WhatsApp · +${selected.external_contact_id}` : `Instagram${selected.contact_username ? ` · @${selected.contact_username}` : ''}`}
                    {windowOpen(selected) ? '' : ' · fuera de las 24 h'}
                  </p>
                </div>
                <Select
                  value={selected.status}
                  onValueChange={async (v) => {
                    try {
                      await updateConversation(selected.id, { status: v as ConvStatus })
                      invalidateInbox(qc)
                    } catch (e) {
                      toast.error(friendlyError(e))
                    }
                  }}
                >
                  <SelectTrigger className="h-9 w-32" aria-label="Estado de la conversación">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(['abierta', 'pendiente', 'cerrada'] as ConvStatus[]).map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusText[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto bg-muted/40">
                <MessageList conversation={selected} />
              </div>
              <div className="xl:hidden">
                <ContactStrip c={selected} />
              </div>
              <Composer conversation={selected} />
            </section>
          ) : (
            <section className="hidden items-center justify-center md:flex">
              <EmptyState icon={MessagesSquare} title="Elegí una conversación" description="Respondé, etiquetá y vinculá cada contacto con su cliente." />
            </section>
          )}

          {/* ------------------------------------------------ Contacto */}
          <aside className="hidden min-h-0 overflow-y-auto border-l xl:block">{selected ? <ContactPanel c={selected} /> : null}</aside>
        </Card>
      )}
    </>
  )
}

function useClientActions(c: Conversation) {
  const qc = useQueryClient()
  return async (patch: Parameters<typeof updateConversation>[1], ok?: string) => {
    try {
      await updateConversation(c.id, patch)
      invalidateInbox(qc)
      if (ok) toast.success(ok)
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }
}

function LabelsEditor({ c }: { c: Conversation }) {
  const update = useClientActions(c)
  return (
    <div className="flex flex-wrap gap-1.5">
      {LABELS.map((l) => {
        const on = c.labels.includes(l)
        return (
          <button
            key={l}
            onClick={() => void update({ labels: on ? c.labels.filter((x) => x !== l) : [...c.labels, l] })}
            aria-pressed={on}
            className={cn('rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors', on ? 'border-brand bg-brand/10 text-brand' : 'text-muted-foreground hover:border-foreground/30')}
          >
            {labelText[l]}
          </button>
        )
      })}
    </div>
  )
}

/** Vincular con un cliente existente o crear uno nuevo (cliente o lead). */
function ClientLink({ c }: { c: Conversation }) {
  const update = useClientActions(c)
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: listClients })
  const [creating, setCreating] = useState(false)
  if (c.client_id)
    return (
      <div className="flex items-center gap-2">
        <BrandMark name={c.client_name ?? '?'} color={c.client_color} className="size-8 rounded-md text-xs" />
        <Link to={`/clientes/${c.client_id}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-brand">
          {c.client_name}
        </Link>
        <Button size="icon" variant="ghost" className="size-8" asChild>
          <Link to={`/clientes/${c.client_id}`} aria-label="Abrir ficha">
            <ExternalLink />
          </Link>
        </Button>
        <button className="text-xs text-muted-foreground hover:text-destructive" onClick={() => void update({ client_id: null }, 'Se desvinculó del cliente.')}>
          Desvincular
        </button>
      </div>
    )
  return (
    <div className="space-y-2">
      <p className="text-sm">
        <Badge variant="warning">Nuevo contacto</Badge>
      </p>
      <Select onValueChange={(v) => void update({ client_id: v, labels: [...new Set([...c.labels, 'cliente'])] }, 'Conversación vinculada al cliente.')}>
        <SelectTrigger className="h-9" aria-label="Vincular con un cliente">
          <SelectValue placeholder="Vincular con un cliente…" />
        </SelectTrigger>
        <SelectContent>
          {clients?.map((cl) => (
            <SelectItem key={cl.id} value={cl.id}>
              {cl.brand_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" className="w-full" onClick={() => setCreating(true)}>
        <UserPlus /> Crear cliente o lead
      </Button>
      <ClientFormDialog
        open={creating}
        onOpenChange={setCreating}
        initial={{
          brand_name: c.contact_name ?? c.contact_username ?? '',
          name: c.contact_name ?? '',
          whatsapp: c.channel === 'whatsapp' ? `+${c.external_contact_id}` : '',
          instagram_handle: c.contact_username ?? '',
          status: 'lead',
        }}
        onSaved={(id) =>
          void update(
            {
              client_id: id,
              labels: [...new Set([...c.labels.filter((l) => l !== 'cliente'), 'lead'])],
            },
            'Listo: quedó creado y vinculado.',
          )
        }
      />
    </div>
  )
}

function ContactPanel({ c }: { c: Conversation }) {
  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col items-center text-center">
        <Avatar c={c} className="scale-125" />
        <p className="mt-4 font-semibold">{c.contact_name ?? convTitle(c)}</p>
        <p className="text-xs text-muted-foreground">{c.channel === 'whatsapp' ? `+${c.external_contact_id}` : c.contact_username ? `@${c.contact_username}` : 'Instagram'}</p>
      </div>
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cliente</h3>
        <ClientLink c={c} />
      </section>
      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Tag className="size-3.5" /> Etiquetas
        </h3>
        <LabelsEditor c={c} />
      </section>
      <p className="text-xs text-muted-foreground">Primer mensaje {timeAgo(c.created_at)}.</p>
    </div>
  )
}

/** En pantallas medianas, el contacto va en una franja arriba del cuadro de texto. */
function ContactStrip({ c }: { c: Conversation }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-t bg-card px-3 py-2 sm:px-4">
      <button className="flex w-full items-center gap-2 text-left text-xs text-muted-foreground" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Tag className="size-3.5" />
        {c.client_name ?? 'Nuevo contacto'} · {c.labels.length ? c.labels.map((l) => labelText[l as Label]).join(', ') : 'sin etiquetas'}
        <span className="ml-auto font-medium text-brand">{open ? 'Cerrar' : 'Editar'}</span>
      </button>
      {open && (
        <div className="mt-3 grid gap-4 pb-1 sm:grid-cols-2">
          <ClientLink c={c} />
          <LabelsEditor c={c} />
        </div>
      )}
    </div>
  )
}
