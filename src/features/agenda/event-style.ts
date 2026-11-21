import { Camera, CalendarClock, PackageCheck, Users, type LucideIcon } from 'lucide-react'
import type { EventType } from '@/data/types'

export const eventTypeIcon: Record<EventType, LucideIcon> = { reunion: Users, evento: CalendarClock, sesion_fotos: Camera, entrega: PackageCheck }

/** Color por tipo (fondo suave + borde). Si el evento tiene cliente, el borde usa el color del cliente. */
export const eventTypeColor: Record<EventType, string> = {
  reunion: '#0300FF',
  evento: '#9333EA',
  sesion_fotos: '#EA580C',
  entrega: '#16A34A',
}

export function eventColor(e: { type: EventType; client_color: string | null }) {
  return e.client_color ?? eventTypeColor[e.type]
}
