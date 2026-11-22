import { useQuery, type QueryClient } from '@tanstack/react-query'
import { CircleDashed, Clapperboard, Image as ImageIcon, Layers, Play, type LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { mediaUrls, type Media, type Post, type PostFormat, type PostStatus } from '@/data/content'
import { cn } from '@/lib/utils'

export const FORMATS: PostFormat[] = ['feed', 'carrusel', 'reel', 'story']
export const formatLabel: Record<PostFormat, string> = { feed: 'Feed', carrusel: 'Carrusel', reel: 'Reel', story: 'Story' }
export const formatIcon: Record<PostFormat, LucideIcon> = { feed: ImageIcon, carrusel: Layers, reel: Clapperboard, story: CircleDashed }

export const STATUSES: PostStatus[] = ['idea', 'borrador', 'en_aprobacion', 'aprobado', 'programado', 'publicado', 'error']
export const statusLabel: Record<PostStatus, string> = {
  idea: 'Idea', borrador: 'Borrador', en_aprobacion: 'En aprobación', aprobado: 'Aprobado', programado: 'Programado', publicado: 'Publicado', error: 'Error',
}
const statusVariant: Record<PostStatus, 'neutral' | 'default' | 'success' | 'warning' | 'danger'> = {
  idea: 'neutral', borrador: 'neutral', en_aprobacion: 'warning', aprobado: 'default', programado: 'default', publicado: 'success', error: 'danger',
}
/** Color del punto de estado (para chips chicos) */
export const statusDot: Record<PostStatus, string> = {
  idea: 'bg-muted-foreground/40', borrador: 'bg-muted-foreground', en_aprobacion: 'bg-warning', aprobado: 'bg-brand', programado: 'bg-[#020061] dark:bg-[#a5a3ff]', publicado: 'bg-success', error: 'bg-destructive',
}

export function PostStatusBadge({ status, className }: { status: PostStatus; className?: string }) {
  return <Badge variant={statusVariant[status]} className={className}>{statusLabel[status]}</Badge>
}

export function FormatIcon({ format, className }: { format: PostFormat; className?: string }) {
  const Icon = formatIcon[format]
  return <Icon className={cn('size-3.5', className)} aria-label={formatLabel[format]} />
}

export function invalidateContent(qc: QueryClient) {
  for (const k of ['posts', 'grid-posts', 'post', 'approvals-post', 'dashboard']) void qc.invalidateQueries({ queryKey: [k] })
}

/** Links temporales de los archivos de varias publicaciones (se piden juntos). */
export function useMediaUrls(posts: Pick<Post, 'media'>[] | undefined) {
  const paths = [...new Set((posts ?? []).flatMap((p) => p.media.map((m) => m.storage_path)))].sort()
  return useQuery({ queryKey: ['media-urls', paths], queryFn: () => mediaUrls(paths), enabled: paths.length > 0, staleTime: 50 * 60_000 }).data ?? {}
}

/** Es video de verdad (en la demo los "videos" son imágenes de ejemplo). */
export const isVideo = (m: { media_type: string }, url?: string | null) => m.media_type === 'video' && !url?.startsWith('data:image')

/** Miniatura: imagen o primer cuadro del video; si no hay archivos, el color del cliente. */
export function PostThumb({ post, urls, className, showIcons = true }: { post: Post; urls: Record<string, string>; className?: string; showIcons?: boolean }) {
  const first: Media | undefined = post.media[0]
  const url = first ? urls[first.storage_path] : undefined
  const Icon = formatIcon[post.format]
  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {url ? (
        isVideo(first!, url) ? (
          <video src={`${url}#t=0.5`} muted playsInline preload="metadata" className="size-full object-cover" />
        ) : (
          <img src={url} alt="" loading="lazy" className="size-full object-cover" />
        )
      ) : (
        <div className="flex size-full items-center justify-center" style={{ background: `${post.client_color ?? '#64748B'}1f` }}>
          <Icon className="size-6 text-muted-foreground" />
        </div>
      )}
      {showIcons && url && (post.format === 'carrusel' || post.format === 'reel' || first?.media_type === 'video') && (
        <span className="absolute right-1.5 top-1.5 text-white drop-shadow">
          {post.format === 'carrusel' ? <Layers className="size-4" /> : post.format === 'reel' ? <Clapperboard className="size-4" /> : <Play className="size-4" />}
        </span>
      )}
    </div>
  )
}

/** Reglas de Instagram para cada formato: devuelve avisos (no bloquean guardar). */
export function formatWarnings(format: PostFormat, media: { type: 'imagen' | 'video' }[], caption: string, hashtags: string): string[] {
  const w: string[] = []
  const n = media.length
  const videos = media.filter((m) => m.type === 'video').length
  if (format === 'carrusel' && (n < 2 || n > 10)) w.push('Un carrusel lleva de 2 a 10 archivos.')
  if (format === 'reel' && (n !== 1 || videos !== 1)) w.push('Un reel lleva un solo video.')
  if ((format === 'feed' || format === 'story') && n > 1) w.push(`Un ${formatLabel[format].toLowerCase()} lleva un solo archivo. Si son varios, usá Carrusel.`)
  const tags = (`${caption} ${hashtags}`.match(/#[\p{L}\p{N}_]+/gu) ?? []).length
  if (tags > 30) w.push(`Instagram permite hasta 30 hashtags (hay ${tags}).`)
  if (`${caption}\n\n${hashtags}`.trim().length > 2200) w.push('El texto supera los 2.200 caracteres que permite Instagram.')
  return w
}
