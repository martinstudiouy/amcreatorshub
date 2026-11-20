import { CalendarClock, CalendarRange, ChartColumn, FolderKanban, LayoutDashboard, MessagesSquare, Users, Wallet, type LucideIcon } from 'lucide-react'
import type { Role } from '@/data/types'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Fase en la que se construye la pantalla */
  phase: number
  roles: Role[]
  /** Acceso en la barra inferior del celular */
  mobile?: boolean
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Inicio', icon: LayoutDashboard, phase: 1, roles: ['admin', 'equipo'], mobile: true },
  { to: '/clientes', label: 'Clientes', icon: Users, phase: 2, roles: ['admin', 'equipo'], mobile: true },
  { to: '/proyectos', label: 'Proyectos', icon: FolderKanban, phase: 2, roles: ['admin', 'equipo'] },
  { to: '/contenidos', label: 'Contenidos', icon: CalendarRange, phase: 5, roles: ['admin', 'equipo'], mobile: true },
  { to: '/agenda', label: 'Agenda', icon: CalendarClock, phase: 3, roles: ['admin', 'equipo'], mobile: true },
  { to: '/mensajes', label: 'Mensajes', icon: MessagesSquare, phase: 7, roles: ['admin', 'equipo'], mobile: true },
  { to: '/metricas', label: 'Métricas', icon: ChartColumn, phase: 6, roles: ['admin', 'equipo'] },
  { to: '/finanzas', label: 'Finanzas', icon: Wallet, phase: 4, roles: ['admin'] },
]

export const navFor = (role: Role | null) => NAV.filter((n) => role && n.roles.includes(role))
