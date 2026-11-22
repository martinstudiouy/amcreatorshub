import { useQuery } from '@tanstack/react-query'
import { Grid3x3, Plus, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState } from '@/components/common/error-state'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { listPosts } from '@/data/content'
import { addDays, todayMvd } from '@/lib/format'
import { toIso } from '@/features/agenda/dates'
import { ApprovalDialog } from './approval-dialog'
import { ListView } from './list-view'
import { PostSheet, type PostDraft } from './post-sheet'

/** Pestaña Contenido en la ficha del cliente: lo de las últimas 2 semanas y los próximos 2 meses. */
export function ClientContentTab({ clientId }: { clientId: string }) {
  const range = useMemo(() => ({ from: toIso(addDays(todayMvd(), -14), '00:00'), to: toIso(addDays(todayMvd(), 60), '00:00'), clientId }), [clientId])
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['posts', range], queryFn: () => listPosts(range) })
  const [postId, setPostId] = useState<string | null>(null)
  const [draft, setDraft] = useState<PostDraft | null>(null)
  const [approval, setApproval] = useState<{ postIds?: string[] } | null>(null)

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm text-muted-foreground">Desde hace 2 semanas hasta dentro de 2 meses.</p>
        <Button variant="outline" asChild>
          <Link to={`/contenidos?vista=grilla&cliente=${clientId}`}><Grid3x3 /> Ver grilla</Link>
        </Button>
        <Button variant="outline" onClick={() => setApproval({})}><Send /> Pedir aprobación</Button>
        <Button onClick={() => setDraft({ clientId, date: todayMvd() })}><Plus /> Publicación</Button>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : (
        <ListView posts={data ?? []} hideClient onOpen={(p) => setPostId(p.id)} onCreate={() => setDraft({ clientId, date: todayMvd() })} onApprove={(_, ids) => setApproval({ postIds: ids })} />
      )}
      <PostSheet
        open={!!postId || !!draft}
        postId={postId}
        draft={draft ?? undefined}
        onClose={() => {
          setPostId(null)
          setDraft(null)
        }}
        onRequestApproval={(_, ids) => {
          setPostId(null)
          setApproval({ postIds: ids })
        }}
      />
      <ApprovalDialog open={!!approval} onOpenChange={(o) => !o && setApproval(null)} clientId={clientId} postIds={approval?.postIds} />
    </>
  )
}
