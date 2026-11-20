import { Eye, EyeOff, LoaderCircle, ShieldCheck, User, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { friendlyError } from '@/data/api'
import type { Role } from '@/data/types'
import { isDemo } from '@/lib/supabase'
import { AuthShell } from './auth-shell'
import { useAuth } from './auth-context'

export function LoginPage() {
  const { status, signIn, signInDemo } = useAuth()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (status === 'signed_in') return <Navigate to={from} replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signIn(email.trim(), password)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  if (isDemo) {
    const options: { role: Role; label: string; desc: string; icon: typeof User }[] = [
      { role: 'admin', label: 'Entrar como Admin', desc: 'Acceso total, incluye finanzas', icon: ShieldCheck },
      { role: 'equipo', label: 'Entrar como Equipo', desc: 'Sin finanzas ni montos', icon: Users },
      { role: 'cliente', label: 'Entrar como Cliente', desc: 'Portal de solo lectura (Fase 8)', icon: User },
    ]
    return (
      <AuthShell
        title="Modo demo"
        subtitle="Todavía no conectaste Supabase, así que la app usa datos de ejemplo. Elegí con qué rol querés recorrerla."
      >
        <div className="space-y-3">
          {options.map((o) => (
            <button
              key={o.role}
              onClick={() => void signInDemo(o.role)}
              className="flex w-full items-center gap-4 rounded-lg border bg-card p-4 text-left shadow-soft transition-colors hover:border-primary"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-accent text-brand">
                <o.icon className="size-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{o.label}</span>
                <span className="block text-xs text-muted-foreground">{o.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Ingresá a tu cuenta" subtitle="Usá el email y la contraseña con los que te invitaron.">
      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@amcreators.uy" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <Link to="/olvide-mi-contrasena" className="text-xs font-medium text-brand hover:underline">
              Olvidé mi contraseña
            </Link>
          </div>
          <div className="relative">
            <Input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground" aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">{error}</p>}
        <Button type="submit" className="w-full" disabled={busy || !email || !password}>
          {busy && <LoaderCircle className="animate-spin" />}
          Entrar
        </Button>
      </form>
    </AuthShell>
  )
}
