import { Settings } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useRole } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'
import { navFor } from './nav'
import { Wordmark } from './wordmark'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-accent text-brand' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
  )

export function Sidebar() {
  const role = useRole()
  const items = navFor(role)
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar md:flex lg:w-64">
      <div className="flex h-16 items-center px-5">
        <Wordmark />
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-2" aria-label="Secciones">
        {items.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={linkClass}>
            <item.icon className="size-[18px]" />
            <span className="flex-1">{item.label}</span>
            {item.phase > 1 && (
              <span className="rounded px-1.5 text-[10px] font-medium text-muted-foreground/70 group-hover:text-muted-foreground">
                F{item.phase}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="border-t p-3">
        <NavLink to="/configuracion" className={linkClass}>
          <Settings className="size-[18px]" />
          Configuración
        </NavLink>
      </div>
    </aside>
  )
}
