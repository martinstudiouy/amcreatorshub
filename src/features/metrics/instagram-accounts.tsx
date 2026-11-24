import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleAlert, Link2, LoaderCircle, Plus, RefreshCw, Unplug } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { BrandMark } from '@/components/common/client-chip'
import { ChannelIcon } from '@/components/common/channel-icon'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-context'
import { friendlyError } from '@/data/api'
import { listClients } from '@/data/crm'
import { assignAccount, disconnectAccount, listAccounts, startInstagramConnect, syncInstagramNow, type SocialAccount } from '@/data/instagram'
import { formatDate, formatNumber, timeAgo } from '@/lib/format'

export function invalidateInstagram(qc: ReturnType<typeof useQueryClient>) {
  for (const k of ['ig-accounts', 'ig-daily', 'ig-posts', 'dashboard']) void qc.invalidateQueries({ queryKey: [k] })
}

export const useIgAccounts = () => useQuery({ queryKey: ['ig-accounts'], queryFn: listAccounts })

/** Vuelve de Instagram con ?instagram=ok|error: muestra el aviso y limpia la URL. */
export function useInstagramReturn() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  useEffect(() => {
    const r = params.get('instagram')
    if (!r) return
    if (r === 'ok') toast.success('Instagram conectado. Ya trajimos las métricas de los últimos 30 días.')
    else toast.error(params.get('motivo') ?? 'No se pudo conectar Instagram.', { duration: 10_000 })
    setParams(
      (p) => {
        p.delete('instagram')
        p.delete('motivo')
        return p
      },
      { replace: true },
    )
    invalidateInstagram(qc)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
}

export function useConnectInstagram() {
  return useMutation({
    mutationFn: (clientId?: string | null) => startInstagramConnect(clientId),
    onSuccess: (url) => {
      window.location.href = url
    },
    onError: (e) => toast.error(friendlyError(e), { duration: 8000 }),
  })
}

export function AccountStatus({ a }: { a: SocialAccount }) {
  if (a.status === 'desconectada') return <Badge variant="danger">Desconectada</Badge>
  if (a.status === 'por_vencer') return <Badge variant="warning">{a.token_expires_at ? `Vence ${formatDate(a.token_expires_at)}` : 'Revisar acceso'}</Badge>
  return <Badge variant="success">Conectada</Badge>
}

export function AccountAvatar({ a, className }: { a: Pick<SocialAccount, 'profile_picture_url' | 'username' | 'client_color'>; className?: string }) {
  return a.profile_picture_url ? (
    <img src={a.profile_picture_url} alt="" className={`rounded-full object-cover ${className ?? 'size-10'}`} />
  ) : (
    <BrandMark name={a.username ?? '?'} color={a.client_color ?? '#0300FF'} className={`rounded-full ${className ?? 'size-10'}`} />
  )
}

/** Tarjeta de Configuración → Integraciones con todas las cuentas de Instagram. */
export function InstagramCard() {
  const qc = useQueryClient()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  useInstagramReturn()
  const { data: accounts, isLoading } = useIgAccounts()
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: listClients })
  const connect = useConnectInstagram()
  const [target, setTarget] = useState<string>('propia')
  const [disconnecting, setDisconnecting] = useState<SocialAccount | null>(null)
  const copyLink = useMutation({
    mutationFn: (clientId: string) => startInstagramConnect(clientId),
    onSuccess: async (url) => {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiado. Mandáselo al cliente: lo abre, inicia sesión en Meta y marca su cuenta de Instagram.', { duration: 8000 })
    },
    onError: (e) => toast.error(friendlyError(e), { duration: 8000 }),
  })
  const sync = useMutation({
    mutationFn: (id?: string) => syncInstagramNow(id),
    onSuccess: () => {
      invalidateInstagram(qc)
      toast.success('Métricas actualizadas.')
    },
    onError: (e) => {
      invalidateInstagram(qc)
      toast.error(friendlyError(e))
    },
  })

  return (
    <Card className="flex flex-col gap-4 p-5 md:col-span-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-accent text-brand"><ChannelIcon channel="instagram" className="size-5" /></span>
          <div>
            <p className="font-semibold">Instagram</p>
            <p className="text-sm text-muted-foreground">Publicación automática y métricas de tu cuenta y las de tus clientes.</p>
          </div>
        </div>
        {accounts && accounts.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => sync.mutate(undefined)} disabled={sync.isPending} className="shrink-0">
            {sync.isPending ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} <span className="hidden sm:inline">Actualizar métricas</span>
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-24" />
      ) : accounts?.length ? (
        <ul className="divide-y rounded-lg border">
          {accounts.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
              <AccountAvatar a={a} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  @{a.username} <AccountStatus a={a} />
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.followers_count != null && `${formatNumber(a.followers_count)} seguidores · `}
                  {a.last_synced_at ? `métricas ${timeAgo(a.last_synced_at)}` : 'sin métricas todavía'}
                </p>
                {a.last_error && a.status !== 'conectada' && (
                  <p className="mt-1 flex items-start gap-1 text-xs text-destructive"><CircleAlert className="mt-px size-3.5 shrink-0" />{a.last_error}</p>
                )}
              </div>
              {isAdmin ? (
                <Select
                  value={a.client_id ?? 'propia'}
                  onValueChange={async (v) => {
                    try {
                      await assignAccount(a.id, v === 'propia' ? null : v)
                      invalidateInstagram(qc)
                      toast.success(v === 'propia' ? 'Quedó como cuenta del estudio.' : 'Cuenta asignada al cliente.')
                    } catch (e) {
                      toast.error(friendlyError(e))
                    }
                  }}
                >
                  <SelectTrigger className="h-9 w-44" aria-label={`De quién es @${a.username}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="propia">Cuenta del estudio</SelectItem>
                    {clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.brand_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs text-muted-foreground">{a.client_name ?? 'Cuenta del estudio'}</span>
              )}
              {isAdmin && (
                <div className="flex gap-1">
                  {a.status !== 'conectada' && (
                    <Button size="sm" onClick={() => connect.mutate(a.client_id)} disabled={connect.isPending}>Reconectar</Button>
                  )}
                  {a.status !== 'desconectada' && (
                    <Button size="icon" variant="ghost" className="size-9" onClick={() => setDisconnecting(a)} aria-label={`Desconectar @${a.username}`}><Unplug /></Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          Todavía no hay cuentas conectadas. Tienen que ser cuentas profesionales (Empresa o Creador) de Instagram.
        </p>
      )}

      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <span className="text-sm">Conectar una cuenta de</span>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="h-9 w-48" aria-label="De quién es la cuenta nueva"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="propia">AM Creators (estudio)</SelectItem>
              {clients?.filter((c) => c.status !== 'finalizado').map((c) => <SelectItem key={c.id} value={c.id}>{c.brand_name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => connect.mutate(target === 'propia' ? null : target)} disabled={connect.isPending}>
            {connect.isPending ? <LoaderCircle className="animate-spin" /> : <Plus />} Conectar
          </Button>
          {target !== 'propia' && (
            <Button variant="outline" onClick={() => copyLink.mutate(target)} disabled={copyLink.isPending}>
              {copyLink.isPending ? <LoaderCircle className="animate-spin" /> : <Link2 />} Link para el cliente
            </Button>
          )}
          <p className="w-full text-xs text-muted-foreground">
            Se abre Meta: iniciá sesión, elegí el portfolio y marcá la cuenta de Instagram. Si la cuenta es del cliente y vos no tenés acceso, usá “Link para el cliente” y mandáselo (sirve 7 días). El acceso se guarda cifrado en el servidor.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={!!disconnecting}
        onOpenChange={(o) => !o && setDisconnecting(null)}
        title={`¿Desconectar @${disconnecting?.username}?`}
        description="Deja de publicar y de traer métricas. El historial de métricas queda guardado."
        confirmLabel="Desconectar"
        destructive
        onConfirm={async () => {
          try {
            await disconnectAccount(disconnecting!.id)
            invalidateInstagram(qc)
            toast.success('Cuenta desconectada.')
          } catch (e) {
            toast.error(friendlyError(e))
          }
        }}
      />
    </Card>
  )
}
