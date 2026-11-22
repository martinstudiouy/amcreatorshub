import { CalendarClock, CalendarRange, FolderKanban, HandCoins, ListTodo, LogOut, Monitor, Moon, Plus, Receipt, Search, Sun, User, Users } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExpenseDialog, InvoiceDialog } from '@/features/finance/dialogs'
import { PostSheet } from '@/features/content/post-sheet'
import { EventDialog } from '@/features/agenda/event-dialog'
import { ClientFormDialog } from '@/features/clients/client-form-dialog'
import { NewTaskDialog } from '@/features/projects/new-task-dialog'
import { ProjectFormDialog } from '@/features/projects/project-form-dialog'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { roleLabel } from '@/data/labels'
import { useAuth } from '@/features/auth/auth-context'
import { todayMvd } from '@/lib/format'
import { isDemo } from '@/lib/supabase'
import { useTheme } from '@/providers/theme'
import { NotificationsMenu } from './notifications-menu'
import { Wordmark } from './wordmark'

type NewKind = 'cliente' | 'proyecto' | 'tarea' | 'evento' | 'gasto' | 'cobro' | 'publicacion'
const NEW_ITEMS: { label: string; icon: typeof Users; phase: number; admin: boolean; kind?: NewKind }[] = [
  { label: 'Cliente', icon: Users, phase: 2, admin: false, kind: 'cliente' },
  { label: 'Proyecto', icon: FolderKanban, phase: 2, admin: false, kind: 'proyecto' },
  { label: 'Tarea', icon: ListTodo, phase: 2, admin: false, kind: 'tarea' },
  { label: 'Reunión o evento', icon: CalendarClock, phase: 3, admin: false, kind: 'evento' },
  { label: 'Cobro', icon: HandCoins, phase: 4, admin: true, kind: 'cobro' },
  { label: 'Gasto', icon: Receipt, phase: 4, admin: true, kind: 'gasto' },
  { label: 'Publicación', icon: CalendarRange, phase: 5, admin: false, kind: 'publicacion' },
]

export function Topbar({ onSearch }: { onSearch: () => void }) {
  const { profile, email, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()
  const isMac = navigator.platform.toLowerCase().includes('mac')
  const isAdmin = profile?.role === 'admin'
  const [creating, setCreating] = useState<NewKind | null>(null)
  const close = (o: boolean) => !o && setCreating(null)

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur md:px-6">
      <div className="md:hidden">
        <Wordmark compact />
      </div>

      <button
        onClick={onSearch}
        className="ml-auto flex h-10 w-10 items-center justify-center gap-2 rounded-lg border border-input bg-card text-sm text-muted-foreground transition-colors hover:border-foreground/20 sm:w-72 sm:justify-start sm:px-3 md:ml-0 lg:w-96"
        aria-label="Buscar"
      >
        <Search className="size-4 shrink-0" />
        <span className="hidden flex-1 text-left sm:block">Buscar…</span>
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-sans text-[11px] sm:block">{isMac ? '⌘' : 'Ctrl'} K</kbd>
      </button>

      <div className="flex items-center gap-1 md:ml-auto">
        {isDemo && <span className="mr-1 hidden rounded-md bg-warning/12 px-2 py-1 text-xs font-medium text-warning lg:block">Modo demo</span>}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-9 px-3" aria-label="Crear nuevo">
              <Plus />
              <span className="hidden sm:inline">Nuevo</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Crear</DropdownMenuLabel>
            {NEW_ITEMS.filter((i) => !i.admin || isAdmin).map((i) => (
              <DropdownMenuItem key={i.label} disabled={!i.kind} onSelect={() => i.kind && setCreating(i.kind)}>
                <i.icon />
                <span className="flex-1">{i.label}</span>
                {!i.kind && <span className="text-[10px] text-muted-foreground">Fase {i.phase}</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <NotificationsMenu />

        <DropdownMenu>
          <DropdownMenuTrigger className="ml-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Tu cuenta">
            <Avatar name={profile?.full_name} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-semibold">{profile?.full_name || 'Sin nombre'}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
              {profile && <p className="mt-1 text-xs font-medium text-brand">{roleLabel[profile.role]}</p>}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate('/configuracion?tab=perfil')}>
              <User /> Mi perfil
            </DropdownMenuItem>
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
      <ClientFormDialog open={creating === 'cliente'} onOpenChange={close} onSaved={(id) => navigate(`/clientes/${id}`)} />
      <ProjectFormDialog open={creating === 'proyecto'} onOpenChange={close} onSaved={(id) => navigate(`/proyectos/${id}`)} />
      <EventDialog open={creating === 'evento'} onOpenChange={close} />
      <PostSheet open={creating === 'publicacion'} draft={{ date: todayMvd() }} onClose={() => setCreating(null)} />
      {isAdmin && <InvoiceDialog open={creating === 'cobro'} onOpenChange={close} />}
      {isAdmin && <ExpenseDialog open={creating === 'gasto'} onOpenChange={close} />}
      <NewTaskDialog open={creating === 'tarea'} onOpenChange={close} onCreated={(id) => navigate(`/proyectos?vista=tablero&tarea=${id}`)} />
    </header>
  )
}
