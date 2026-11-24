import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, CircleAlert, LoaderCircle, MessageCircle, Pencil, Plus, RefreshCw, Trash2, Zap } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState } from '@/components/common/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { friendlyError } from '@/data/api'
import { deleteQuickReply, listQuickReplies, listTemplates, messagingStatus, saveQuickReply, syncTemplates, type QuickReply } from '@/data/messages'
import { useRole } from '@/features/auth/auth-context'

/** Configuración → Mensajes: respuestas rápidas y plantillas de WhatsApp. */
export function MessagesSettingsTab() {
  const isAdmin = useRole() === 'admin'
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
      <QuickRepliesCard />
      <TemplatesCard canSync={isAdmin} />
    </div>
  )
}

function QuickRepliesCard() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['quick-replies'], queryFn: listQuickReplies })
  const [editing, setEditing] = useState<QuickReply | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<QuickReply | null>(null)
  return (
    <Card className="h-fit">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Zap className="size-4 text-brand" /> Respuestas rápidas
          </CardTitle>
          <CardDescription className="mt-1">En la bandeja, escribí “/” y el atajo para insertarla.</CardDescription>
        </div>
        <Button size="sm" onClick={() => setEditing(null)}>
          <Plus /> Nueva
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : !data?.length ? (
          <EmptyState compact icon={Zap} title="Sin respuestas rápidas" description="Guardá los mensajes que mandás seguido: saludo, precios, datos para transferir…" />
        ) : (
          <ul className="divide-y">
            {data.map((r) => (
              <li key={r.id} className="group flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    <span className="text-brand">{r.shortcut}</span> · {r.title}
                  </p>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{r.body}</p>
                </div>
                <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditing(r)} aria-label={`Editar ${r.shortcut}`}>
                  <Pencil />
                </Button>
                <Button size="icon" variant="ghost" className="size-8" onClick={() => setDeleting(r)} aria-label={`Borrar ${r.shortcut}`}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <QuickReplyDialog reply={editing} onClose={() => setEditing(undefined)} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`¿Borrar ${deleting?.shortcut}?`}
        confirmLabel="Borrar"
        destructive
        onConfirm={async () => {
          try {
            await deleteQuickReply(deleting!.id)
            void qc.invalidateQueries({ queryKey: ['quick-replies'] })
          } catch (e) {
            toast.error(friendlyError(e))
          }
        }}
      />
    </Card>
  )
}

function QuickReplyDialog({ reply, onClose }: { reply: QuickReply | null | undefined; onClose: () => void }) {
  const qc = useQueryClient()
  const open = reply !== undefined
  const [f, setF] = useState({ shortcut: '', title: '', body: '' })
  const [error, setError] = useState<string | null>(null)
  const [lastOpen, setLastOpen] = useState(false)
  if (open !== lastOpen) {
    setLastOpen(open)
    if (open) {
      setF(reply ? { shortcut: reply.shortcut, title: reply.title, body: reply.body } : { shortcut: '/', title: '', body: '' })
      setError(null)
    }
  }
  const save = useMutation({
    mutationFn: () => saveQuickReply(f, reply?.id),
    onSuccess: () => {
      toast.success('Respuesta guardada.')
      void qc.invalidateQueries({ queryKey: ['quick-replies'] })
      onClose()
    },
    onError: (e) => setError(friendlyError(e).includes('duplicate') || friendlyError(e).includes('ya existe') ? 'Ya hay una respuesta con ese atajo.' : friendlyError(e)),
  })
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!f.title.trim() || !f.body.trim()) return setError('Completá el nombre y el texto.')
    save.mutate()
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogTitle>{reply ? 'Editar respuesta rápida' : 'Nueva respuesta rápida'}</DialogTitle>
        <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate>
          <div className="grid grid-cols-[8rem_1fr] gap-3">
            <div className="space-y-2">
              <Label htmlFor="qr-s">Atajo</Label>
              <Input id="qr-s" value={f.shortcut} onChange={(e) => setF({ ...f, shortcut: e.target.value })} placeholder="/precios" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qr-t">Nombre</Label>
              <Input id="qr-t" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Planes y precios" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="qr-b">Texto</Label>
            <Textarea id="qr-b" rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
          </div>
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <LoaderCircle className="animate-spin" />} Guardar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const tplVariant = { aprobada: 'success', pendiente: 'warning', rechazada: 'danger' } as const
const tplLabel = {
  aprobada: 'Aprobada',
  pendiente: 'En revisión',
  rechazada: 'Rechazada',
} as const

