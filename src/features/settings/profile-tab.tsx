import { LoaderCircle } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { friendlyError, updateMyProfile } from '@/data/api'
import { roleLabel } from '@/data/labels'
import { useAuth } from '@/features/auth/auth-context'
import { Field } from './field'

export function ProfileTab() {
  const { profile, email, userId, refreshProfile, sendPasswordReset } = useAuth()
  const [name, setName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setName(profile?.full_name ?? '')
    setPhone(profile?.phone ?? '')
  }, [profile])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return toast.error('Poné tu nombre.')
    setBusy(true)
    try {
      await updateMyProfile(userId!, { full_name: name.trim(), phone: phone.trim() || null })
      await refreshProfile()
      toast.success('Perfil guardado.')
    } catch (err) {
      toast.error(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <Card>
        <CardHeader>
          <CardTitle>Tus datos</CardTitle>
          <CardDescription>Así te ve el resto del equipo en tareas y comentarios.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid max-w-lg gap-5">
            <div className="flex items-center gap-4">
              <Avatar name={name} className="size-14 text-base" />
              <div>
                <p className="font-semibold">{name || 'Sin nombre'}</p>
                <p className="text-sm text-muted-foreground">
                  {email} · {profile ? roleLabel[profile.role] : ''}
                </p>
              </div>
            </div>
            <Field id="name" label="Nombre y apellido">
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field id="phone" label="Celular" hint="Formato internacional, por ejemplo +598 99 123 456.">
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+598" />
            </Field>
            <div>
              <Button type="submit" disabled={busy}>
                {busy && <LoaderCircle className="animate-spin" />}
                Guardar cambios
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Contraseña</CardTitle>
          <CardDescription>Te mandamos un link a tu email para cambiarla.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await sendPasswordReset(email!)
                toast.success('Te mandamos el link. Revisá tu email.')
              } catch (err) {
                toast.error(friendlyError(err))
              }
            }}
          >
            Cambiar contraseña
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
