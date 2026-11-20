import { LoaderCircle, LogOut, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Isotipo } from '@/components/layout/wordmark'
import { Button } from '@/components/ui/button'
import type { Role } from '@/data/types'
import { AuthShell } from './auth-shell'
import { useAuth } from './auth-context'

export function FullScreenLoader() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <Isotipo className="h-10 animate-pulse" />
      <LoaderCircle className="size-5 animate-spin text-muted-foreground" />
    </div>
  )
}

/** Exige sesión iniciada y perfil activo. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, profile, signOut } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullScreenLoader />
  if (status === 'signed_out') return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (!profile || !profile.is_active) {
    return (
      <AuthShell title="Tu cuenta no está activa" subtitle="Pedile a Martín que te active desde Configuración → Equipo.">
        <Button variant="outline" onClick={() => void signOut()}>
          <LogOut /> Salir
        </Button>
      </AuthShell>
    )
  }
  return <>{children}</>
}

/** Muestra el contenido solo a ciertos roles. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { profile } = useAuth()
  if (!profile || !roles.includes(profile.role)) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <ShieldAlert className="size-8 text-muted-foreground" />
        <p className="text-lg font-semibold">No tenés acceso a esta sección</p>
        <p className="max-w-sm text-sm text-muted-foreground">Si creés que deberías verla, pedíselo a un admin.</p>
      </div>
    )
  }
  return <>{children}</>
}
