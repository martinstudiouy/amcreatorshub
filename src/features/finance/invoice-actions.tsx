import { useQueryClient } from '@tanstack/react-query'
import { Ban, CheckCircle2, Ellipsis, FileDown, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { friendlyError } from '@/data/api'
import { getClient } from '@/data/crm'
import { deleteInvoice, updateInvoice, type Invoice } from '@/data/finance'
import { invalidateFinance } from './dialogs'
import { downloadPdf, invoiceToPdf } from './pdf/download'

export async function downloadInvoicePdf(i: Invoice) {
  const id = toast.loading('Armando el PDF…')
  try {
    const c = await getClient(i.client_id)
    await downloadPdf(invoiceToPdf(i, { brand_name: i.client_name, name: c?.name, email: c?.email, whatsapp: c?.whatsapp }))
    toast.success('PDF listo.', { id })
  } catch (e) {
    toast.error(friendlyError(e), { id })
  }
}

/** Menú de acciones de un cobro. */
export function InvoiceActions({ invoice, onEdit, onPaid }: { invoice: Invoice; onEdit: () => void; onPaid: () => void }) {
  const qc = useQueryClient()
  const [confirm, setConfirm] = useState<'anular' | 'borrar' | null>(null)
  const run = async (fn: () => Promise<void>, ok: string) => {
    try {
      await fn()
      invalidateFinance(qc)
      toast.success(ok)
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }
  const open = invoice.status === 'pendiente' || invoice.status === 'vencido'
  return (
    <>
      <div className="flex items-center justify-end gap-1">
        {open && (
          <Button size="sm" variant="outline" className="h-8" onClick={onPaid}>
            <CheckCircle2 /> <span className="hidden lg:inline">Cobrado</span>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8" aria-label={`Acciones de ${invoice.number}`}><Ellipsis /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void downloadInvoicePdf(invoice)}><FileDown /> Descargar PDF</DropdownMenuItem>
            {invoice.status !== 'anulado' && <DropdownMenuItem onSelect={onEdit}><Pencil /> Editar</DropdownMenuItem>}
            {invoice.status === 'cobrado' && (
              <DropdownMenuItem onSelect={() => void run(() => updateInvoice(invoice.id, { status: 'pendiente', payment_method: null }), 'Volvió a pendiente.')}><RotateCcw /> Volver a pendiente</DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {invoice.status !== 'anulado' && <DropdownMenuItem onSelect={() => setConfirm('anular')}><Ban /> Anular</DropdownMenuItem>}
            <DropdownMenuItem className="text-destructive" onSelect={() => setConfirm('borrar')}><Trash2 /> Borrar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm === 'anular' ? `¿Anular ${invoice.number}?` : `¿Borrar ${invoice.number}?`}
        description={confirm === 'anular' ? 'Queda en la lista como anulado y deja de contar en los totales.' : 'Va a la papelera y deja de contar en los totales.'}
        confirmLabel={confirm === 'anular' ? 'Anular' : 'Borrar'}
        destructive
        onConfirm={() => (confirm === 'anular' ? run(() => updateInvoice(invoice.id, { status: 'anulado' }), 'Cobro anulado.') : run(() => deleteInvoice(invoice.id), 'Cobro borrado.'))}
      />
    </>
  )
}
