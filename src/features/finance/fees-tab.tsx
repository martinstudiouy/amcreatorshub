import { useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Repeat, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ClientChip } from '@/components/common/client-chip'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { friendlyError } from '@/data/api'
import { deleteFee, type Fee } from '@/data/finance'
import { formatDate, formatMoney } from '@/lib/format'
import { FeeDialog, invalidateFinance } from './dialogs'
import { useFees, useFx } from './use-finance'

export function FeesTab({ clientId }: { clientId?: string }) {
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useFees()
  const { data: fx } = useFx()
  const [editing, setEditing] = useState<Fee | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<Fee | null>(null)
  const fees = (data ?? []).filter((f) => !clientId || f.client_id === clientId)
  const monthly = fees.filter((f) => f.is_active).reduce((s, f) => s + Number(f.amount) * (f.currency === 'USD' ? (fx ?? 0) : 1), 0)

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />
  if (isLoading) return <Skeleton className="h-48" />
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Cada fee crea solo el cobro del mes en su día de cobro.{' '}
          {fees.length > 0 && <>Ingreso fijo por mes: <strong className="text-foreground tabular-nums">{formatMoney(monthly)}</strong>.</>}
        </p>
        <Button onClick={() => setEditing(null)}><Plus /> Nuevo fee</Button>
      </div>
      {!fees.length ? (
        <Card><EmptyState compact icon={Repeat} title="Sin fees mensuales" description="Cargá el fee de cada cliente de redes y el cobro de cada mes se va a crear solo." /></Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                {!clientId && <th className="px-4 py-3 font-medium">Cliente</th>}
                <th className="px-4 py-3 font-medium">Concepto</th>
                <th className="px-4 py-3 text-right font-medium">Por mes</th>
                <th className="px-4 py-3 font-medium">Día de cobro</th>
                <th className="px-4 py-3 font-medium">Vigencia</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {fees.map((f) => (
                <tr key={f.id} className="group hover:bg-muted/40">
                  {!clientId && <td className="px-4 py-3"><ClientChip name={f.client_name} color={f.client_color} /></td>}
                  <td className="px-4 py-3">{f.description}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums">{formatMoney(f.amount, f.currency)}</td>
                  <td className="px-4 py-3">El {f.billing_day} de cada mes</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">Desde {formatDate(f.start_date)}{f.end_date ? ` hasta ${formatDate(f.end_date)}` : ''}</td>
                  <td className="px-4 py-3">{f.is_active ? <Badge variant="success">Activo</Badge> : <Badge variant="neutral">Pausado</Badge>}</td>
                  <td className="px-4 py-2 text-right">
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditing(f)} aria-label="Editar"><Pencil /></Button>
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => setDeleting(f)} aria-label="Borrar"><Trash2 /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <FeeDialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} fee={editing} defaultClientId={clientId} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`¿Borrar el fee de ${deleting?.client_name}?`}
        description="Deja de generar cobros. Los cobros ya creados no se tocan. Si solo querés pausarlo, editalo y destildá Activo."
        confirmLabel="Borrar"
        destructive
        onConfirm={async () => {
          try {
            await deleteFee(deleting!.id)
            invalidateFinance(qc)
          } catch (e) {
            toast.error(friendlyError(e))
          }
        }}
      />
    </>
  )
}
