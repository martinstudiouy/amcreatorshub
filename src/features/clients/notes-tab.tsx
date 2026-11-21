import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { NotebookPen, Pin, PinOff, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { friendlyError } from '@/data/api'
import { addNote, deleteNote, listNotes, updateNote } from '@/data/crm'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

export function NotesTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient()
  const key = ['notes', clientId]
  const { data, isLoading, error, refetch } = useQuery({ queryKey: key, queryFn: () => listNotes(clientId) })
  const [body, setBody] = useState('')
  const refresh = () => qc.invalidateQueries({ queryKey: key })
  const onErr = (e: unknown) => toast.error(friendlyError(e))

  const add = useMutation({ mutationFn: () => addNote(clientId, body.trim()), onSuccess: () => { setBody(''); void refresh() }, onError: onErr })
  const pin = useMutation({ mutationFn: (n: { id: string; is_pinned: boolean }) => updateNote(n.id, { is_pinned: !n.is_pinned }), onSuccess: refresh, onError: onErr })
  const del = useMutation({ mutationFn: deleteNote, onSuccess: refresh, onError: onErr })

  return (
    <div className="max-w-3xl space-y-4">
      <Card className="p-4">
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (body.trim()) add.mutate()
          }}
          className="space-y-3"
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Preferencias del cliente, acuerdos, datos para recordar…"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && body.trim()) add.mutate()
            }}
            aria-label="Nueva nota"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Ctrl + Enter para guardar</span>
            <Button type="submit" size="sm" disabled={!body.trim() || add.isPending}>Guardar nota</Button>
          </div>
        </form>
      </Card>
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-24" />
      ) : !data?.length ? (
        <EmptyState compact icon={NotebookPen} title="Sin notas" description="Lo que anotes acá lo ve todo el equipo." />
      ) : (
        data.map((n) => (
          <Card key={n.id} className={cn('group p-4', n.is_pinned && 'border-primary/40 bg-accent/30')}>
            <p className="whitespace-pre-wrap text-sm">{n.body}</p>
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              {n.is_pinned && <Pin className="size-3.5 text-brand" />}
              <span>{[n.author_name, timeAgo(n.created_at)].filter(Boolean).join(' · ')}</span>
              <span className="ml-auto flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => pin.mutate(n)}>
                  {n.is_pinned ? <PinOff /> : <Pin />} {n.is_pinned ? 'Desfijar' : 'Fijar'}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => del.mutate(n.id)} aria-label="Borrar nota">
                  <Trash2 />
                </Button>
              </span>
            </div>
          </Card>
        ))
      )}
    </div>
  )
}
