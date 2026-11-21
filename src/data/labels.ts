import type { ClientStatus, ProjectStatus, ServiceType } from './crm'
import type { EventType, PostFormat, PostStatus, Role, TaskColumn, TaskPriority } from './types'

export const roleLabel: Record<Role, string> = { admin: 'Admin', equipo: 'Equipo', cliente: 'Cliente' }

export const priorityLabel: Record<TaskPriority, string> = { baja: 'Baja', media: 'Media', alta: 'Alta', urgente: 'Urgente' }

export const columnLabel: Record<TaskColumn, string> = {
  por_hacer: 'Por hacer',
  en_proceso: 'En proceso',
  en_revision: 'En revisión',
  aprobado: 'Aprobado',
  entregado: 'Entregado',
}

export const formatLabel: Record<PostFormat, string> = { feed: 'Feed', carrusel: 'Carrusel', reel: 'Reel', story: 'Story' }

export const postStatusLabel: Record<PostStatus, string> = {
  idea: 'Idea',
  borrador: 'Borrador',
  en_aprobacion: 'En aprobación',
  aprobado: 'Aprobado',
  programado: 'Programado',
  publicado: 'Publicado',
  error: 'Error',
}

export const eventTypeLabel: Record<EventType, string> = {
  reunion: 'Reunión',
  evento: 'Evento',
  sesion_fotos: 'Sesión de fotos',
  entrega: 'Entrega',
}


export const serviceLabel: Record<ServiceType, string> = {
  branding: 'Branding',
  redes: 'Redes',
  web: 'Web',
  fotografia: 'Fotografía',
  otro: 'Otro',
}
export const SERVICES = Object.keys(serviceLabel) as ServiceType[]

export const clientStatusLabel: Record<ClientStatus, string> = {
  lead: 'Lead',
  activo: 'Activo',
  pausado: 'Pausado',
  finalizado: 'Finalizado',
}
export const clientStatusVariant: Record<ClientStatus, 'default' | 'success' | 'warning' | 'neutral'> = {
  lead: 'default',
  activo: 'success',
  pausado: 'warning',
  finalizado: 'neutral',
}

export const projectStatusLabel: Record<ProjectStatus, string> = {
  activo: 'Activo',
  en_pausa: 'En pausa',
  terminado: 'Terminado',
  cancelado: 'Cancelado',
}
export const projectStatusVariant: Record<ProjectStatus, 'default' | 'success' | 'warning' | 'neutral'> = {
  activo: 'default',
  en_pausa: 'warning',
  terminado: 'success',
  cancelado: 'neutral',
}

export const COLUMNS = ['por_hacer', 'en_proceso', 'en_revision', 'aprobado', 'entregado'] as const
export const PRIORITIES = ['baja', 'media', 'alta', 'urgente'] as const

/** Colores para identificar clientes en calendarios y tableros */
export const CLIENT_COLORS = ['#0300FF', '#020061', '#16A34A', '#9333EA', '#EA580C', '#DB2777', '#0891B2', '#CA8A04', '#64748B']
