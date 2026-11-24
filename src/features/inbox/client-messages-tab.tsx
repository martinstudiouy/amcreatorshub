import { useQuery } from '@tanstack/react-query'
import { ArrowRight, MessageCircle, MessagesSquare } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { EmptyState } from '@/components/common/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { convTitle, labelText, listConversations, statusText, type Label } from '@/data/messages'
import { timeAgo } from '@/lib/format'
import { ChannelBadge, TemplateDialog } from './inbox-parts'
import { useInboxRealtime } from './inbox-page'

/** Pestaña "Mensajes" en la ficha del cliente. */
export function ClientMessagesTab({ clientId, contactName, whatsapp }: { clientId: string; contactName: string; whatsapp: string | null }) {
  useInboxRealtime()
  const nav = useNavigate()
  const [templateOpen, setTemplateOpen] = useState(false)
  const { data, isLoading } = useQuery({
    queryKey: ['conversations', { clientId }],
    queryFn: () => listConversations({ clientId }),
  })
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <p className="text-sm text-muted-foreground">Conversaciones de WhatsApp e Instagram vinculadas a este cliente.</p>
        <Button size="sm" onClick={() => setTemplateOpen(true)} disabled={!whatsapp} title={whatsapp ? undefined : 'Cargá el WhatsApp del cliente en su ficha'}>
          <MessageCircle /> Mandar WhatsApp
        </Button>
      </div>
      {isLoading ? (
        <div className="space-y-2 p-4">
          <Skeleton className="h-14" />
          <Skeleton className="h-14" />
        </div>
      ) : !data?.length ? (
        <EmptyState
          icon={MessagesSquare}
          title="Sin conversaciones"
          description={whatsapp ? 'Cuando te escriba aparece acá. También podés iniciar una con una plantilla.' : 'Cuando te escriba aparece acá.'}
        />
      ) : (
        <ul className="divide-y">
          {data.map((c) => (
            <li key={c.id}>
              <Link to={`/mensajes?conversacion=${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                <ChannelBadge channel={c.channel} className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {convTitle(c)}
                    <Badge variant="neutral" className="px-1.5 py-0 text-[10px]">
                      {statusText[c.status]}
                    </Badge>
                    {c.labels
                      .filter((l) => l !== 'cliente')
                      .map((l) => (
                        <Badge key={l} variant="neutral" className="px-1.5 py-0 text-[10px]">
                          {labelText[l as Label]}
                        </Badge>
                      ))}
                  </span>
                  <span className="line-clamp-1 text-xs text-muted-foreground">{c.last_message_preview}</span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">{c.last_message_at ? timeAgo(c.last_message_at) : ''}</span>
                {c.unread_count > 0 && <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">{c.unread_count}</span>}
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <TemplateDialog open={templateOpen} onOpenChange={setTemplateOpen} target={{ clientId }} contactName={contactName} onSent={(id) => nav(`/mensajes?conversacion=${id}`)} />
    </Card>
  )
}
