import { useMutation, useQuery } from '@tanstack/react-query'
import { CalendarClock, Check, CheckCircle2, Clock, LoaderCircle, MessageSquareWarning, PencilLine, ThumbsUp } from 'lucide-react'
import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { BrandMark } from '@/components/common/client-chip'
import { Wordmark } from '@/components/layout/wordmark'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { ApprovalLinkError, getPublicApproval, submitPublicApproval, type Decision, type PublicApproval } from '@/data/content'
import { formatDate, formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { FormatIcon, formatLabel } from './post-ui'

/** Página pública (sin login) donde el cliente aprueba o pide cambios. */
export function ApprovalPage() {
  const { token = '' } = useParams()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['public-approval', token], queryFn: () => getPublicApproval(token), retry: false, refetchOnWindowFocus: false })

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4">
          <Wordmark />
          <span className="text-xs text-muted-foreground">Aprobación de contenido</span>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 pb-40 pt-6">
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20" />
            <Skeleton className="aspect-[4/5]" />
          </div>
        ) : error ? (
          <LinkProblem error={error} onRetry={() => void refetch()} />
        ) : data ? (
          <ApprovalForm token={token} data={data} onDone={() => void refetch()} />
        ) : null}
      </main>
    </div>
  )
}

function LinkProblem({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const known = error instanceof ApprovalLinkError
  return (
    <div className="rounded-xl border bg-card p-8 text-center shadow-soft">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted"><Clock className="size-6 text-muted-foreground" /></span>
      <h1 className="mt-4 text-xl font-bold">{known ? (error.reason === 'vencido' ? 'Este link venció' : 'Este link no funciona') : 'No pudimos cargar el contenido'}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {known
          ? 'Pedile al equipo de AM Creators que te mande un link nuevo.'
          : error instanceof Error
            ? error.message
            : 'Probá de nuevo en un rato.'}
      </p>
      {!known && <Button className="mt-5" variant="outline" onClick={onRetry}>Reintentar</Button>}
    </div>
  )
}

function ApprovalForm({ token, data, onDone }: { token: string; data: PublicApproval; onDone: () => void }) {
  const decided = !!data.decided_at
  const [decisions, setDecisions] = useState<Record<string, Decision>>(decided ? data.decisions : {})
  const [comment, setComment] = useState(data.client_comment ?? '')
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const refs = useRef<Record<string, HTMLElement | null>>({})

  const answered = data.posts.filter((p) => {
    const d = decisions[p.id]
    return d && (d.decision === 'aprobado' || d.comment?.trim())
  }).length
  const total = data.posts.length

  const submit = useMutation({
    mutationFn: () => submitPublicApproval(token, decisions, comment),
    onSuccess: () => {
      setSent(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    onError: (e) => setFormError(e instanceof Error ? e.message : 'No se pudo enviar. Probá de nuevo.'),
  })

  function trySubmit() {
    const missing = data.posts.find((p) => {
      const d = decisions[p.id]
      return !d || (d.decision === 'cambios' && !d.comment?.trim())
    })
    if (missing) {
      setFormError(decisions[missing.id] ? 'Contanos qué cambiarías en la publicación marcada.' : 'Te falta responder alguna publicación.')
      refs.current[missing.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setFormError(null)
    submit.mutate()
  }

  if (sent) {
    const changes = Object.values(decisions).filter((d) => d.decision === 'cambios').length
    return (
      <div className="rounded-xl border bg-card p-8 text-center shadow-soft">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand text-white"><Check className="size-7" /></span>
        <h1 className="mt-4 text-2xl font-bold">¡Gracias!</h1>
        <p className="mt-2 text-muted-foreground">
          {changes === 0
            ? 'Aprobaste todo. Nos ponemos a programarlo.'
            : `Recibimos tus comentarios en ${changes} publicaci${changes === 1 ? 'ón' : 'ones'}. Te mandamos la versión nueva apenas la tengamos.`}
        </p>
        <Button className="mt-6" variant="outline" onClick={onDone}>Ver lo que respondí</Button>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-3">
        <BrandMark name={data.client.brand_name} color={data.client.color_tag} className="size-12 rounded-full text-lg" />
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{data.client.brand_name}</h1>
          <p className="text-sm text-muted-foreground">
            {total} publicaci{total === 1 ? 'ón' : 'ones'} para revisar
            {!decided && ` · link válido hasta el ${formatDate(data.expires_at)}`}
          </p>
        </div>
      </div>

      {decided ? (
        <p className="mt-5 flex items-center gap-2 rounded-lg bg-success/10 px-4 py-3 text-sm text-success">
          <CheckCircle2 className="size-4 shrink-0" /> Ya respondiste el {formatDateTime(data.decided_at!)}. ¡Gracias!
        </p>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">
          Mirá cada publicación y tocá <strong className="text-foreground">Aprobar</strong> o <strong className="text-foreground">Pedir cambios</strong>. Al final, enviá tu respuesta.
        </p>
      )}

      <div className="mt-6 space-y-8">
        {data.posts.map((p, i) => {
          const d = decisions[p.id]
          const set = (patch: Partial<Decision>) => setDecisions((x) => ({ ...x, [p.id]: { ...x[p.id], ...patch } as Decision }))
          return (
            <article
              key={p.id}
              ref={(el) => {
                refs.current[p.id] = el
              }}
              className={cn('overflow-hidden rounded-xl border bg-card shadow-soft transition-shadow', d?.decision === 'aprobado' && 'ring-2 ring-brand', d?.decision === 'cambios' && 'ring-2 ring-warning')}
            >
              <div className="flex items-center gap-2 px-4 py-3 text-sm">
                <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums">{i + 1}</span>
                <span className="inline-flex items-center gap-1 font-medium"><FormatIcon format={p.format} className="size-4" /> {formatLabel[p.format]}</span>
                {p.scheduled_at && (
                  <span className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="size-3.5" /> {formatDateTime(p.scheduled_at)}</span>
                )}
              </div>
              <MediaCarousel media={p.media} vertical={p.format === 'reel' || p.format === 'story'} />
              <div className="space-y-2 px-4 py-4">
                {p.caption ? <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{p.caption}</p> : <p className="text-sm text-muted-foreground">Sin texto.</p>}
                {p.hashtags && <p className="text-sm text-brand">{p.hashtags}</p>}
              </div>
              <div className="border-t bg-muted/30 px-4 py-4">
                {decided ? (
                  <p className={cn('flex items-start gap-2 text-sm', d?.decision === 'cambios' ? 'text-warning' : 'text-success')}>
                    {d?.decision === 'cambios' ? <MessageSquareWarning className="mt-0.5 size-4 shrink-0" /> : <ThumbsUp className="mt-0.5 size-4 shrink-0" />}
                    <span>{d?.decision === 'cambios' ? `Pediste cambios: “${d.comment}”` : 'Aprobada'}</span>
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant={d?.decision === 'aprobado' ? 'default' : 'outline'} className="h-11" onClick={() => set({ decision: 'aprobado' })} aria-pressed={d?.decision === 'aprobado'}>
                        <ThumbsUp /> Aprobar
                      </Button>
                      <Button
                        variant="outline"
                        className={cn('h-11', d?.decision === 'cambios' && 'border-warning bg-warning/10 text-warning hover:bg-warning/15 hover:text-warning')}
                        onClick={() => set({ decision: 'cambios' })}
                        aria-pressed={d?.decision === 'cambios'}
                      >
                        <PencilLine /> Pedir cambios
                      </Button>
                    </div>
                    {d?.decision === 'cambios' && (
                      <Textarea
                        autoFocus
                        className="mt-3 bg-card"
                        rows={3}
                        value={d.comment ?? ''}
                        onChange={(e) => set({ comment: e.target.value })}
                        placeholder="¿Qué cambiarías? Por ejemplo: otra foto, cambiar el precio, sacar un hashtag…"
                        aria-label={`Cambios para la publicación ${i + 1}`}
                      />
                    )}
                  </>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {!decided && (
        <>
          <div className="mt-8">
            <label htmlFor="ap-comment" className="text-sm font-medium">Comentario general (opcional)</label>
            <Textarea id="ap-comment" className="mt-2" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Algo más que nos quieras decir…" />
          </div>
          <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 backdrop-blur">
            <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium tabular-nums">{answered} de {total} respondidas</p>
                <div className="mt-1 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-brand transition-[width]" style={{ width: `${(answered / total) * 100}%` }} /></div>
                {formError && <p className="mt-1 text-xs text-destructive">{formError}</p>}
              </div>
              <Button className="h-11 px-5" onClick={trySubmit} disabled={submit.isPending}>
                {submit.isPending && <LoaderCircle className="animate-spin" />}
                Enviar respuesta
              </Button>
            </div>
          </div>
        </>
      )}
      {decided && data.client_comment && <p className="mt-8 rounded-lg bg-muted px-4 py-3 text-sm">Tu comentario: “{data.client_comment}”</p>}
    </>
  )
}

/** Imágenes y videos deslizables, con puntitos como en Instagram. */
export function MediaCarousel({ media, vertical }: { media: PublicApproval['posts'][number]['media']; vertical: boolean }) {
  const [index, setIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  if (!media.length) return <div className="flex aspect-[4/5] items-center justify-center bg-muted text-sm text-muted-foreground">Sin imagen</div>
  return (
    <div className="relative bg-black">
      <div
        ref={ref}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className={cn('flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', vertical ? 'aspect-[9/16] max-h-[80vh]' : 'aspect-[4/5]')}
      >
        {media.map((m, i) => (
          <div key={i} className="flex size-full shrink-0 snap-center items-center justify-center">
            {!m.url ? (
              <span className="text-sm text-white/70">No se pudo cargar el archivo</span>
            ) : m.media_type === 'video' && !m.url.startsWith('data:image') ? (
              <video src={m.url} poster={m.cover_url ?? undefined} controls playsInline preload="metadata" className="size-full object-contain" />
            ) : (
              <img src={m.url} alt={`Imagen ${i + 1}`} className="size-full object-contain" />
            )}
          </div>
        ))}
      </div>
      {media.length > 1 && (
        <>
          <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white tabular-nums">{index + 1}/{media.length}</span>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {media.map((_, i) => (
              <button
                key={i}
                onClick={() => ref.current?.scrollTo({ left: i * ref.current.clientWidth, behavior: 'smooth' })}
                className={cn('size-1.5 rounded-full transition-colors', i === index ? 'bg-white' : 'bg-white/50')}
                aria-label={`Ver ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
