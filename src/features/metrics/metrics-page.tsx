import { BarChart3, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { PageHeader } from '@/components/common/page-header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/features/auth/auth-context'
import { useParam } from '@/features/projects/use-task-sheet'
import { todayMvd } from '@/lib/format'
import { useConnectInstagram, useIgAccounts, useInstagramReturn } from './instagram-accounts'
import { MetricsView } from './metrics-view'

export function MetricsPage() {
  const { data: accounts, isLoading, error, refetch } = useIgAccounts()
  const [accountId, setAccountId] = useParam<string>('cuenta', '')
  const [month, setMonth] = useParam<string>('mes', todayMvd().slice(0, 7))
  const { profile } = useAuth()
  useInstagramReturn()
  // Primero la cuenta del estudio, después las de clientes
  const sorted = [...(accounts ?? [])].sort((a, b) => Number(!!a.client_id) - Number(!!b.client_id) || (a.username ?? '').localeCompare(b.username ?? ''))

  return (
    <>
      <PageHeader title="Métricas" description="Cómo vienen las cuentas de Instagram: la del estudio y las de tus clientes." />
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-96" />
      ) : !sorted.length ? (
        <Card>
          <EmptyState
            icon={BarChart3}
            title="Conectá una cuenta de Instagram"
            description="Cuando conectes la cuenta del estudio o la de un cliente, acá vas a ver seguidores, alcance, interacciones, las mejores publicaciones y el mejor horario."
            action={profile?.role === 'admin' ? <Button asChild><Link to="/configuracion?tab=integraciones"><Plus /> Conectar Instagram</Link></Button> : undefined}
          />
        </Card>
      ) : (
        <MetricsView accounts={sorted} accountId={accountId || sorted[0].id} onAccount={setAccountId} month={month} onMonth={setMonth} />
      )}
    </>
  )
}

/** Pestaña Métricas de la ficha del cliente. */
export function ClientMetricsTab({ clientId, brandName }: { clientId: string; brandName: string }) {
  const { data: accounts, isLoading } = useIgAccounts()
  const [accountId, setAccountId] = useParam<string>('cuenta', '')
  const [month, setMonth] = useParam<string>('mes', todayMvd().slice(0, 7))
  const { profile } = useAuth()
  const connect = useConnectInstagram()
  useInstagramReturn()
  const mine = (accounts ?? []).filter((a) => a.client_id === clientId)
  if (isLoading) return <Skeleton className="h-96" />
  if (!mine.length)
    return (
      <Card>
        <EmptyState
          icon={BarChart3}
          title={`${brandName} no tiene Instagram conectado`}
          description="Conectá su cuenta para ver métricas, generar el reporte mensual y publicar automáticamente. Tiene que ser una cuenta profesional (Empresa o Creador)."
          action={profile?.role === 'admin' ? <Button onClick={() => connect.mutate(clientId)} disabled={connect.isPending}><Plus /> Conectar Instagram de {brandName}</Button> : undefined}
        />
      </Card>
    )
  return <MetricsView accounts={mine} accountId={accountId || mine[0].id} onAccount={setAccountId} month={month} onMonth={setMonth} />
}
