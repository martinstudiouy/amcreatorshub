import { useQuery } from '@tanstack/react-query'
import { Grid3x3 } from 'lucide-react'
import { useState } from 'react'
import { BrandMark } from '@/components/common/client-chip'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { listGridPosts, type Post } from '@/data/content'
import type { ClientOverview } from '@/data/crm'
import { cn } from '@/lib/utils'
import { localDate } from '@/features/agenda/dates'
import { PostStatusBadge, PostThumb, useMediaUrls } from './post-ui'

/** Vista previa del perfil de Instagram del cliente: cómo queda el feed con lo planificado. */
export function GridView({ client, onOpen }: { client: ClientOverview | undefined; onOpen: (p: Post) => void }) {
  const [onlyApproved, setOnlyApproved] = useState(false)
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['grid-posts', client?.id], queryFn: () => listGridPosts(client!.id), enabled: !!client })
  const posts = (data ?? []).filter((p) => !onlyApproved || ['aprobado', 'programado', 'publicado'].includes(p.status))
  const urls = useMediaUrls(posts)

  if (!client)
    return (
      <Card>
        <EmptyState icon={Grid3x3} title="Elegí un cliente" description="La grilla muestra cómo va a quedar el feed de Instagram de una marca. Elegí el cliente en el filtro de arriba." />
      </Card>
    )
  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />

  const published = (data ?? []).filter((p) => p.status === 'publicado').length
  return (
    <div className="mx-auto max-w-[540px]">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-4 p-5">
          <span className="rounded-full bg-gradient-to-tr from-[#0300FF] to-black p-[3px]">
            <span className="block rounded-full bg-card p-[2px]"><BrandMark name={client.brand_name} color={client.color_tag} className="size-16 rounded-full text-2xl" /></span>
          </span>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{client.instagram_handle ? `@${client.instagram_handle}` : client.brand_name}</p>
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{published}</strong> publicadas · <strong className="text-foreground">{(data ?? []).length - published}</strong> planificadas
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 border-t px-5 py-2.5">
          <Checkbox id="grid-approved" checked={onlyApproved} onCheckedChange={(v) => setOnlyApproved(v === true)} />
          <Label htmlFor="grid-approved" className="text-sm font-normal">Mostrar solo lo aprobado</Label>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-3 gap-0.5">{Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-none" />)}</div>
        ) : !posts.length ? (
          <EmptyState compact icon={Grid3x3} title="Todavía no hay publicaciones con fecha" description="Las publicaciones de feed, carrusel y reel con fecha aparecen acá, la más nueva primero." />
        ) : (
          <div className="grid grid-cols-3 gap-0.5 bg-border">
            {posts.map((p) => {
              const future = p.status !== 'publicado'
              return (
                <button key={p.id} onClick={() => onOpen(p)} className="group relative bg-card text-left focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-brand" title={p.caption ?? ''}>
                  <PostThumb post={p} urls={urls} className={cn('aspect-[3/4] w-full transition-opacity group-hover:opacity-90', future && !['aprobado', 'programado'].includes(p.status) && 'opacity-75')} />
                  {future && (
                    <span className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1">
                      <PostStatusBadge status={p.status} className="px-1.5 py-0 text-[10px] shadow" />
                      <span className="rounded bg-black/60 px-1 text-[10px] font-medium text-white tabular-nums">{localDate(p.scheduled_at!).slice(8)}/{localDate(p.scheduled_at!).slice(5, 7)}</span>
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </Card>
      <p className="mt-3 text-center text-xs text-muted-foreground">Las stories no van a la grilla. Instagram recorta las miniaturas en 3:4.</p>
    </div>
  )
}
