import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthShell } from '@/features/auth/auth-shell'
import { useAuth } from '@/features/auth/auth-context'

/** Portal de cliente (Fase 8). Por ahora, una pantalla de bienvenida. */
export function ClientPortal() {
  const { profile, signOut } = useAuth()
  return (
    <AuthShell title={`Hola${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}`} subtitle="Muy pronto vas a poder ver y aprobar el contenido de tu marca desde acá.">
      <Button variant="outline" onClick={() => void signOut()}>
        <LogOut /> Salir
      </Button>
    </AuthShell>
  )
}
