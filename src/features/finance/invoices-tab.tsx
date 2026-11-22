import { Inbox, Plus, Repeat, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ClientChip } from '@/components/common/client-chip'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import type { Invoice, InvoiceStatus } from '@/data/finance'
import { formatDate, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { InvoiceDialog, PaidDialog } from './dialogs'
import { InvoiceBadge, Money, invoiceStatusLabel } from './finance-ui'
import { InvoiceActions } from './invoice-actions'
import { useInvoices } from './use-finance'

const FILTERS: (InvoiceStatus | 'todos' | 'por_cobrar')[] = ['por_cobrar', 'todos', 'cobrado', 'vencido', 'anulado']
const filterLabel = (f: (typeof FILTERS)[number]) => (f === 'todos' ? 'Todos' : f === 'por_cobrar' ? 'Por cobrar' : invoiceStatusLabel[f])

export function InvoicesTab({ clientId, compact }: { clientId?: string; compact?: boolean }) {
  const { data, isLoading, error, refetch } = useInvoices(clientId)
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(compact ? 'todos' : 'por_cobrar')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Invoice | null | undefined>(undefined)
  const [paying, setPaying] = useState<Invoice | null>(null)

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (data ?? []).filter(
      (i) =>
        (filter === 'todos' || (filter === 'por_cobrar' ? i.status === 'pendiente' || i.status === 'vencido' : i.status === filter)) &&
        (!t || [i.number, i.client_name, i.cfe_number, ...i.items.map((x) => x.description)].some((x) => x?.toLowerCase().includes(t))),
    )
  }, [data, filter, q])
  const totalUyu = rows.filter((i) => i.status !== 'anulado').reduce((s, i) => s + Number(i.total) * Number(i.fx_rate), 0)

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1" role="tablist">
          {FILTERS.map((f) => (
            <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} className={cn('whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium', filter === f ? 'bg-card shadow-soft' : 'text-muted-foreground hover:text-foreground')}>
              {filterLabel(f)}
            </button>
          ))}
        </div>
        <div className="flex flex-1 gap-2 lg:justify-end">
          {!compact && (
            <div className="relative flex-1 lg:max-w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar número, cliente…" className="pl-9" aria-label="Buscar cobro" />
            </div>
          )}
          <Button onClick={() => setEditing(null)}><Plus /> Nuevo cobro</Button>
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : !rows.length ? (
        <Card>
          <EmptyState
            compact
            icon={Inbox}
            title={filter === 'por_cobrar' ? 'No hay nada por cobrar' : 'No hay cobros con ese filtro'}
            description={data?.length ? 'Probá con otro filtro.' : 'Creá un cobro, o cargá un fee mensual para que se generen solos.'}
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Número</th>
                {!clientId && <th className="px-4 py-3 font-medium">Cliente</th>}
                <th className="px-4 py-3 font-medium">Concepto</th>
                <th className="px-4 py-3 font-medium">Emisión</th>
                <th className="px-4 py-3 font-medium">Vence / cobrado</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((i) => (
                <tr key={i.id} className={cn('hover:bg-muted/40', i.status === 'anulado' && 'text-muted-foreground line-through decoration-muted-foreground/40')}>
                  <td className="px-4 py-3 font-medium tabular-nums">
                    <button className="hover:text-brand" onClick={() => setEditing(i)}>{i.number}</button>
                    {i.recurring_fee_id && <Repeat className="ml-1.5 inline size-3.5 text-muted-foreground" aria-label="Fee mensual" />}
                    {i.cfe_number && <span className="block text-[11px] font-normal text-muted-foreground">CFE {i.cfe_number}</span>}
                  </td>
                  {!clientId && <td className="px-4 py-3"><ClientChip name={i.client_name} color={i.client_color} /></td>}
                  <td className="max-w-56 px-4 py-3">
                    <span className="block truncate">{i.items[0]?.description ?? '—'}</span>
                    {i.items.length > 1 && <span className="text-xs text-muted-foreground">+{i.items.length - 1} más</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatDate(i.issue_date)}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {i.status === 'cobrado' ? <span className="text-success">{formatDate(i.paid_at)}</span> : <span className={cn(i.status === 'vencido' && 'font-medium text-destructive')}>{formatDate(i.due_date) || '—'}</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold"><Money amount={i.total} currency={i.currency} fx={i.fx_rate} /></td>
                  <td className="px-4 py-3"><InvoiceBadge status={i.status} /></td>
                  <td className="px-4 py-2"><InvoiceActions invoice={i} onEdit={() => setEditing(i)} onPaid={() => setPaying(i)} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 text-sm">
                <td colSpan={clientId ? 4 : 5} className="px-4 py-3 text-muted-foreground">{rows.length} {rows.length === 1 ? 'cobro' : 'cobros'}</td>
                <td className="px-4 py-3 text-right font-bold tabular-nums">{formatMoney(totalUyu)}</td>
                <td colSpan={2} className="px-4 py-3 text-xs text-muted-foreground">en pesos</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
      <InvoiceDialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} invoice={editing} defaultClientId={clientId} />
      <PaidDialog invoice={paying} onOpenChange={(o) => !o && setPaying(null)} />
    </>
  )
}
