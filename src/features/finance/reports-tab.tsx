import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClientChip } from '@/components/common/client-chip'
import { ErrorState } from '@/components/common/error-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { listProjects } from '@/data/crm'
import { formatMoney, todayMvd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { addMonthsKey, byClient, byProject } from './reports'
import { useExpenses, useFx, useInvoices } from './use-finance'

const PERIODS = [
  { id: 'mes', label: 'Este mes', months: 0 },
  { id: '3m', label: 'Últimos 3 meses', months: 2 },
  { id: '6m', label: 'Últimos 6 meses', months: 5 },
  { id: '12m', label: 'Últimos 12 meses', months: 11 },
]

function pctClass(p: number | null) {
  if (p == null) return 'text-muted-foreground'
  return p < 0 ? 'text-destructive' : p < 30 ? 'text-warning' : 'text-success'
}

export function ReportsTab() {
  const inv = useInvoices()
  const exp = useExpenses()
  const fx = useFx()
  const projects = useQuery({ queryKey: ['projects', {}], queryFn: () => listProjects() })
  const [period, setPeriod] = useState('3m')

  const error = inv.error ?? exp.error ?? projects.error
  if (error) return <ErrorState error={error} onRetry={() => void inv.refetch()} />
  if (inv.isLoading || exp.isLoading || projects.isLoading) return <Skeleton className="h-64" />

  const thisMonth = todayMvd().slice(0, 7)
  const months = PERIODS.find((p) => p.id === period)!.months
  const from = `${addMonthsKey(thisMonth, -months)}-01`
  const to = `${thisMonth}-31`
  const clients = byClient(inv.data ?? [], exp.data ?? [], from, to)
  const totals = clients.reduce((s, r) => ({ billed: s.billed + r.billed, collected: s.collected + r.collected, expenses: s.expenses + r.expenses, margin: s.margin + r.margin }), { billed: 0, collected: 0, expenses: 0, margin: 0 })
  const projs = byProject(
    (projects.data ?? []).map((p) => ({ id: p.id!, name: p.name!, client_name: p.client_name ?? '', budget: p.budget, currency: p.currency ?? 'UYU', status: p.status ?? '' })),
    inv.data ?? [],
    exp.data ?? [],
    fx.data ?? null,
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Rentabilidad por cliente</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">Facturado menos los gastos que cargaste a ese cliente. Todo en pesos.</p>
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-48" aria-label="Período"><SelectValue /></SelectTrigger>
            <SelectContent>{PERIODS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {!clients.length ? (
            <p className="text-sm text-muted-foreground">No hay cobros en este período.</p>
          ) : (
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 font-medium">Cliente</th>
                  <th className="py-2 text-right font-medium">Facturado</th>
                  <th className="py-2 text-right font-medium">Cobrado</th>
                  <th className="py-2 text-right font-medium">Gastos</th>
                  <th className="py-2 text-right font-medium">Ganancia</th>
                  <th className="py-2 text-right font-medium">Margen</th>
                </tr>
              </thead>
              <tbody className="divide-y tabular-nums">
                {clients.map((r) => (
                  <tr key={r.clientId}>
                    <td className="py-2.5"><Link to={`/clientes/${r.clientId}`} className="hover:text-brand"><ClientChip name={r.clientName} color={r.color} /></Link></td>
                    <td className="py-2.5 text-right">{formatMoney(r.billed)}</td>
                    <td className="py-2.5 text-right">{formatMoney(r.collected)}</td>
                    <td className="py-2.5 text-right">{formatMoney(r.expenses)}</td>
                    <td className={cn('py-2.5 text-right font-semibold', r.margin < 0 && 'text-destructive')}>{formatMoney(r.margin)}</td>
                    <td className={cn('py-2.5 text-right font-semibold', pctClass(r.marginPct))}>{r.marginPct == null ? '—' : `${r.marginPct}%`}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t font-bold tabular-nums">
                  <td className="py-2.5">Total</td>
                  <td className="py-2.5 text-right">{formatMoney(totals.billed)}</td>
                  <td className="py-2.5 text-right">{formatMoney(totals.collected)}</td>
                  <td className="py-2.5 text-right">{formatMoney(totals.expenses)}</td>
                  <td className="py-2.5 text-right">{formatMoney(totals.margin)}</td>
                  <td className="py-2.5 text-right">{totals.billed ? `${Math.round((totals.margin / totals.billed) * 100)}%` : '—'}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rentabilidad por proyecto</CardTitle>
          <p className="text-xs text-muted-foreground">Todo el historial de cada proyecto: cuánto del presupuesto ya se facturó y cuánto se gastó.</p>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {!projs.length ? (
            <p className="text-sm text-muted-foreground">Asociá cobros o gastos a un proyecto para verlo acá.</p>
          ) : (
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 font-medium">Proyecto</th>
                  <th className="py-2 text-right font-medium">Presupuesto</th>
                  <th className="py-2 pl-6 font-medium">Facturado</th>
                  <th className="py-2 text-right font-medium">Gastos</th>
                  <th className="py-2 text-right font-medium">Ganancia</th>
                </tr>
              </thead>
              <tbody className="divide-y tabular-nums">
                {projs.map((p) => (
                  <tr key={p.projectId}>
                    <td className="py-2.5">
                      <Link to={`/proyectos/${p.projectId}`} className="font-medium hover:text-brand">{p.projectName}</Link>
                      <span className="block text-xs text-muted-foreground">{p.clientName}</span>
                    </td>
                    <td className="py-2.5 text-right">{p.budget == null ? '—' : formatMoney(p.budget)}</td>
                    <td className="w-56 py-2.5 pl-6">
                      <span className="block">{formatMoney(p.billed)}{p.billedPct != null && <span className="ml-1 text-xs text-muted-foreground">({p.billedPct}%)</span>}</span>
                      {p.billedPct != null && (
                        <span className="mt-1 block h-1.5 w-full max-w-40 rounded-full bg-muted"><span className="block h-1.5 rounded-full bg-brand" style={{ width: `${Math.min(100, p.billedPct)}%` }} /></span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">{formatMoney(p.expenses)}</td>
                    <td className={cn('py-2.5 text-right font-semibold', p.margin < 0 && 'text-destructive')}>{formatMoney(p.margin)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
