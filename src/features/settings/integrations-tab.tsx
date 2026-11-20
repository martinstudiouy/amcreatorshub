import { CalendarClock, MessageCircle } from 'lucide-react'
import { ChannelIcon } from '@/components/common/channel-icon'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

const ITEMS = [
  { name: 'Google Calendar', desc: 'Sincroniza reuniones y eventos en ambos sentidos.', phase: 3, icon: <CalendarClock className="size-5" /> },
  { name: 'Instagram', desc: 'Publicación automática y métricas de tu cuenta y las de tus clientes.', phase: 6, icon: <ChannelIcon channel="instagram" className="size-5" /> },
  { name: 'WhatsApp Business', desc: 'Bandeja unificada, respuestas rápidas y recordatorios.', phase: 7, icon: <MessageCircle className="size-5" /> },
]

export function IntegrationsTab() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {ITEMS.map((i) => (
        <Card key={i.name} className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <span className="flex size-10 items-center justify-center rounded-full bg-accent text-brand">{i.icon}</span>
            <Badge variant="neutral">Fase {i.phase}</Badge>
          </div>
          <div>
            <p className="font-semibold">{i.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{i.desc}</p>
          </div>
          <p className="mt-auto text-xs text-muted-foreground">Las claves se guardan solo en el servidor, nunca en el navegador.</p>
        </Card>
      ))}
    </div>
  )
}
