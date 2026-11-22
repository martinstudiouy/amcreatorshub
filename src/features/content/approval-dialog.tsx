import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, ExternalLink, LoaderCircle, MessageCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { friendlyError } from '@/data/api'
import { isDemo } from '@/lib/supabase'
import { approvalUrl, createApproval, listPosts } from '@/data/content'
import { listClients } from '@/data/crm'
import { formatDateTime, todayMvd } from '@/lib/format'
import { addDays } from '@/lib/format'
import { toIso } from '@/features/agenda/dates'
import { FormatIcon, PostStatusBadge, PostThumb, invalidateContent, useMediaUrls } from './post-ui'

/** Elegir publicaciones de un cliente y generar el link para que las apruebe sin login. */
export function ApprovalDialog({ open, onOpenChange, clientId: initialClient, postIds: initialPosts }: { open: boolean; onOpenChange: (o: boolean) => void; clientId?: string; postIds?: string[] }) {
  const qc = useQueryClient()
  const [clientId, setClientId] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [link, setLink] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    setClientId(initialClient ?? '')
    setSelected(new Set(initialPosts ?? []))
    setLink(null)
  }, [open, initialClient, initialPosts])

  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: listClients, enabled: open })
  const range = useMemo(() => ({ from: toIso(addDays(todayMvd(), -7), '00:00'), to: toIso(addDays(todayMvd(), 120), '00:00') }), [])
  const { data: posts, isLoading } = useQuery({
    queryKey: ['posts', 'approval', clientId, range],
    queryFn: () => listPosts({ ...range, clientId }),
    enabled: open && !!clientId,
  })
  // Lo que tiene sentido mandar a aprobar: lo que no está publicado
  const options = (posts ?? []).filter((p) => !['publicado', 'error'].includes(p.status) || selected.has(p.id))
  const urls = useMediaUrls(options)
  const client = clients?.find((c) => c.id === clientId)

  // Al elegir cliente nuevo, preseleccionamos borradores e ideas con fecha
  useEffect(() => {
    if (!posts || initialPosts?.length) return
    setSelected(new Set(posts.filter((p) => p.scheduled_at && ['borrador', 'idea'].includes(p.status)).map((p) => p.id)))
  }, [posts]) // eslint-disable-line react-hooks/exhaustive-deps

  const create = useMutation({
    mutationFn: () => createApproval(clientId, options.filter((p) => selected.has(p.id)).map((p) => p.id)),
    onSuccess: (token) => {
      setLink(approvalUrl(token))
      invalidateContent(qc)
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  const message = link && client ? `¡Hola ${client.name?.split(' ')[0] ?? ''}! Te paso el contenido de ${client.brand_name} para que lo revises. Podés aprobar cada publicación o pedir cambios desde este link: ${link}` : ''
  const wa = client?.whatsapp ? `https://wa.me/${client.whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[5vh] max-h-[90vh] max-w-2xl overflow-y-auto">
        {link ? (
          <>
            <DialogTitle className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-full bg-success/15 text-success"><Check className="size-4" /></span> Link listo</DialogTitle>
            <DialogDescription className="mt-2">
              Mandáselo a {client?.brand_name}. Puede aprobar o pedir cambios sin crear una cuenta. El link vence en 14 días y se puede responder una sola vez.
            </DialogDescription>
            <div className="mt-5 flex gap-2">
              <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="h-10 min-w-0 flex-1 rounded-lg border bg-muted/50 px-3 text-sm" aria-label="Link de aprobación" />
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(link).then(() => toast.success('Link copiado.'))
                }}
              >
                <Copy /> Copiar
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {isDemo ? (
                <Button variant="outline" onClick={() => navigate(`/aprobar/${link.split('/aprobar/')[1]}`)}><ExternalLink /> Ver como el cliente</Button>
              ) : (
                <Button variant="outline" asChild>
                  <a href={link} target="_blank" rel="noreferrer"><ExternalLink /> Ver como el cliente</a>
                </Button>
              )}
              <Button asChild>
                <a href={wa} target="_blank" rel="noreferrer"><MessageCircle /> Mandar por WhatsApp</a>
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogTitle>Pedir aprobación</DialogTitle>
            <DialogDescription className="mt-1">Elegí qué publicaciones querés que vea el cliente. Pasan a “En aprobación” y te avisamos cuando responda.</DialogDescription>
            <div className="mt-5 space-y-2">
              <Label htmlFor="ap-client">Cliente</Label>
              <Select value={clientId} onValueChange={(v) => { setClientId(v); setSelected(new Set()) }}>
                <SelectTrigger id="ap-client"><SelectValue placeholder="Elegí un cliente" /></SelectTrigger>
                <SelectContent>{clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.brand_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {clientId && (
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium">Publicaciones</span>
                  {options.length > 0 && (
                    <button className="text-brand hover:underline" onClick={() => setSelected(selected.size === options.length ? new Set() : new Set(options.map((p) => p.id)))}>
                      {selected.size === options.length ? 'Quitar todas' : 'Elegir todas'}
                    </button>
                  )}
                </div>
                {isLoading ? (
                  <Skeleton className="h-40" />
                ) : !options.length ? (
                  <p className="rounded-lg bg-muted px-3 py-6 text-center text-sm text-muted-foreground">Este cliente no tiene publicaciones para aprobar en los próximos meses.</p>
                ) : (
                  <ul className="max-h-[45vh] divide-y overflow-y-auto rounded-lg border">
                    {options.map((p) => (
                      <li key={p.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50">
                          <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} />
                          <PostThumb post={p} urls={urls} className="size-11 shrink-0 rounded-md" showIcons={false} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">{p.caption || 'Sin copy'}</span>
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                              <FormatIcon format={p.format} /> {p.scheduled_at ? formatDateTime(p.scheduled_at) : 'Sin fecha'}
                            </span>
                          </span>
                          <PostStatusBadge status={p.status} />
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button onClick={() => create.mutate()} disabled={!clientId || !options.some((p) => selected.has(p.id)) || create.isPending}>
                {create.isPending && <LoaderCircle className="animate-spin" />}
                Generar link ({options.filter((p) => selected.has(p.id)).length})
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
