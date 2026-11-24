import { useQuery } from '@tanstack/react-query'
import { BarChart3, CalendarRange, Home, LogOut, Monitor, Moon, Sun } from 'lucide-react'
import { NavLink, Navigate, Outlet } from 'react-router-dom'
import { BrandMark } from '@/components/common/client-chip'
import { Wordmark } from '@/components/layout/wordmark'
import { Avatar } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { getClient } from '@/data/crm'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'
import { useTheme } from '@/providers/theme'

const NAV = [
  { to: '/portal', label: 'Inicio', icon: Home, end: true },
  { to: '/portal/contenido', label: 'Contenido', icon: CalendarRange },
  { to: '/portal/metricas', label: 'Métricas', icon: BarChart3 },
]

export function usePortalClient() {
  const { profile } = useAuth()
  return useQuery({ queryKey: ['client', profile?.client_id], queryFn: () => getClient(profile!.client_id!), enabled: !!profile?.client_id })
}

/** Portal del cliente: su marca, su contenido y sus métricas. */
export function PortalLayout() {
  const { profile, email, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const { data: client } = usePortalClient()
  if (profile && profile.role !== 'cliente') return <Navigate to="/" replace />

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:px-8">
          <Wordmark />
          <span className="hidden h-6 w-px bg-border sm:block" />
          {client && (
            <span className="hidden min-w-0 items-center gap-2 sm:flex">
              <BrandMark name={client.brand_name} color={client.color_tag} className="size-7 rounded-md text-xs" />
              <span className="truncate text-sm font-semibold">{client.brand_name}</span>
            </span>
          )}
          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Portal">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium', isActive ? 'bg-accent text-brand' : 'text-muted-foreground hover:text-foreground')}>
                <n.icon className="size-4" /> {n.label}
              </NavLink>
            ))}
          </nav>
          <DropdownMenu>
            <DropdownMenuTrigger className="ml-auto rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:ml-2" aria-label="Tu cuenta">
              <Avatar name={profile?.full_name} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <div className="px-2.5 py-2">
                <p className="truncate text-sm font-semibold">{profile?.full_name || 'Sin nombre'}</p>
                <p className="truncate text-xs text-muted-foreground">{email}</p>
                {client && <p className="mt-1 text-xs font-medium text-brand">{client.brand_name}</p>}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Apariencia</DropdownMenuLabel>
              {(
                [
                  ['light', 'Claro', Sun],
                  ['dark', 'Oscuro', Moon],
                  ['system', 'Como el sistema', Monitor],
                ] as const
              ).map(([value, label, Icon]) => (
                <DropdownMenuItem key={value} onSelect={() => setTheme(value)}>
                  <Icon />
                  <span className="flex-1">{label}</span>
                  {theme === value && <span className="size-1.5 rounded-full bg-primary" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void signOut()}>
                <LogOut /> Salir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">
        <Outlet />
      </main>
      {/* Navegación del celular */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label="Portal">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium', isActive ? 'text-brand' : 'text-muted-foreground')}>
            <n.icon className="size-5" /> {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
