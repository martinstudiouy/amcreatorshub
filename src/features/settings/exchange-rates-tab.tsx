import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Coins, LoaderCircle, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { deleteExchangeRate, friendlyError, listExchangeRates, upsertExchangeRate } from '@/data/api'
import { formatDate, formatMoney, todayMvd } from '@/lib/format'
import { Field } from './field'

export function ExchangeRatesTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['exchange-rates'], queryFn: listExchangeRates })
  const [date, setDate] = useState(todayMvd())
  const [rate, setRate] = useState('')
  const [note, setNote] = useState('')

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['exchange-rates'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
  const save = useMutation({
    mutationFn: upsertExchangeRate,
    onSuccess: () => {
      toast.success('Tipo de cambio guardado.')
      setRate('')
      setNote('')
      invalidate()
    },
    onError: (e) => toast.error(friendlyError(e)),
  })
  const remove = useMutation({ mutationFn: deleteExchangeRate, onSuccess: invalidate, onError: (e) => toast.error(friendlyError(e)) })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const n = Number(rate.replace(',', '.'))
    if (!n || n <= 0) return toast.error('Escribí un tipo de cambio válido, por ejemplo 39,80.')
    save.mutate({ date, usd_to_uyu: n, note: note.trim() || null })
  }

  const current = data?.[0]

  return (
    <div className="grid gap-6 lg:grid-cols-[22rem_1fr]">
      <div className="space-y-6">
        <Card className="p-5">
          <p className="text-sm text-muted-foreground">Tipo de cambio vigente</p>
          {isLoading ? (
            <Skeleton className="mt-2 h-8 w-32" />
          ) : current ? (
            <>
              <p className="mt-1 text-2xl font-bold tabular-nums">US$ 1 = {formatMoney(current.usd_to_uyu, 'UYU', { decimals: true })}</p>
              <p className="mt-1 text-xs text-muted-foreground">Cargado para el {formatDate(current.date)}</p>
            </>
          ) : (
            <p className="mt-1 text-sm">Todavía no cargaste ninguno.</p>
          )}
        </Card>
        {canEdit && (
          <Card>
            <CardHeader>
              <CardTitle>Cargar tipo de cambio</CardTitle>
              <CardDescription>Cada cobro y gasto en dólares guarda el valor del día en que se registra, así los reportes viejos no cambian.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <Field id="fx-date" label="Fecha"><Input id="fx-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayMvd()} /></Field>
                <Field id="fx-rate" label="Pesos por 1 dólar"><Input id="fx-rate" inputMode="decimal" placeholder="39,80" value={rate} onChange={(e) => setRate(e.target.value)} /></Field>
                <Field id="fx-note" label="Nota (opcional)"><Input id="fx-note" placeholder="Ej: BROU venta" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
                <Button type="submit" disabled={save.isPending || !rate}>
                  {save.isPending && <LoaderCircle className="animate-spin" />}
                  Guardar
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Historial</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : isLoading ? (
            <div className="space-y-2"><Skeleton className="h-9" /><Skeleton className="h-9" /></div>
          ) : !data?.length ? (
            <EmptyState compact icon={Coins} title="Sin tipos de cambio" description={canEdit ? 'Cargá el primero con el formulario.' : 'Un admin tiene que cargar el primero.'} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="pb-2 font-medium">Fecha</th>
                    <th className="pb-2 font-medium">US$ 1 =</th>
                    <th className="pb-2 font-medium">Nota</th>
                    {canEdit && <th className="w-10 pb-2" />}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 tabular-nums">{formatDate(r.date)}</td>
                      <td className="py-2.5 font-medium tabular-nums">{formatMoney(r.usd_to_uyu, 'UYU', { decimals: true })}</td>
                      <td className="py-2.5 text-muted-foreground">{r.note}</td>
                      {canEdit && (
                        <td className="py-1.5 text-right">
                          <Button variant="ghost" size="icon" aria-label="Borrar" onClick={() => remove.mutate(r.id)}>
                            <Trash2 className="text-muted-foreground" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