function TemplatesCard({ canSync }: { canSync: boolean }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['wa-templates'], queryFn: listTemplates })
  const sync = useMutation({
    mutationFn: syncTemplates,
    onSuccess: (n) => {
      toast.success(`Listo: ${n} plantilla${n === 1 ? '' : 's'}.`)
      void qc.invalidateQueries({ queryKey: ['wa-templates'] })
    },
    onError: (e) => toast.error(friendlyError(e), { duration: 8000 }),
  })
  return (
    <Card className="h-fit">
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="size-4 text-brand" /> Plantillas de WhatsApp
          </CardTitle>
          <CardDescription className="mt-1">Se crean y aprueban en WhatsApp Manager (Meta). Sirven para escribir después de las 24 h y para los recordatorios de la agenda.</CardDescription>
        </div>
        {canSync && (
          <Button size="sm" variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending} className="shrink-0">
            {sync.isPending ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Sincronizar
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24" />
        ) : !data?.length ? (
          <p className="rounded-lg bg-muted px-3 py-4 text-sm text-muted-foreground">Todavía no hay plantillas. Creálas en WhatsApp Manager y tocá Sincronizar.</p>
        ) : (
          <ul className="divide-y">
            {data.map((t) => (
              <li key={t.id} className="py-3">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {t.name} <span className="font-normal text-muted-foreground">· {t.language}</span>
                  <Badge variant={tplVariant[t.status]}>{tplLabel[t.status]}</Badge>
                  {t.name === 'recordatorio_reunion' && <Badge variant="neutral">Recordatorios de agenda</Badge>}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{t.body}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Para los recordatorios por WhatsApp de la agenda, creá una plantilla llamada <strong className="text-foreground">recordatorio_reunion</strong> (categoría Utilidad) con este texto: “Hola{' '}
          {'{{1}}'}, te recordamos {'{{2}}'} el {'{{3}}'}. Lugar: {'{{4}}'}. ¡Te esperamos!”
        </p>
      </CardContent>
    </Card>
  )
}

/** Tarjeta de WhatsApp en Configuración → Integraciones. */
export function WhatsAppCard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['messaging-status'],
    queryFn: messagingStatus,
  })
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="flex size-10 items-center justify-center rounded-full bg-accent text-brand">
          <MessageCircle className="size-5" />
        </span>
        {isLoading ? <Skeleton className="h-5 w-20" /> : data?.whatsapp ? <Badge variant="success">Conectado</Badge> : <Badge variant="neutral">Sin configurar</Badge>}
      </div>
      <div>
        <p className="font-semibold">WhatsApp Business</p>
        <p className="mt-1 text-sm text-muted-foreground">Bandeja unificada, plantillas y recordatorios a clientes.</p>
      </div>
      {error ? (
        <p className="flex gap-1.5 text-xs text-destructive">
          <CircleAlert className="size-3.5 shrink-0" /> {friendlyError(error)}
        </p>
      ) : data?.whatsapp ? (
        <p className="flex items-center gap-1.5 text-sm">
          <CheckCircle2 className="size-4 text-success" /> {data.phone ?? 'Número conectado'}
          {data.name ? ` · ${data.name}` : ''}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Se configura en Meta y con las claves en GitHub (pasos de la Fase 7).</p>
      )}
      {data && !data.webhook && <p className="text-xs text-warning">Falta el token del webhook: los mensajes nuevos no van a llegar.</p>}
      <p className="mt-auto text-xs text-muted-foreground">Las claves se guardan solo en el servidor, nunca en el navegador.</p>
    </Card>
  )
}
