import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, KeyRound, LoaderCircle, MessageCircle, UserPlus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { friendlyError } from '@/data/api'
import type { ClientOverview } from '@/data/crm'
import { createPortalAccess, listPortalAccess, resetPortalAccess, setPortalActive, type Credentials } from '@/data/portal'
import { timeAgo } from '@/lib/format'

/** Dar y quitar acceso al portal a las personas del cliente (solo admin). */
export function PortalAccessDialog({ client, open, onOpenChange }: { client: ClientOverview; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['portal-access', client.id], queryFn: () => listPortalAccess(client.id), enabled: open })
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [creds, setCreds] = useState<(Credentials & { name: string }) | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(client.name ?? '')
      setEmail(client.email ?? '')
      setCreds(null)
      setError(null)
    }
  }, [open, client])

  const refresh = () => void qc.invalidateQueries({ queryKey: ['portal-access', client.id] })
  const create = useMutation({
    mutationFn: () => createPortalAccess(client.id, email.trim(), name.trim()),
    onSuccess: (c) => {
      setCreds({ ...c, name: name.trim() })
      refresh()
    },
    onError: (e) => setError(friendlyError(e)),
  })
  const reset = useMutation({
    mutationFn: (p: { id: string; name: string }) => resetPortalAccess(p.id).then((c) => ({ ...c, name: p.name })),
    onSuccess: (c) => {
      setCreds(c)
      refresh()
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Escribí el nombre de la persona.')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Revisá el email.')
    setError(null)
    create.mutate()
  }

  const url = `${window.location.origin.startsWith('http') ? window.location.origin : 'https://amcreatorshub.netlify.app'}/login`
  const message = creds
    ? `¡Hola ${creds.name.split(' ')[0]}! Ya tenés acceso al portal de ${client.brand_name} en AM Creators, donde vas a ver y aprobar tu contenido y tus métricas.\n\nEntrá en: ${url}\nUsuario: ${creds.email}\nContraseña temporal: ${creds.password}\n\nLa primera vez te va a pedir que elijas tu propia contraseña.`
    : ''
  const wa = `https://wa.me/${(client.whatsapp ?? '').replace(/\D/g, '')}?text=${encodeURIComponent(message)}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {creds ? (
          <>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="size-5 text-brand" /> Acceso listo</DialogTitle>
            <DialogDescription className="mt-1">Mandale estos datos a {creds.name.split(' ')[0] || 'la persona'}. La contraseña se muestra solo esta vez; al entrar va a tener que elegir una propia.</DialogDescription>
            <dl className="mt-5 space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
              <div className="flex gap-2"><dt className="w-36 text-muted-foreground">Dirección</dt><dd className="font-medium">{url}</dd></div>
              <div className="flex gap-2"><dt className="w-36 text-muted-foreground">Usuario</dt><dd className="font-medium">{creds.email}</dd></div>
              <div className="flex gap-2"><dt className="w-36 text-muted-foreground">Contraseña temporal</dt><dd className="font-mono font-semibold">{creds.password}</dd></div>
            </dl>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => void navigator.clipboard.writeText(message).then(() => toast.success('Mensaje copiado.'))}><Copy /> Copiar mensaje</Button>
              <Button asChild><a href={wa} target="_blank" rel="noreferrer"><MessageCircle /> Mandar por WhatsApp</a></Button>
            </div>
            <button className="mt-4 text-sm text-brand hover:underline" onClick={() => setCreds(null)}>Volver a la lista</button>
          </>
        ) : (
          <>
            <DialogTitle>Portal de {client.brand_name}</DialogTitle>
            <DialogDescription className="mt-1">Quienes tengan acceso ven el contenido que les mandás a aprobar (no los borradores), lo aprueban o piden cambios, y ven sus métricas y reportes. No ven montos ni nada de otros clientes.</DialogDescription>
            <div className="mt-5">
              {isLoading ? (
                <Skeleton className="h-14" />
              ) : data?.length ? (
                <ul className="divide-y rounded-lg border">
                  {data.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                      <Avatar name={p.full_name} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate text-sm font-medium">{p.full_name}{!p.is_active && <Badge variant="neutral">Sin acceso</Badge>}</p>
                        <p className="truncate text-xs text-muted-foreground">{p.email} · desde {timeAgo(p.created_at)}</p>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => reset.mutate({ id: p.id, name: p.full_name })} disabled={reset.isPending} title="Generar una contraseña temporal nueva">
                        <KeyRound /> <span className="hidden sm:inline">Nueva clave</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await setPortalActive(p.id, !p.is_active)
                            refresh()
                            toast.success(p.is_active ? 'Acceso quitado.' : 'Acceso devuelto.')
                          } catch (e) {
                            toast.error(friendlyError(e))
                          }
                        }}
                      >
                        {p.is_active ? 'Quitar acceso' : 'Devolver acceso'}
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-lg bg-muted px-3 py-3 text-sm text-muted-foreground">Todavía nadie de {client.brand_name} tiene acceso.</p>
              )}
            </div>
            <form onSubmit={onSubmit} className="mt-5 space-y-4 border-t pt-5" noValidate>
              <p className="flex items-center gap-2 text-sm font-semibold"><UserPlus className="size-4 text-brand" /> Dar acceso a una persona</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="pa-name">Nombre</Label><Input id="pa-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-2"><Label htmlFor="pa-email">Email</Label><Input id="pa-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              </div>
              {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
              <div className="flex justify-end">
                <Button type="submit" disabled={create.isPending}>{create.isPending && <LoaderCircle className="animate-spin" />} Crear acceso</Button>
              </div>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
