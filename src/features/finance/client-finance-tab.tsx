import { Repeat } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { formatMoney, todayMvd } from '@/lib/format'
import { countable } from './reports'
import { FeesTab } from './fees-tab'
import { InvoicesTab } from './invoices-tab'
import { QuotesTab } from './quotes-tab'
import { useInvoices } from './use-finance'

/** Pestaña Finanzas en la ficha del cliente (solo admin). */
export function ClientFinanceTab({ clientId }: { clientId: string }) {
  const { data } = useInvoices(clientId)
  const rows = (data ?? []).filter(countable)
  const sum = (f: (i: (typeof rows)[number]) => boolean) => rows.filter(f).reduce((s, i) => s + Number(i.total) * Number(i.fx_rate), 0)
  const year = todayMvd().slice(0, 4)
  const stats = [
    { label: `Facturado en ${year}`, value: sum((i) => i.issue_date.startsWith(year)) },
    { label: 'Cobrado en total', value: sum((i) => i.status === 'cobrado') },
    { label: 'Por cobrar', value: sum((i) => i.status === 'pendiente' || i.status === 'vencido'), danger: rows.some((i) => i.status === 'vencido') },
  ]
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className={`mt-1 text-xl font-bold tabular-nums ${s.danger ? 'text-destructive' : ''}`}>{formatMoney(s.value)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <section>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Repeat className="size-4 text-brand" /> Fee mensual</h3>
        <FeesTab clientId={clientId} />
      </section>
      <section>
        <h3 className="mb-3 text-sm font-semibold">Cobros</h3>
        <InvoicesTab clientId={clientId} compact />
      </section>
      <section>
        <h3 className="mb-3 text-sm font-semibold">Presupuestos</h3>
        <QuotesTab clientId={clientId} />
      </section>
    </div>
  )
}
