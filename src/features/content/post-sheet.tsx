import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ChevronLeft, ChevronRight, Copy, LoaderCircle, MessageSquareWarning, Send, ThumbsUp, Trash2, Upload, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { friendlyError } from '@/data/api'
import {
  addMedia,
  approvalsForPost,
  deletePost,
  duplicatePost,
  getPost,
  removeMedia,
  reorderMedia,
  savePost,
  type Decision,
  type Media,
  type Post,
  type PostFormat,
  type PostStatus,
} from '@/data/content'
import { listClients } from '@/data/crm'
import { formatDateTime, timeAgo, todayMvd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { localDate, localTime, toIso } from '@/features/agenda/dates'
import { FORMATS, STATUSES, formatIcon, formatLabel, formatWarnings, invalidateContent, statusLabel, useMediaUrls } from './post-ui'

const MAX_MB = 50

export interface PostDraft {
  date?: string
  time?: string
  clientId?: string
  format?: PostFormat
}

type Item =
  | { key: string; kind: 'existing'; media: Media; type: 'imagen' | 'video' }
  | { key: string; kind: 'new'; file: File; preview: string; type: 'imagen' | 'video' }

/** Panel lateral para crear o editar una publicación. */
export function PostSheet({
  postId,
  draft,
  open,
  onClose,
  onRequestApproval,
}: {
  postId?: string | null
  draft?: PostDraft
  open: boolean
  onClose: () => void
  onRequestApproval?: (clientId: string, postIds: string[]) => void
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-2xl" aria-describedby={undefined}>
        {open && (postId ? <ExistingPost postId={postId} onClose={onClose} onRequestApproval={onRequestApproval} /> : <PostForm key={JSON.stringify(draft ?? {})} draft={draft} onClose={onClose} />)}
      </SheetContent>
    </Sheet>
  )
}

function ExistingPost({ postId, onClose, onRequestApproval }: { postId: string; onClose: () => void; onRequestApproval?: (clientId: string, postIds: string[]) => void }) {
  const { data, isLoading } = useQuery({ queryKey: ['post', postId], queryFn: () => getPost(postId) })
  if (isLoading)
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-48" />
        <Skeleton className="h-32" />
      </div>
    )
  if (!data)
    return (
      <div className="p-6">
        <SheetTitle className="text-lg font-semibold">No encontramos esta publicación</SheetTitle>
        <p className="mt-2 text-sm text-muted-foreground">Puede que la hayan borrado.</p>
      </div>
    )
  return <PostForm key={data.id + data.updated_at} post={data} onClose={onClose} onRequestApproval={onRequestApproval} />
}

