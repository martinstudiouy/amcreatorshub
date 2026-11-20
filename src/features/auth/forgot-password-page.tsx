import { ArrowLeft, LoaderCircle, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { friendlyError } from '@/data/api'
import { AuthShell } from './auth-shell'
import { useAuth } from './auth-context'

export function ForgotPasswordPage() {
  const { sendPasswordReset } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await sendPasswordReset(email.trim())
      setSent(true)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell title="Recuperá tu contraseña" subtitle="Te mandamos un link a tu email para que elijas una nueva.">
      {sent ? (
        <div className="rounded-lg border bg-card p-5 text-sm shadow-soft">
          <Mail className="mb-3 size-5 text-brand" />
          <p className="font-semibold">Revisá tu email</p>
          <p className="mt-1 text-muted-foreground">
            Si <strong className="text-foreground">{email}</strong> tiene una cuenta, en unos minutos te llega el link. Mirá también en spam.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy || !email}>
            {busy && <LoaderCircle className="animate-spin" />}
            Mandar link
          </Button>
        </form>
      )}
      <Link to="/login" className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline">
        <ArrowLeft className="size-4" /> Volver al ingreso
      </Link>
    </AuthShell>
  )
}
