import { useQueryClient } from '@tanstack/react-query'
import { ArrowRightLeft, Check, Ellipsis, FileDown, FileText, Pencil, Plus, Send, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ClientChip } from '@/components/common/client-chip'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { friendlyError } from '@/data/api'
import { getClient } from '@/data/crm'
import { deleteQuote, quoteToInvoice, updateQuote, type Quote } from '@/data/finance'
import { formatDate } from '@/lib/format'
import { QuoteDialog, invalidateFinance } from './dialogs'
import { Money, QuoteBadge } from './finance-ui'
import { downloadPdf, quoteToPdf } from './pdf/download'
import { useQuotes } from './use-finance'

export function QuotesTab({ clientId }: { clientId?: string }) {
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useQuotes(clientId)
  const [editing, setEditing] = useState<Quote | null | undefined>(undefined)
  const [converting, setConverting] = useState<Quote | null>(null)
  const [deleting, setDeleting] = useState<Quote | null>(null)

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn()
      invalidateFinance(qc)
      toast.success(ok)
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }
  const pdf = async (q: Quote) => {
    const id = toast.loading('Armando el PDF…')
    try {
      const c = await getClient(q.client_id)
      await downloadPdf(quoteToPdf(q, { brand_name: q.client_name, name: c?.name, email: c?.email, whatsapp: c?.whatsapp }))
      toast.success('PDF listo.', { id })
    } catch (e) {
      toast.error(friendlyError(e), { id })
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Borrador → Enviado → Aceptado (se convierte en cobro) o Rechazado.</p>
        <Button onClick={() => setEditing(null)} className="shrink-0"><Plus /> Nuevo presupuesto</Button>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-48" />
      ) : !data?.length ? (
        <Card><EmptyState compact icon={FileText} title="Todavía no hay presupuestos" description="Armá uno con tus servicios y descargalo en PDF con tu marca." /></Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">Número</th>
                {!clientId && <th className="px-4 py-3 font-medium">Cliente</th>}
                <th className="px-4 py-3 font-medium">Concepto</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Válido hasta</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((q) => (
                <tr key={q.id} className="hover:bg-muted/40">
                  <td className="px-4 py-3 font-medium tabular-nums"><button className="hover:text-brand" onClick={() => setEditing(q)}>{q.number}</button></td>
                  {!clientId && <td className="px-4 py-3"><ClientChip name={q.client_name} color={q.client_color} /></td>}
                  <td className="max-w-56 truncate px-4 py-3">{q.items[0]?.description ?? '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{formatDate(q.issue_date)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatDate(q.valid_until) || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold"><Money amount={q.total} currency={q.currency} fx={q.fx_rate} /></td>
                  <td className="px-4 py-3"><QuoteBadge status={q.status} /></td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1">
                      {(q.status === 'enviado' || q.status === 'borrador' || q.status === 'vencido') && (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => setConverting(q)}><Check /> <span className="hidden lg:inline">Aceptado</span></Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="size-8" aria-label={`Acciones de ${q.number}`}><Ellipsis /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => void pdf(q)}><FileDown /> Descargar PDF</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => setEditing(q)}><Pencil /> Editar</DropdownMenuItem>
                          {q.status === 'borrador' && <DropdownMenuItem onSelect={() => void run(() => updateQuote(q.id, { status: 'enviado' }), 'Marcado como enviado.')}><Send /> Marcar enviado</DropdownMenuItem>}
                          {q.status !== 'rechazado' && q.status !== 'aceptado' && <DropdownMenuItem onSelect={() => void run(() => updateQuote(q.id, { status: 'rechazado' }), 'Marcado como rechazado.')}><X /> Rechazado</DropdownMenuItem>}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onSelect={() => setDeleting(q)}><Trash2 /> Borrar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <QuoteDialog open={editing !== undefined} onOpenChange={(o) => !o && setEditing(undefined)} quote={editing} defaultClientId={clientId} />
      <ConfirmDialog
        open={!!converting}
        onOpenChange={(o) => !o && setConverting(null)}
        title={`¿${converting?.client_name} aceptó el presupuesto?`}
        description={<><ArrowRightLeft className="mr-1 inline size-4" />Se crea un cobro pendiente con los mismos ítems y el presupuesto queda como aceptado.</>}
        confirmLabel="Sí, crear el cobro"
        onConfirm={() => run(() => quoteToInvoice(converting!), 'Cobro creado. Lo ves en la pestaña Cobros.')}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`¿Borrar ${deleting?.number}?`}
        confirmLabel="Borrar"
        destructive
        onConfirm={() => run(() => deleteQuote(deleting!.id), 'Presupuesto borrado.')}
      />
    </>
  )
}
