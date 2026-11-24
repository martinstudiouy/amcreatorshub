import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, CheckCheck, CircleAlert, Clock, FileText, LayoutTemplate, LoaderCircle, Send, X, Zap } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { toast } from 'sonner'
import { ChannelIcon } from '@/components/common/channel-icon'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { friendlyError } from '@/data/api'
import {
  fillTemplate,
  listMessages,
  listQuickReplies,
  listTemplates,
  mediaUrl,
  sendTemplate,
  sendText,
  windowLeft,
  windowOpen,
  type Conversation,
  type Message,
  type WaTemplate,
} from '@/data/messages'
import { cn } from '@/lib/utils'

export function invalidateInbox(qc: ReturnType<typeof useQueryClient>, conversationId?: string) {
  void qc.invalidateQueries({ queryKey: ['conversations'] })
  void qc.invalidateQueries({ queryKey: ['dashboard'] })
  if (conversationId) void qc.invalidateQueries({ queryKey: ['messages', conversationId] })
}

const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString('es-UY', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Montevideo',
  })
const dayOf = (iso: string) =>
  new Date(iso).toLocaleDateString('es-UY', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Montevideo',
  })

// ================================================================ Mensajes
function Media({ m }: { m: Message }) {
  const { data: url, isLoading } = useQuery({
    queryKey: ['message-media', m.media_path],
    queryFn: () => mediaUrl(m.media_path!),
    enabled: !!m.media_path,
    staleTime: 50 * 60_000,
  })
  if (!m.media_path) return null
  if (isLoading) return <Skeleton className="h-40 w-56 rounded-lg" />
  if (!url) return <p className="text-xs opacity-80">No se pudo cargar el archivo.</p>
  if (m.type === 'imagen')
    return (
      <a href={url} target="_blank" rel="noreferrer">
        <img src={url} alt="Imagen recibida" className="max-h-72 max-w-full rounded-lg object-cover" />
      </a>
    )
  if (m.type === 'video') return <video src={url} controls playsInline className="max-h-72 max-w-full rounded-lg" />
  if (m.type === 'audio') return <audio src={url} controls className="max-w-full" />
  return (
    <a href={url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg bg-black/5 px-3 py-2 text-sm underline-offset-2 hover:underline dark:bg-white/10">
      <FileText className="size-4 shrink-0" /> {m.file_name ?? 'Documento'}
    </a>
  )
}

function Ticks({ m }: { m: Message }) {
  if (m.direction !== 'saliente') return null
  if (m.delivery_status === 'fallo') return <CircleAlert className="size-3.5 text-destructive" aria-label="No se entregó" />
  if (m.delivery_status === 'leido') return <CheckCheck className="size-3.5 text-[#7DD3FC]" aria-label="Leído" />
  if (m.delivery_status === 'entregado') return <CheckCheck className="size-3.5 opacity-80" aria-label="Entregado" />
  return <Check className="size-3.5 opacity-80" aria-label="Enviado" />
}

export function MessageList({ conversation }: { conversation: Conversation }) {
  const { data, isLoading } = useQuery({
    queryKey: ['messages', conversation.id],
    queryFn: () => listMessages(conversation.id),
  })
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [data?.length, conversation.id])

  if (isLoading)
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="ml-auto h-12 w-1/2" />
        <Skeleton className="h-12 w-3/5" />
      </div>
    )
  return (
    <div className="space-y-1.5 px-3 py-4 sm:px-5" role="log" aria-live="polite">
      {(data ?? []).map((m, i, all) => {
        const day = dayOf(m.sent_at)
        const showDay = i === 0 || dayOf(all[i - 1].sent_at) !== day
        const out = m.direction === 'saliente'
        return (
          <div key={m.id}>
            {showDay && <p className="my-3 text-center text-xs font-medium text-muted-foreground first-letter:uppercase">{day}</p>}
            <div className={cn('flex', out ? 'justify-end' : 'justify-start')}>
              <div
                className={cn('max-w-[85%] space-y-1 rounded-2xl px-3.5 py-2 text-sm shadow-soft sm:max-w-[70%]', out ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-card')}
              >
                {m.type === 'plantilla' && (
                  <p className={cn('flex items-center gap-1 text-[11px] font-semibold', out ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                    <LayoutTemplate className="size-3" /> Plantilla
                    {m.template_name ? `: ${m.template_name}` : ''}
                  </p>
                )}
                <Media m={m} />
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                <p className={cn('flex items-center justify-end gap-1 text-[11px]', out ? 'text-primary-foreground/75' : 'text-muted-foreground')}>
                  {timeOf(m.sent_at)} <Ticks m={m} />
                </p>
                {m.delivery_status === 'fallo' && m.error_message && <p className="text-[11px] text-primary-foreground/90">No se entregó: {m.error_message}</p>}
              </div>
            </div>
          </div>
        )
      })}
      {!data?.length && <p className="py-10 text-center text-sm text-muted-foreground">Todavía no hay mensajes.</p>}
      <div ref={end} />
    </div>
  )
}

// ================================================================ Escribir
export function Composer({ conversation }: { conversation: Conversation }) {
  const qc = useQueryClient()
  const [text, setText] = useState('')
  const [quickOpen, setQuickOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const area = useRef<HTMLTextAreaElement>(null)
  const { data: replies } = useQuery({ queryKey: ['quick-replies'], queryFn: listQuickReplies })
  const open = windowOpen(conversation)
  const left = windowLeft(conversation)

  useEffect(() => {
    setText('')
  }, [conversation.id])

  const send = useMutation({
    mutationFn: () => sendText(conversation.id, text.trim()),
    onSuccess: () => {
      setText('')
      invalidateInbox(qc, conversation.id)
    },
    onError: (e) => toast.error(friendlyError(e), { duration: 8000 }),
  })

  // "/" al principio muestra las respuestas rápidas que coinciden
  const slash = text.startsWith('/') && !text.includes(' ') ? text.toLowerCase() : null
  const matches = useMemo(() => (replies ?? []).filter((r) => slash == null || r.shortcut.startsWith(slash) || r.title.toLowerCase().includes(slash.slice(1))), [replies, slash])
  const showQuick = quickOpen || (slash != null && matches.length > 0)
  const pick = (body: string) => {
    setText(body)
    setQuickOpen(false)
    requestAnimationFrame(() => area.current?.focus())
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (showQuick && slash && matches[0]) return pick(matches[0].body)
      if (text.trim() && open && !send.isPending) send.mutate()
    }
    if (e.key === 'Escape') setQuickOpen(false)
  }

  if (!open)
    return (
      <div className="border-t bg-card p-3 sm:p-4">
        <p className="mb-3 flex items-start gap-2 text-sm text-muted-foreground">
          <Clock className="mt-0.5 size-4 shrink-0" />
          {conversation.channel === 'whatsapp'
            ? conversation.last_inbound_at
              ? 'Pasaron más de 24 horas desde su último mensaje. WhatsApp solo deja escribirle con una plantilla aprobada.'
              : 'Todavía no te escribió. Para iniciar la conversación por WhatsApp hay que usar una plantilla aprobada.'
            : 'Pasaron más de 24 horas desde su último mensaje: Instagram no deja responder hasta que vuelva a escribir.'}
        </p>
        {conversation.channel === 'whatsapp' && (
          <Button onClick={() => setTemplateOpen(true)}>
            <LayoutTemplate /> Mandar una plantilla
          </Button>
        )}
        <TemplateDialog open={templateOpen} onOpenChange={setTemplateOpen} target={{ conversationId: conversation.id }} contactName={conversation.contact_name ?? ''} />
      </div>
    )

  return (
    <div className="relative border-t bg-card p-3 sm:p-4">
      {showQuick && (
        <div className="absolute inset-x-3 bottom-full mb-2 max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg sm:inset-x-4">
          <div className="flex items-center justify-between px-2 py-1.5 text-xs font-medium text-muted-foreground">
            Respuestas rápidas
            <button onClick={() => (setQuickOpen(false), setText(''))} aria-label="Cerrar">
              <X className="size-3.5" />
            </button>
          </div>
          {matches.length ? (
            matches.map((r) => (
              <button key={r.id} onClick={() => pick(r.body)} className="block w-full rounded-md px-2 py-2 text-left hover:bg-accent">
                <span className="text-sm font-medium">
                  <span className="text-brand">{r.shortcut}</span> · {r.title}
                </span>
                <span className="line-clamp-1 text-xs text-muted-foreground">{r.body}</span>
              </button>
            ))
          ) : (
            <p className="px-2 py-2 text-sm text-muted-foreground">No hay respuestas rápidas. Creálas en Configuración → Mensajes.</p>
          )}
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex shrink-0 flex-col gap-1">
          <Button variant="ghost" size="icon" onClick={() => setQuickOpen((o) => !o)} aria-label="Respuestas rápidas" title="Respuestas rápidas (o escribí /)">
            <Zap />
          </Button>
          {conversation.channel === 'whatsapp' && (
            <Button variant="ghost" size="icon" onClick={() => setTemplateOpen(true)} aria-label="Plantillas de WhatsApp" title="Plantillas de WhatsApp">
              <LayoutTemplate />
            </Button>
          )}
        </div>
        <Textarea
          ref={area}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          placeholder="Escribí un mensaje… (/ para respuestas rápidas)"
          className="min-h-[3.25rem] flex-1 resize-none"
          aria-label="Mensaje"
        />
        <Button size="icon" className="size-11 shrink-0" onClick={() => send.mutate()} disabled={!text.trim() || send.isPending} aria-label="Enviar">
          {send.isPending ? <LoaderCircle className="animate-spin" /> : <Send />}
        </Button>
      </div>
      {left < 3 * 3600_000 && <p className="mt-2 text-xs text-warning">Quedan {Math.max(1, Math.round(left / 60_000))} minutos para responder sin plantilla.</p>}
      <TemplateDialog open={templateOpen} onOpenChange={setTemplateOpen} target={{ conversationId: conversation.id }} contactName={conversation.contact_name ?? ''} />
    </div>
  )
}

// ================================================================ Plantillas
export function TemplateDialog({
  open,
  onOpenChange,
  target,
  contactName,
  onSent,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  target: { conversationId?: string; clientId?: string }
  contactName: string
  onSent?: (conversationId: string) => void
}) {
  const qc = useQueryClient()
  const { data: templates, isLoading } = useQuery({
    queryKey: ['wa-templates'],
    queryFn: listTemplates,
    enabled: open,
  })
  const approved = (templates ?? []).filter((t) => t.status === 'aprobada')
  const [sel, setSel] = useState<WaTemplate | null>(null)
  const [params, setParams] = useState<string[]>([])

  useEffect(() => {
    if (!open) setSel(null)
  }, [open])
  const choose = (t: WaTemplate) => {
    setSel(t)
    setParams(t.variables.map((_, i) => (i === 0 ? contactName.split(' ')[0] : '')))
  }

  const send = useMutation({
    mutationFn: () => sendTemplate(target, sel!, params),
    onSuccess: (convId) => {
      toast.success('Plantilla enviada.')
      invalidateInbox(qc, convId)
      onOpenChange(false)
      onSent?.(convId)
    },
    onError: (e) => toast.error(friendlyError(e), { duration: 8000 }),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>{sel ? sel.name : 'Elegí una plantilla'}</DialogTitle>
        <DialogDescription className="mt-1">
          {sel ? 'Completá las partes variables y revisá cómo queda.' : 'Son mensajes aprobados por Meta. Se pueden mandar aunque hayan pasado más de 24 horas.'}
        </DialogDescription>
        {!sel ? (
          <div className="mt-5">
            {isLoading ? (
              <Skeleton className="h-32" />
            ) : approved.length ? (
              <ul className="max-h-[50vh] space-y-2 overflow-y-auto">
                {approved.map((t) => (
                  <li key={t.id}>
                    <button onClick={() => choose(t)} className="w-full rounded-lg border p-3 text-left hover:border-brand hover:bg-brand/5">
                      <p className="text-sm font-semibold">
                        {t.name} <span className="font-normal text-muted-foreground">· {t.language}</span>
                      </p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.body}</p>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-muted px-3 py-4 text-sm text-muted-foreground">
                No hay plantillas aprobadas. Crealas en WhatsApp Manager y después tocá “Sincronizar plantillas” en Configuración → Mensajes.
              </p>
            )}
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {sel.variables.map((v, i) => (
              <div key={v} className="space-y-1.5">
                <Label htmlFor={`tv-${v}`}>Variable {`{{${v}}}`}</Label>
                <Input id={`tv-${v}`} value={params[i] ?? ''} onChange={(e) => setParams((p) => p.map((x, j) => (j === i ? e.target.value : x)))} />
              </div>
            ))}
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="mb-1 text-xs font-medium text-muted-foreground">Vista previa</p>
              <p className="whitespace-pre-wrap">{fillTemplate(sel.body, params)}</p>
            </div>
            <div className="flex justify-between gap-2">
              <Button variant="ghost" onClick={() => setSel(null)}>
                Elegir otra
              </Button>
              <Button onClick={() => send.mutate()} disabled={send.isPending || params.some((p) => !p.trim())}>
                {send.isPending && <LoaderCircle className="animate-spin" />} Enviar plantilla
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function ChannelBadge({ channel, className }: { channel: Conversation['channel']; className?: string }) {
  return (
    <span
      className={cn('inline-flex size-5 items-center justify-center rounded-full text-white', channel === 'whatsapp' ? 'bg-[#020061]' : 'bg-[#0300FF]', className)}
      aria-label={channel === 'whatsapp' ? 'WhatsApp' : 'Instagram'}
    >
      <ChannelIcon channel={channel} className="size-3" />
    </span>
  )
}
