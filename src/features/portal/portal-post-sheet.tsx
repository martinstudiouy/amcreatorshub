import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, ExternalLink, LoaderCircle, MessageSquareWarning, PencilLine, ThumbsUp } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { friendlyError } from '@/data/api'
import { approvalsForPost, type Decision, type Post } from '@/data/content'
import { decidePost } from '@/data/portal'
import { formatDateTime, timeAgo } from '@/lib/format'
import { MediaCarousel } from '@/features/content/approval-page'
import { FormatIcon, PostStatusBadge, formatLabel, invalidateContent, useMediaUrls } from '@/features/content/post-ui'

/** Detalle de una publicación en el portal, con aprobar o pedir cambios. */
export function PortalPostSheet({ post, onClose }: { post: Post | null; onClose: () => void }) {
  return (
    <Sheet open={!!post} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="sm:max-w-lg" aria-describedby={undefined}>{post && <Body key={post.id} post={post} onClose={onClose} />}</SheetContent>
    </Sheet>
  )
}

function Body({ post, onClose }: { post: Post; onClose: () => void }) {
  const qc = useQueryClient()
  const urls = useMediaUrls([post])
  const [mode, setMode] = useState<'ver' | 'cambios'>('ver')
  const [comment, setComment] = useState('')
  const { data: approvals } = useQuery({ queryKey: ['approvals-post', post.id], queryFn: () => approvalsForPost(post.id) })
  const last = approvals?.find((a) => a.decided_at)
  const lastDecision = last ? (last.decisions as Record<string, Decision>)[post.id] : undefined

  const decide = useMutation({
    mutationFn: (d: 'aprobado' | 'cambios') => decidePost(post.id, d, comment),
    onSuccess: (_r, d) => {
      toast.success(d === 'aprobado' ? '¡Gracias! La publicación quedó aprobada.' : 'Gracias, le pasamos tus comentarios al equipo.')
      invalidateContent(qc)
      onClose()
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const vertical = post.format === 'reel' || post.format === 'story'
  const media = post.media.map((m) => ({ media_type: m.media_type, url: urls[m.storage_path] ?? null, cover_url: null, width: m.width, height: m.height }))
  const pending = post.status === 'en_aprobacion'

  return (
    <>
      <div className="border-b px-5 pb-4 pt-5 pr-14">
        <SheetTitle className="flex items-center gap-2 text-lg font-semibold"><FormatIcon format={post.format} className="size-4" /> {formatLabel[post.format]}</SheetTitle>
        <SheetDescription className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <PostStatusBadge status={post.status} />
          {post.scheduled_at && <span className="inline-flex items-center gap-1"><CalendarClock className="size-3.5" /> {formatDateTime(post.scheduled_at)}</span>}
        </SheetDescription>
      </div>
      <div className="flex-1 overflow-y-auto">
        {media.length ? (
          <div className={vertical ? 'mx-auto max-w-xs' : ''}>
            <MediaCarousel media={media} vertical={vertical} />
          </div>
        ) : (
          <p className="bg-muted px-5 py-10 text-center text-sm text-muted-foreground">Todavía sin imagen.</p>
        )}
        <div className="space-y-2 px-5 py-4">
          {post.caption ? <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{post.caption}</p> : <p className="text-sm text-muted-foreground">Sin texto.</p>}
          {post.hashtags && <p className="text-sm text-brand">{post.hashtags}</p>}
          {post.status === 'publicado' && post.ig_permalink && (
            <a href={post.ig_permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
              Ver en Instagram <ExternalLink className="size-3.5" />
            </a>
          )}
          {lastDecision && (
            <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
              {lastDecision.decision === 'cambios' ? <MessageSquareWarning className="mt-0.5 size-4 shrink-0 text-warning" /> : <ThumbsUp className="mt-0.5 size-4 shrink-0 text-success" />}
              <span>{lastDecision.decision === 'cambios' ? `Pediste cambios ${timeAgo(last!.decided_at!)}: “${lastDecision.comment}”` : `La aprobaste ${timeAgo(last!.decided_at!)}.`}</span>
            </p>
          )}
        </div>
      </div>
      {pending && (
        <div className="space-y-3 border-t px-5 py-4">
          {mode === 'cambios' ? (
            <>
              <Textarea autoFocus rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="¿Qué cambiarías? Por ejemplo: otra foto, cambiar el precio, sacar un hashtag…" aria-label="Qué cambiarías" />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setMode('ver')}>Volver</Button>
                <Button onClick={() => decide.mutate('cambios')} disabled={!comment.trim() || decide.isPending}>
                  {decide.isPending && <LoaderCircle className="animate-spin" />} Enviar comentarios
                </Button>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-11" onClick={() => setMode('cambios')}><PencilLine /> Pedir cambios</Button>
              <Button className="h-11" onClick={() => decide.mutate('aprobado')} disabled={decide.isPending}>
                {decide.isPending ? <LoaderCircle className="animate-spin" /> : <ThumbsUp />} Aprobar
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
