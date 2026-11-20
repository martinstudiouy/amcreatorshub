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