function PostForm({ post, draft, onClose, onRequestApproval }: { post?: Post; draft?: PostDraft; onClose: () => void; onRequestApproval?: (clientId: string, postIds: string[]) => void }) {
  const qc = useQueryClient()
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: listClients })
  const urls = useMediaUrls(post ? [post] : [])
  const fileInput = useRef<HTMLInputElement>(null)

  const [clientId, setClientId] = useState(post?.client_id ?? draft?.clientId ?? '')
  const [format, setFormat] = useState<PostFormat>(post?.format ?? draft?.format ?? 'feed')
  const [date, setDate] = useState(post?.scheduled_at ? localDate(post.scheduled_at) : (draft?.date ?? ''))
  const [time, setTime] = useState(post?.scheduled_at ? localTime(post.scheduled_at) : (draft?.time ?? '12:00'))
  const [status, setStatus] = useState<PostStatus>(post?.status ?? (draft?.date ? 'borrador' : 'idea'))
  const [caption, setCaption] = useState(post?.caption ?? '')
  const [hashtags, setHashtags] = useState(post?.hashtags ?? '')
  const [items, setItems] = useState<Item[]>(() => (post?.media ?? []).map((m) => ({ key: m.id, kind: 'existing', media: m, type: m.media_type })))
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  // Liberar las vistas previas locales al cerrar
  useEffect(() => () => items.forEach((i) => i.kind === 'new' && URL.revokeObjectURL(i.preview)), []) // eslint-disable-line react-hooks/exhaustive-deps

  // Si hay un solo cliente, lo elegimos de una
  useEffect(() => {
    if (!clientId && clients?.length === 1) setClientId(clients[0].id)
  }, [clients]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: approvals } = useQuery({ queryKey: ['approvals-post', post?.id], queryFn: () => approvalsForPost(post!.id), enabled: !!post })
  const latest = approvals?.[0]
  const myDecision = latest?.decided_at ? (latest.decisions as Record<string, Decision>)[post!.id] : undefined

  const warnings = useMemo(() => formatWarnings(format, items, caption, hashtags), [format, items, caption, hashtags])
  const client = clients?.find((c) => c.id === clientId)
  const locked = post?.status === 'publicado'
  const vertical = format === 'reel' || format === 'story'

  function addFiles(files: FileList | File[]) {
    const list = [...files]
    const ok: Item[] = []
    for (const f of list) {
      if (!f.type.startsWith('image/') && !f.type.startsWith('video/')) {
        toast.error(`"${f.name}" no es una imagen ni un video.`)
        continue
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        toast.error(`"${f.name}" pesa más de ${MAX_MB} MB. Exportalo más liviano (1080p, H.264) y volvé a subirlo.`)
        continue
      }
      ok.push({ key: crypto.randomUUID(), kind: 'new', file: f, preview: URL.createObjectURL(f), type: f.type.startsWith('video/') ? 'video' : 'imagen' })
    }
    if (!ok.length) return
    setItems((xs) => [...xs, ...ok])
    // Formato sugerido según lo que se sube
    const total = items.length + ok.length
    if (total > 1 && format === 'feed') setFormat('carrusel')
    else if (total === 1 && ok[0].type === 'video' && format === 'feed') setFormat('reel')
  }
  const move = (i: number, dir: -1 | 1) =>
    setItems((xs) => {
      const j = i + dir
      if (j < 0 || j >= xs.length) return xs
      const c = [...xs]
      ;[c[i], c[j]] = [c[j], c[i]]
      return c
    })
  const remove = (key: string) =>
    setItems((xs) => {
      const it = xs.find((x) => x.key === key)
      if (it?.kind === 'new') URL.revokeObjectURL(it.preview)
      return xs.filter((x) => x.key !== key)
    })

  async function save() {
    if (!clientId) return setError('Elegí el cliente.')
    if (date && !time) return setError('Poné la hora de publicación.')
    if (!date && ['programado', 'publicado'].includes(status)) return setError(`Para marcarla como ${statusLabel[status].toLowerCase()} tiene que tener fecha y hora.`)
    if (status === 'programado' && !items.length) return setError('Para programarla tiene que tener al menos un archivo.')
    if (status !== 'idea' && !caption.trim() && !items.length) return setError('Escribí el copy o subí un archivo.')
    setError(null)
    try {
      setSaving('Guardando…')
      const input = {
        client_id: clientId,
        format,
        scheduled_at: date ? toIso(date, time) : null,
        caption: caption.trim() || null,
        hashtags: hashtags.trim() || null,
        status,
      }
      const id = await savePost(input, post?.id, post ? undefined : crypto.randomUUID())

      // Archivos quitados
      const keep = new Set(items.filter((i) => i.kind === 'existing').map((i) => i.key))
      for (const m of post?.media ?? []) if (!keep.has(m.id)) await removeMedia(m)

      // Archivos nuevos y orden final
      const ids: string[] = []
      let n = 0
      const total = items.filter((i) => i.kind === 'new').length
      for (const [pos, it] of items.entries()) {
        if (it.kind === 'existing') ids.push(it.media.id)
        else {
          n++
          setSaving(total > 1 ? `Subiendo archivo ${n} de ${total}…` : 'Subiendo archivo…')
          ids.push((await addMedia({ id, client_id: clientId }, it.file, pos)).id)
        }
      }
      const before = (post?.media ?? []).map((m) => m.id).join()
      if (ids.join() !== before) await reorderMedia(ids)

      invalidateContent(qc)
      toast.success(post ? 'Publicación guardada.' : 'Publicación creada.')
      onClose()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setSaving(null)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }

  return (
    <>
      <div className="border-b px-6 pb-4 pt-5 pr-14">
        <SheetTitle className="text-xl font-semibold">{post ? 'Editar publicación' : 'Nueva publicación'}</SheetTitle>
        <SheetDescription className="mt-1 text-sm text-muted-foreground">
          {post ? `Creada ${timeAgo(post.created_at)}${post.published_at ? ` · publicada el ${formatDateTime(post.published_at)}` : ''}` : 'Cargá el contenido, la fecha y el estado. Después podés mandarla a aprobar.'}
        </SheetDescription>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
        {/* Respuesta del cliente */}
        {myDecision && (
          <div className={cn('flex gap-3 rounded-lg border p-3 text-sm', myDecision.decision === 'cambios' ? 'border-warning/40 bg-warning/8' : 'border-success/40 bg-success/8')}>
            {myDecision.decision === 'cambios' ? <MessageSquareWarning className="mt-0.5 size-4 shrink-0 text-warning" /> : <ThumbsUp className="mt-0.5 size-4 shrink-0 text-success" />}
            <div className="min-w-0">
              <p className="font-medium">
                {myDecision.decision === 'cambios' ? `${post!.client_name} pidió cambios` : `${post!.client_name} la aprobó`}
                <span className="font-normal text-muted-foreground"> · {timeAgo(latest!.decided_at!)}</span>
              </p>
              {myDecision.comment && <p className="mt-1 whitespace-pre-wrap">“{myDecision.comment}”</p>}
              {latest!.client_comment && <p className="mt-1 text-muted-foreground">Comentario general: “{latest!.client_comment}”</p>}
            </div>
          </div>
        )}
        {latest && !latest.decided_at && post?.status === 'en_aprobacion' && (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">Esperando la respuesta del cliente. Link enviado {timeAgo(latest.created_at)}.</p>
        )}
        {post?.status === 'error' && post.error_message && (
          <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">No se pudo publicar: {post.error_message}</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="post-client">Cliente *</Label>
            <Select value={clientId} onValueChange={setClientId} disabled={locked || (!!post && items.some((i) => i.kind === 'existing'))}>
              <SelectTrigger id="post-client"><SelectValue placeholder="Elegí un cliente" /></SelectTrigger>
              <SelectContent>{clients?.filter((c) => c.status !== 'finalizado' || c.id === clientId).map((c) => <SelectItem key={c.id} value={c.id}>{c.brand_name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="post-status">Estado</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as PostStatus)} disabled={locked}>
              <SelectTrigger id="post-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.filter((s) => s !== 'error' || status === 'error').map((s) => <SelectItem key={s} value={s}>{statusLabel[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Formato</Label>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Formato">
            {FORMATS.map((f) => {
              const Icon = formatIcon[f]
              return (
                <button
                  key={f}
                  type="button"
                  role="radio"
                  aria-checked={format === f}
                  disabled={locked}
                  onClick={() => setFormat(f)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors',
                    format === f ? 'border-brand bg-brand/8 text-brand' : 'text-muted-foreground hover:border-foreground/30 hover:text-foreground',
                  )}
                >
                  <Icon className="size-4" />
                  {formatLabel[f]}
                </button>
              )
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="post-date">Fecha</Label>
            <Input id="post-date" type="date" value={date} min={post ? undefined : todayMvd()} onChange={(e) => setDate(e.target.value)} disabled={locked} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="post-time">Hora</Label>
            <Input id="post-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={locked || !date} />
          </div>
          <p className="col-span-2 -mt-2 text-xs text-muted-foreground">
            {date ? (
              <>
                Hora de Montevideo.{' '}
                <button type="button" className="text-brand hover:underline" onClick={() => setDate('')} disabled={locked}>Quitar fecha</button>
              </>
            ) : (
              'Sin fecha queda como idea, en la bandeja de ideas del calendario.'
            )}
          </p>
        </div>

        {/* Archivos */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label>Archivos</Label>
            <span className="text-xs text-muted-foreground">Imágenes o videos · hasta {MAX_MB} MB cada uno</span>
          </div>
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={cn('rounded-lg border-2 border-dashed p-3 transition-colors', dragOver ? 'border-brand bg-brand/5' : 'border-border')}
          >
            {items.length > 0 && (
              <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {items.map((it, i) => {
                  const src = it.kind === 'new' ? it.preview : urls[it.media.storage_path]
                  return (
                    <div key={it.key} className={cn('group relative overflow-hidden rounded-md bg-muted', vertical ? 'aspect-[9/16]' : 'aspect-[4/5]')}>
                      {src ? (
                        it.type === 'video' && !src.startsWith('data:image') ? <video src={src} muted playsInline preload="metadata" className="size-full object-cover" /> : <img src={src} alt="" className="size-full object-cover" />
                      ) : (
                        <Skeleton className="size-full" />
                      )}
                      <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white tabular-nums">{i + 1}</span>
                      {it.kind === 'new' && <span className="absolute bottom-1 left-1 rounded bg-brand px-1.5 text-[10px] font-semibold text-white">Nuevo</span>}
                      {!locked && (
                        <div className="absolute inset-x-0 bottom-0 flex justify-end gap-0.5 bg-gradient-to-t from-black/60 to-transparent p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                          <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded bg-white/90 p-0.5 text-black disabled:opacity-40" aria-label="Mover antes"><ChevronLeft className="size-3.5" /></button>
                          <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="rounded bg-white/90 p-0.5 text-black disabled:opacity-40" aria-label="Mover después"><ChevronRight className="size-3.5" /></button>
                          <button type="button" onClick={() => remove(it.key)} className="rounded bg-white/90 p-0.5 text-destructive" aria-label="Quitar archivo"><X className="size-3.5" /></button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            {!locked && (
              <button type="button" onClick={() => fileInput.current?.click()} className="flex w-full flex-col items-center gap-1 rounded-md py-4 text-sm text-muted-foreground hover:text-foreground">
                <Upload className="size-5" />
                <span><strong className="text-brand">Subí archivos</strong> o arrastralos acá</span>
              </button>
            )}
            <input ref={fileInput} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => e.target.files && (addFiles(e.target.files), (e.target.value = ''))} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="post-caption">Copy</Label>
            <span className={cn('text-xs tabular-nums text-muted-foreground', caption.length > 2200 && 'text-destructive')}>{caption.length.toLocaleString('es-UY')} / 2.200</span>
          </div>
          <Textarea id="post-caption" value={caption} onChange={(e) => setCaption(e.target.value)} rows={6} placeholder="El texto que acompaña la publicación…" disabled={locked} />
        </div>
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="post-tags">Hashtags</Label>
            <span className="text-xs tabular-nums text-muted-foreground">{(hashtags.match(/#[\p{L}\p{N}_]+/gu) ?? []).length} / 30</span>
          </div>
          <Input id="post-tags" value={hashtags} onChange={(e) => setHashtags(e.target.value)} placeholder="#montevideo #cafe" disabled={locked} />
        </div>

        {warnings.length > 0 && (
          <ul className="space-y-1 rounded-lg bg-warning/8 px-3 py-2 text-sm text-warning">
            {warnings.map((w) => (
              <li key={w} className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{w}</li>
            ))}
          </ul>
        )}
        {status === 'programado' && (
          <p className="text-xs text-muted-foreground">La publicación automática en Instagram se activa en la Fase 6. Hasta entonces, “Programado” sirve para organizarte.</p>
        )}
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t px-6 py-4">
        {post && (
          <>
            <Button variant="ghost" size="icon" onClick={() => setDeleting(true)} aria-label="Borrar publicación" className="text-destructive hover:text-destructive"><Trash2 /></Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Duplicar"
              title="Duplicar como borrador"
              onClick={async () => {
                try {
                  await duplicatePost(post)
                  invalidateContent(qc)
                  toast.success('Copia creada como borrador, en la bandeja de ideas.')
                } catch (e) {
                  toast.error(friendlyError(e))
                }
              }}
            >
              <Copy />
            </Button>
            {onRequestApproval && !locked && (
              <Button variant="outline" onClick={() => onRequestApproval(post.client_id, [post.id])} disabled={!!saving}>
                <Send /> <span className="hidden sm:inline">Pedir aprobación</span>
              </Button>
            )}
          </>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={!!saving}>{locked ? 'Cerrar' : 'Cancelar'}</Button>
          {!locked && (
            <Button onClick={() => void save()} disabled={!!saving}>
              {saving && <LoaderCircle className="animate-spin" />}
              {saving ?? (post ? 'Guardar' : 'Crear publicación')}
            </Button>
          )}
        </div>
      </div>

      {post && (
        <ConfirmDialog
          open={deleting}
          onOpenChange={setDeleting}
          title="¿Borrar esta publicación?"
          description={`Sale del calendario de ${client?.brand_name ?? 'este cliente'}.`}
          confirmLabel="Borrar"
          destructive
          onConfirm={async () => {
            try {
              await deletePost(post.id)
              invalidateContent(qc)
              toast.success('Publicación borrada.')
              onClose()
            } catch (e) {
              toast.error(friendlyError(e))
            }
          }}
        />
      )}
    </>
  )
}
