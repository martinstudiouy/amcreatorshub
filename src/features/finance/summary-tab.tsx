import { AlertTriangle, ArrowDownRight, ArrowUpRight, CircleDollarSign, HandCoins, Receipt, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorState } from '@/components/common/error-state'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { defaultVatRate, type ExpenseCategory } from '@/data/finance'
import { formatMoney, todayMvd } from '@/lib/format'
import { cn } from '@/lib/utils'
import { BarChart, categoryColor, categoryLabel } from './finance-ui'
import { addMonthsKey, expensesByCategory, monthShort, monthlySeries, projection, receivables } from './reports'
import { useExpenses, useFees, useFx, useInvoices } from './use-finance'

const BRAND = '#0300FF'
const NAVY = '#020061'
const GREY = 'var(--color-muted-foreground)'

function Kpi({ label, value, hint, icon: Icon, tone }: { label: string; value: string; hint?: React.ReactNode; icon: typeof TrendingUp; tone?: 'danger' | 'success' }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{label}</p>
          <span className={cn('flex size-8 items-center justify-center rounded-lg bg-brand/10 text-brand', tone === 'danger' && 'bg-destructive/10 text-destructive')}>
            <Icon className="size-4" />
          </span>
        </div>
        <p className={cn('mt-2 text-2xl font-bold tracking-tight tabular-nums', tone === 'danger' && 'text-destructive')}>{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function Delta({ now, before }: { now: number; before: number }) {
  if (!before) return null
  const pct = Math.round(((now - before) / Math.abs(before)) * 100)
  const up = pct >= 0
  return (
    <span className={cn('inline-flex items-center font-medium', up ? 'text-success' : 'text-destructive')}>
      {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
      {Math.abs(pct)}%
    </span>
  )
}

export function SummaryTab({ onGo }: { onGo: (tab: string) => void }) {
  const inv = useInvoices()
  const exp = useExpenses()
  const fees = useFees()
  const fx = useFx()
  const [vat, setVat] = useState(0)
  useEffect(() => void defaultVatRate().then(setVat), [])

  const error = inv.error ?? exp.error ?? fees.error
  if (error) return <ErrorState error={error} onRetry={() => { void inv.refetch(); void exp.refetch(); void fees.refetch() }} />
  if (inv.isLoading || exp.isLoading || fees.isLoading) return <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}</div>

  const invoices = inv.data ?? []
  const expenses = exp.data ?? []
  const thisMonth = todayMvd().slice(0, 7)
  const series = monthlySeries(invoices, expenses, thisMonth, 6)
  const cur = series[series.length - 1]
  const prev = series[series.length - 2]
  const recv = receivables(invoices)
  const proj = projection(fees.data ?? [], invoices, expenses, thisMonth, fx.data ?? null, vat, 3)
  const cats = expensesByCategory(expenses, `${addMonthsKey(thisMonth, -2)}-01`, `${thisMonth}-31`)
  const catMax = Math.max(1, ...cats.map((c) => c.total))
  const noUsdRate = !fx.data && (fees.data ?? []).some((f) => f.currency === 'USD')

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label={`Facturado en ${monthShort(thisMonth)}`} value={formatMoney(cur.billed)} icon={TrendingUp} hint={<><Delta now={cur.billed} before={prev.billed} /> {prev.billed ? 'vs. mes pasado' : 'Cobros emitidos este mes'}</>} />
        <Kpi label="Cobrado este mes" value={formatMoney(cur.collected)} icon={HandCoins} hint="La plata que ya entró." />
        <Kpi label="Gastos del mes" value={formatMoney(cur.expenses)} icon={Receipt} hint={<>Resultado: <strong className={cn(cur.result < 0 ? 'text-destructive' : 'text-foreground')}>{formatMoney(cur.result)}</strong></>} />
        <button className="text-left" onClick={() => onGo('cobros')}>
          <Kpi
            label="Por cobrar"
            value={formatMoney(recv.pending + recv.overdue)}
            icon={recv.overdueCount ? AlertTriangle : CircleDollarSign}
            tone={recv.overdueCount ? 'danger' : undefined}
            hint={recv.overdueCount ? <span className="text-destructive">{recv.overdueCount} vencido{recv.overdueCount > 1 ? 's' : ''} por {formatMoney(recv.overdue)}</span> : `${recv.pendingCount} pendiente${recv.pendingCount === 1 ? '' : 's'}, nada vencido`}
          />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_24rem] [&>*]:min-w-0">
        <Card>
          <CardHeader><CardTitle>Últimos 6 meses</CardTitle></CardHeader>
          <CardContent>
            <BarChart
              categories={series.map((s) => monthShort(s.month))}
              series={[
                { label: 'Facturado', color: BRAND, values: series.map((s) => s.billed) },
                { label: 'Cobrado', color: NAVY, values: series.map((s) => s.collected) },
                { label: 'Gastos', color: GREY, values: series.map((s) => s.expenses) },
              ]}
              format={(n) => formatMoney(n)}
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1.5 font-medium">Mes</th><th className="py-1.5 text-right font-medium">Facturado</th><th className="py-1.5 text-right font-medium">Cobrado</th><th className="py-1.5 text-right font-medium">Gastos</th><th className="py-1.5 text-right font-medium">Resultado</th></tr></thead>
                <tbody className="divide-y tabular-nums">
                  {[...series].reverse().map((s) => (
                    <tr key={s.month}>
                      <td className="py-1.5 capitalize">{monthShort(s.month)}</td>
                      <td className="py-1.5 text-right">{formatMoney(s.billed)}</td>
                      <td className="py-1.5 text-right">{formatMoney(s.collected)}</td>
                      <td className="py-1.5 text-right">{formatMoney(s.expenses)}</td>
                      <td className={cn('py-1.5 text-right font-semibold', s.result < 0 && 'text-destructive')}>{formatMoney(s.result)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Proyección próximos 3 meses</CardTitle>
              <p className="text-xs text-muted-foreground">Fees mensuales + cobros pendientes que vencen ese mes − gastos fijos.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {proj.map((p) => (
                <div key={p.month} className="rounded-lg border p-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold capitalize">{monthShort(p.month)}</span>
                    <span className={cn('text-lg font-bold tabular-nums', p.result < 0 ? 'text-destructive' : 'text-brand')}>{formatMoney(p.result)}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                    Fees {formatMoney(p.fees)}{p.receivables ? ` · pendientes ${formatMoney(p.receivables)}` : ''} · gastos fijos −{formatMoney(p.expenses)}
                  </p>
                </div>
              ))}
              {noUsdRate && (
                <p className="text-xs text-destructive">
                  Hay fees en dólares y falta el tipo de cambio. <Link to="/configuracion?tab=tipo-de-cambio" className="underline">Cargalo acá</Link>.
                </p>
              )}
              {!fees.data?.length && (
                <p className="text-xs text-muted-foreground">
                  Cargá los <button className="font-medium text-brand underline-offset-2 hover:underline" onClick={() => onGo('fees')}>fees mensuales</button> para que la proyección sea real.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Gastos por categoría</CardTitle><p className="text-xs text-muted-foreground">Últimos 3 meses</p></CardHeader>
            <CardContent>
              {!cats.length ? (
                <p className="text-sm text-muted-foreground">Sin gastos cargados.</p>
              ) : (
                <ul className="space-y-3">
                  {cats.map((c) => (
                    <li key={c.category}>
                      <div className="mb-1 flex justify-between text-sm"><span>{categoryLabel[c.category as ExpenseCategory]}</span><span className="font-semibold tabular-nums">{formatMoney(c.total)}</span></div>
                      <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full" style={{ width: `${(c.total / catMax) * 100}%`, background: categoryColor[c.category as ExpenseCategory] }} /></div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
