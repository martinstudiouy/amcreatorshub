import { LoaderCircle } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { friendlyError } from '@/data/api'
import { AuthShell } from './auth-shell'
import { useAuth } from './auth-context'

/** Llega acá desde el link del email de recuperación (o de invitación). */
export function ResetPasswordPage({ firstTime }: { firstTime?: boolean }) {
  const { updatePassword, status } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (password.length < 8) return setError('La contraseña tiene que tener al menos 8 caracteres.')
    if (password !== confirm) return setError('Las dos contraseñas no coinciden.')
    setBusy(true)
    setError(null)
    try {
      await updatePassword(password)
      toast.success('Listo, tu contraseña quedó guardada.')
      navigate('/', { replace: true })
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  if (status === 'signed_out') {
    return (
      <AuthShell title="El link venció" subtitle="Los links de recuperación duran 1 hora. Pedí uno nuevo desde la pantalla de ingreso.">
        <Button onClick={() => navigate('/olvide-mi-contrasena')}>Pedir un link nuevo</Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Elegí tu contraseña" subtitle={firstTime ? 'Entraste con una contraseña temporal. Elegí una tuya para seguir (mínimo 8 caracteres).' : 'Mínimo 8 caracteres.'}>
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="pw">Nueva contraseña</Label>
          <Input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw2">Repetila</Label>
          <Input id="pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </div>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || status === 'loading'}>
          {busy && <LoaderCircle className="animate-spin" />}
          Guardar contraseña
        </Button>
      </form>
    </AuthShell>
  )
}
