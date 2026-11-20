import { Ellipsis, Settings } from 'lucide-react'
import { NavLink, useNavigate } from 'react-router-dom'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useRole } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'
import { navFor } from './nav'

/** Barra inferior en el celular: 5 accesos + "Más". */
export function MobileNav() {
  const role = useRole()
  const navigate = useNavigate()
  const items = navFor(role)
  const main = items.filter((i) => i.mobile)
  const rest = items.filter((i) => !i.mobile)
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      style={{ gridTemplateColumns: `repeat(${main.length + 1}, minmax(0, 1fr))` }}
      aria-label="Secciones"
    >
      {main.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) =>
            cn('flex flex-col items-center gap-1 py-2 text-[11px] font-medium', isActive ? 'text-brand' : 'text-muted-foreground')
          }
        >
          <item.icon className="size-5" />
          {item.label}
        </NavLink>
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger className="flex flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted-foreground">
          <Ellipsis className="size-5" />
          Más
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top">
          {rest.map((item) => (
            <DropdownMenuItem key={item.to} onSelect={() => navigate(item.to)}>
              <item.icon />
              {item.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem onSelect={() => navigate('/configuracion')}>
            <Settings />
            Configuración
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  )
}
