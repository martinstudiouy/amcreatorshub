import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, CircleAlert, LoaderCircle, MessageCircle, RefreshCw, Unplug } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ChannelIcon } from '@/components/common/channel-icon'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { disconnectGoogle, getGoogleStatus, startGoogleConnect, syncGoogleNow } from '@/data/agenda'
import { friendlyError } from '@/data/api'
import { timeAgo } from '@/lib/format'
import { isDemo } from '@/lib/supabase'

const LATER = [
  { name: 'Instagram', desc: 'Publicación automática y métricas de tu cuenta y las de tus clientes.', phase: 6, icon: <ChannelIcon channel="instagram" className="size-5" /> },
  { name: 'WhatsApp Business', desc: 'Bandeja unificada, respuestas rápidas y recordatorios a clientes.', phase: 7, icon: <MessageCircle className="size-5" /> },
]

export function IntegrationsTab() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <GoogleCalendarCard />
      {LATER.map((i) => (
        <Card key={i.name} className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between">
            <span className="flex size-10 items-center justify-center rounded-full bg-accent text-brand">{i.icon}</span>
            <Badge variant="neutral">Fase {i.phase}</Badge>
          </div>
          <div>
            <p className="font-semibold">{i.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{i.desc}</p>
          </div>
          <p className="mt-auto text-xs text-muted-foreground">Las claves se guardan solo en el servidor, nunca en el navegador.</p>
        </Card>
      ))}
    </div>
  )
}

function GoogleCalendarCard() {
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [confirming, setConfirming] = useState(false)
  const { data, isLoading } = useQuery({ queryKey: ['google-status'], queryFn: getGoogleStatus })
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['google-status'] })
    void qc.invalidateQueries({ queryKey: ['events'] })
  }

  // Volvemos de Google con ?google=ok|error
  useEffect(() => {
    const r = params.get('google')
    if (!r) return
    if (r === 'ok') toast.success('Google Calendar conectado. Ya estamos sincronizando tu agenda.')
    else toast.error(params.get('motivo') ?? 'No se pudo conectar Google Calendar.')
    setParams((p) => {
      p.delete('google')
      p.delete('motivo')
      return p
    }, { replace: true })
    refresh()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const connect = useMutation({
    mutationFn: startGoogleConnect,
    onSuccess: (url) => {
      window.location.href = url
    },
    onError: (e) => toast.error(friendlyError(e)),
  })
  const sync = useMutation({
    mutationFn: syncGoogleNow,
    onSuccess: (r) => {
      refresh()
      toast.success(`Listo: ${r.pushed ?? 0} eventos subidos y ${r.pulled ?? 0} traídos de Google.`)
    },
    onError: (e) => {
      refresh()
      toast.error(friendlyError(e))
    },
  })

  const connected = data?.connected
  const broken = data?.status === 'desconectado'

  return (
    <Card className="flex flex-col gap-3 p-5 md:col-span-1">
      <div className="flex items-center justify-between">
        <span className="flex size-10 items-center justify-center rounded-full bg-accent text-brand"><CalendarClock className="size-5" /></span>
        {connected ? (broken ? <Badge variant="danger">Desconectado</Badge> : <Badge variant="success">Conectado</Badge>) : <Badge variant="neutral">Sin conectar</Badge>}
      </div>
      <div>
        <p className="font-semibold">Google Calendar</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {connected
            ? <>Sincronizado con <strong className="text-foreground">{data?.email}</strong>{data?.last_synced_at ? `, ${timeAgo(data.last_synced_at)}.` : '.'} Se actualiza cada 5 minutos en los dos sentidos.</>
            : 'Lo que agendes en el CRM aparece en tu Google Calendar y al revés. Se conecta una sola cuenta: la del estudio.'}
        </p>
        {data?.last_error && (
          <p className="mt-2 flex items-start gap-1.5 rounded-md bg-destructive/10 px-2.5 py-2 text-xs text-destructive">
            <CircleAlert className="mt-px size-3.5 shrink-0" /> {data.last_error}
          </p>
        )}
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        {isDemo ? (
          <p className="text-xs text-muted-foreground">En el modo demo no se puede conectar.</p>
        ) : isLoading ? null : !connected || broken ? (
          <Button onClick={() => connect.mutate()} disabled={connect.isPending}>
            {connect.isPending && <LoaderCircle className="animate-spin" />}
            {broken ? 'Volver a conectar' : 'Conectar con Google'}
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
              {sync.isPending ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Sincronizar ahora
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
              <Unplug /> Desconectar
            </Button>
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="¿Desconectar Google Calendar?"
        description="Los eventos quedan en el CRM y en Google, pero dejan de sincronizarse."
        confirmLabel="Desconectar"
        destructive
        onConfirm={async () => {
          try {
            await disconnectGoogle()
            refresh()
            toast.success('Google Calendar desconectado.')
          } catch (e) {
            toast.error(friendlyError(e))
          }
        }}
      />
    </Card>
  )
}
