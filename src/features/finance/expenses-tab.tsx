import { useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Receipt, Repeat, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { friendlyError } from '@/data/api'
import { deleteExpense, type Expense } from '@/data/finance'
import { formatDate, formatMoney } from '@/lib/format'
import { ExpenseDialog, invalidateFinance } from './dialogs'
import { Money, categoryColor, categoryLabel } from './finance-ui'
import { monthShort } from './reports'
import { useExpenses } from './use-finance'

export function ExpensesTab() {
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useExpenses()
  const [editing, setEditing] = useState<{ expense?: Expense | null; recurring?: boolean } | null>(null)
  const [deleting, setDeleting] = useState<Expense | null>(null)

  const templates = (data ?? []).filter((e) => e.is_recurring)
  const groups = useMemo(() => {
    const m = new Map<string, Expense[]>()
    ;(data ?? []).filter((e) => !e.is_recurring).forEach((e) => m.set(e.date.slice(0, 7), [...(m.get(e.date.slice(0, 7)) ?? []), e]))
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [data])

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />
  if (isLoading) return <Skeleton className="h-64" />

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem] [&>*]:min-w-0">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Button onClick={() => setEditing({})}><Plus /> Nuevo gasto</Button>
        </div>
        {!groups.length ? (
          <Card><EmptyState compact icon={Receipt} title="Sin gastos registrados" description="Cargá lo que gastás en software, equipos, publicidad o freelancers para ver cuánto te queda." /></Card>
        ) : (
          groups.map(([month, items]) => {
            const total = items.reduce((s, e) => s + Number(e.amount) * Number(e.fx_rate), 0)
            return (
              <section key={month}>
                <div className="mb-2 flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold capitalize">{monthShort(month)}</h3>
                  <span className="text-sm font-semibold tabular-nums">{formatMoney(total)}</span>
                </div>
                <Card className="divide-y">
                  {items.map((e) => (
                    <div key={e.id} className="group flex items-center gap-3 px-4 py-3">
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: categoryColor[e.category] }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {e.description}
                          {e.parent_expense_id && <Repeat className="ml-1.5 inline size-3.5 text-muted-foreground" aria-label="Recurrente" />}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{[formatDate(e.date), categoryLabel[e.category], e.client_name, e.project_name].filter(Boolean).join(' · ')}</p>
                      </div>
                      <Money amount={e.amount} currency={e.currency} fx={e.fx_rate} className="text-right text-sm font-semibold" />
                      <span className="flex opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                        <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditing({ expense: e })} aria-label="Editar"><Pencil /></Button>
                        <Button size="icon" variant="ghost" className="size-8" onClick={() => setDeleting(e)} aria-label="Borrar"><Trash2 /></Button>
                      </span>
                    </div>
                  ))}
                </Card>
              </section>
            )
          })
        )}
      </div>

      <Card className="h-fit">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2"><Repeat className="size-4 text-brand" /> Gastos fijos del mes</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setEditing({ recurring: true })}><Plus /> Agregar</Button>
        </CardHeader>
        <CardContent>
          {!templates.length ? (
            <p className="text-sm text-muted-foreground">Suscripciones y gastos que se repiten (Adobe, hosting…). Se registran solos cada mes.</p>
          ) : (
            <ul className="divide-y">
              {templates.map((t) => (
                <li key={t.id} className="group flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.description}</p>
                    <p className="text-xs text-muted-foreground">Día {t.recurrence_day} de cada mes</p>
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatMoney(t.amount, t.currency)}</span>
                  <span className="flex opacity-0 group-hover:opacity-100 focus-within:opacity-100">
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => setEditing({ expense: t })} aria-label="Editar"><Pencil /></Button>
                    <Button size="icon" variant="ghost" className="size-8" onClick={() => setDeleting(t)} aria-label="Dejar de repetir"><Trash2 /></Button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {templates.length > 0 && (
            <p className="mt-3 border-t pt-3 text-sm">
              Total fijo por mes:{' '}
              <strong className="tabular-nums">{formatMoney(templates.reduce((s, t) => s + Number(t.amount) * (t.currency === 'USD' ? Number(t.fx_rate) : 1), 0))}</strong>
              <Badge variant="neutral" className="ml-2">aprox.</Badge>
            </p>
          )}
        </CardContent>
      </Card>

      <ExpenseDialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)} expense={editing?.expense} recurring={editing?.recurring} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={deleting?.is_recurring ? `¿Dejar de registrar "${deleting?.description}" cada mes?` : `¿Borrar "${deleting?.description}"?`}
        description={deleting?.is_recurring ? 'Los gastos de meses anteriores quedan registrados.' : undefined}
        confirmLabel={deleting?.is_recurring ? 'Dejar de repetir' : 'Borrar'}
        destructive
        onConfirm={async () => {
          try {
            await deleteExpense(deleting!.id)
            invalidateFinance(qc)
          } catch (e) {
            toast.error(friendlyError(e))
          }
        }}
      />
    </div>
  )
}
