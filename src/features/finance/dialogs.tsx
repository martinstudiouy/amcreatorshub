import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { friendlyError } from '@/data/api'
import { listClients, listProjects } from '@/data/crm'
import {
  defaultVatRate,
  itemsSubtotal,
  saveExpense,
  saveFee,
  saveInvoice,
  saveQuote,
  updateInvoice,
  type Currency,
  type Expense,
  type ExpenseCategory,
  type Fee,
  type Invoice,
  type LineItem,
  type Quote,
} from '@/data/finance'
import { addDays, todayMvd } from '@/lib/format'
import { AmountInput, CATEGORIES, ItemsEditor, PAYMENT_METHODS, TotalsBox, categoryLabel } from './finance-ui'

export function invalidateFinance(qc: ReturnType<typeof useQueryClient>) {
  for (const k of ['invoices', 'quotes', 'expenses', 'fees', 'dashboard', 'client']) void qc.invalidateQueries({ queryKey: [k] })
}

function Field({ label, htmlFor, hint, children, className }: { label: string; htmlFor?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function CurrencySelect({ value, onChange, id }: { value: Currency; onChange: (c: Currency) => void; id?: string }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Currency)}>
      <SelectTrigger id={id}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="UYU">Pesos ($)</SelectItem>
        <SelectItem value="USD">Dólares (US$)</SelectItem>
      </SelectContent>
    </Select>
  )
}

function ClientProjectFields({ clientId, projectId, onClient, onProject, projectOptional = true }: { clientId: string; projectId: string; onClient: (v: string) => void; onProject: (v: string) => void; projectOptional?: boolean }) {
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: listClients })
  const { data: projects } = useQuery({ queryKey: ['projects', {}], queryFn: () => listProjects() })
  const options = (projects ?? []).filter((p) => p.client_id === clientId)
  return (
    <>
      <Field label="Cliente *" htmlFor="fin-client">
        <Select value={clientId} onValueChange={(v) => { onClient(v); onProject('none') }}>
          <SelectTrigger id="fin-client"><SelectValue placeholder="Elegí un cliente" /></SelectTrigger>
          <SelectContent>{clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.brand_name}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <Field label={projectOptional ? 'Proyecto (opcional)' : 'Proyecto'} htmlFor="fin-project">
        <Select value={projectId} onValueChange={onProject} disabled={!clientId}>
          <SelectTrigger id="fin-project"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin proyecto</SelectItem>
            {options.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
    </>
  )
}

const cleanItems = (items: LineItem[]) => items.filter((i) => i.description.trim() && i.quantity !== 0).map((i) => ({ ...i, description: i.description.trim() }))

// ================================================================ Cobro
export function InvoiceDialog({ open, onOpenChange, invoice, defaultClientId }: { open: boolean; onOpenChange: (o: boolean) => void; invoice?: Invoice | null; defaultClientId?: string }) {
  const qc = useQueryClient()
  const [f, setF] = useState<{ client_id: string; project_id: string; issue_date: string; due_date: string; currency: Currency; vat: boolean; vatRate: number; notes: string; cfe: string; items: LineItem[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (invoice) {
      setF({
        client_id: invoice.client_id, project_id: invoice.project_id ?? 'none', issue_date: invoice.issue_date, due_date: invoice.due_date ?? '',
        currency: invoice.currency, vat: Number(invoice.vat_rate) > 0, vatRate: Number(invoice.vat_rate) || 22, notes: invoice.notes ?? '', cfe: invoice.cfe_number ?? '',
        items: invoice.items.map((i) => ({ description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })),
      })
    } else {
      const today = todayMvd()
      setF({ client_id: defaultClientId ?? '', project_id: 'none', issue_date: today, due_date: addDays(today, 10), currency: 'UYU', vat: false, vatRate: 22, notes: '', cfe: '', items: [{ description: '', quantity: 1, unit_price: 0 }] })
      void defaultVatRate().then((r) => r > 0 && setF((x) => (x ? { ...x, vat: true, vatRate: r } : x)))
    }
  }, [open, invoice, defaultClientId])

  const save = useMutation({
    mutationFn: () =>
      saveInvoice(
        {
          client_id: f!.client_id, project_id: f!.project_id === 'none' ? null : f!.project_id, issue_date: f!.issue_date, due_date: f!.due_date || null,
          currency: f!.currency, vat_rate: f!.vat ? f!.vatRate : 0, notes: f!.notes.trim() || null, cfe_number: f!.cfe.trim() || null, items: cleanItems(f!.items),
        },
        invoice?.id,
      ),
    onSuccess: () => {
      toast.success(invoice ? 'Cobro actualizado.' : 'Cobro creado.')
      invalidateFinance(qc)
      onOpenChange(false)
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  if (!f) return null
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => (x ? { ...x, [k]: v } : x))
  const subtotal = itemsSubtotal(cleanItems(f.items))

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!f!.client_id) return setError('Elegí el cliente.')
    if (!cleanItems(f!.items).length) return setError('Agregá al menos una línea con concepto y precio.')
    if (f!.due_date && f!.due_date < f!.issue_date) return setError('La fecha límite no puede ser antes de la emisión.')
    setError(null)
    save.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[4vh] max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogTitle>{invoice ? `Editar cobro ${invoice.number ?? ''}` : 'Nuevo cobro'}</DialogTitle>
        <DialogDescription className="mt-1">Lo que le cobrás a un cliente: un fee, un anticipo o un proyecto. El número se asigna solo.</DialogDescription>
        <form onSubmit={onSubmit} className="mt-6 space-y-6" noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <ClientProjectFields clientId={f.client_id} projectId={f.project_id} onClient={(v) => set('client_id', v)} onProject={(v) => set('project_id', v)} />
            <Field label="Fecha de emisión" htmlFor="inv-issue"><Input id="inv-issue" type="date" value={f.issue_date} onChange={(e) => set('issue_date', e.target.value)} /></Field>
            <Field label="Fecha límite de pago" htmlFor="inv-due" hint="Si pasa sin cobrarse, se marca vencido solo."><Input id="inv-due" type="date" value={f.due_date} onChange={(e) => set('due_date', e.target.value)} /></Field>
            <Field label="Moneda" htmlFor="inv-cur" hint={f.currency === 'USD' ? 'Se guarda con el tipo de cambio de la fecha de emisión.' : undefined}><CurrencySelect id="inv-cur" value={f.currency} onChange={(c) => set('currency', c)} /></Field>
            <Field label="IVA">
              <span className="flex h-10 items-center gap-2">
                <Checkbox id="inv-vat" checked={f.vat} onCheckedChange={(v) => set('vat', v === true)} />
                <Label htmlFor="inv-vat" className="font-normal">Sumar IVA ({f.vatRate}%)</Label>
              </span>
            </Field>
          </div>
          <ItemsEditor items={f.items} onChange={(items) => set('items', items)} currency={f.currency} />
          <TotalsBox subtotal={subtotal} vatRate={f.vat ? f.vatRate : 0} currency={f.currency} />
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Notas (salen en el PDF)" htmlFor="inv-notes"><Textarea id="inv-notes" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Datos para transferir, condiciones…" /></Field>
            <Field label="N.º de factura electrónica (CFE)" htmlFor="inv-cfe" hint="La factura oficial la emitís en tu proveedor de e-factura; anotá acá su número.">
              <Input id="inv-cfe" value={f.cfe} onChange={(e) => set('cfe', e.target.value)} placeholder="Ej: A-104233" />
            </Field>
          </div>
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 border-t pt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending && <LoaderCircle className="animate-spin" />}{invoice ? 'Guardar' : 'Crear cobro'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ================================================================ Marcar cobrado
export function PaidDialog({ invoice, onOpenChange }: { invoice: Invoice | null; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient()
  const [date, setDate] = useState(todayMvd())
  const [method, setMethod] = useState('Transferencia')
  useEffect(() => {
    if (invoice) {
      setDate(todayMvd())
      setMethod('Transferencia')
    }
  }, [invoice])
  const save = useMutation({
    mutationFn: () => updateInvoice(invoice!.id, { status: 'cobrado', paid_at: new Date(`${date}T12:00:00-03:00`).toISOString(), payment_method: method }),
    onSuccess: () => {
      toast.success(`¡Listo! ${invoice?.number ?? 'El cobro'} quedó como cobrado.`)
      invalidateFinance(qc)
      onOpenChange(false)
    },
    onError: (e) => toast.error(friendlyError(e)),
  })
  return (
    <Dialog open={!!invoice} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogTitle>Marcar como cobrado</DialogTitle>
        <p className="mt-1 text-sm text-muted-foreground">{invoice?.number} · {invoice?.client_name}</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Fecha de cobro" htmlFor="paid-date"><Input id="paid-date" type="date" value={date} max={todayMvd()} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Forma de pago" htmlFor="paid-method">
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger id="paid-method"><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending && <LoaderCircle className="animate-spin" />}Marcar cobrado</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ================================================================ Presupuesto
export function QuoteDialog({ open, onOpenChange, quote, defaultClientId }: { open: boolean; onOpenChange: (o: boolean) => void; quote?: Quote | null; defaultClientId?: string }) {
  const qc = useQueryClient()
  const [f, setF] = useState<{ client_id: string; project_id: string; issue_date: string; valid_until: string; currency: Currency; vat: boolean; vatRate: number; discount: number; notes: string; items: LineItem[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (quote) {
      setF({
        client_id: quote.client_id, project_id: quote.project_id ?? 'none', issue_date: quote.issue_date, valid_until: quote.valid_until ?? '', currency: quote.currency,
        vat: Number(quote.vat_rate) > 0, vatRate: Number(quote.vat_rate) || 22, discount: Number(quote.discount), notes: quote.notes ?? '',
        items: quote.items.map((i) => ({ description: i.description, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })),
      })
    } else {
      const today = todayMvd()
      setF({ client_id: defaultClientId ?? '', project_id: 'none', issue_date: today, valid_until: addDays(today, 15), currency: 'UYU', vat: false, vatRate: 22, discount: 0, notes: '', items: [{ description: '', quantity: 1, unit_price: 0 }] })
      void defaultVatRate().then((r) => r > 0 && setF((x) => (x ? { ...x, vat: true, vatRate: r } : x)))
    }
  }, [open, quote, defaultClientId])

  const save = useMutation({
    mutationFn: () =>
      saveQuote(
        {
          client_id: f!.client_id, project_id: f!.project_id === 'none' ? null : f!.project_id, issue_date: f!.issue_date, valid_until: f!.valid_until || null,
          currency: f!.currency, vat_rate: f!.vat ? f!.vatRate : 0, discount: f!.discount, notes: f!.notes.trim() || null, items: cleanItems(f!.items),
        },
        quote?.id,
      ),
    onSuccess: () => {
      toast.success(quote ? 'Presupuesto actualizado.' : 'Presupuesto creado como borrador.')
      invalidateFinance(qc)
      onOpenChange(false)
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  if (!f) return null
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => (x ? { ...x, [k]: v } : x))
  const subtotal = itemsSubtotal(cleanItems(f.items))

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!f!.client_id) return setError('Elegí el cliente.')
    if (!cleanItems(f!.items).length) return setError('Agregá al menos una línea con concepto y precio.')
    if (f!.discount > subtotal) return setError('El descuento no puede ser mayor que el subtotal.')
    setError(null)
    save.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[4vh] max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogTitle>{quote ? `Editar presupuesto ${quote.number ?? ''}` : 'Nuevo presupuesto'}</DialogTitle>
        <DialogDescription className="mt-1">Cuando el cliente lo acepte, lo convertís en cobro con un clic.</DialogDescription>
        <form onSubmit={onSubmit} className="mt-6 space-y-6" noValidate>
          <div className="grid gap-5 sm:grid-cols-2">
            <ClientProjectFields clientId={f.client_id} projectId={f.project_id} onClient={(v) => set('client_id', v)} onProject={(v) => set('project_id', v)} />
            <Field label="Fecha" htmlFor="q-issue"><Input id="q-issue" type="date" value={f.issue_date} onChange={(e) => set('issue_date', e.target.value)} /></Field>
            <Field label="Válido hasta" htmlFor="q-valid"><Input id="q-valid" type="date" value={f.valid_until} onChange={(e) => set('valid_until', e.target.value)} /></Field>
            <Field label="Moneda" htmlFor="q-cur"><CurrencySelect id="q-cur" value={f.currency} onChange={(c) => set('currency', c)} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Descuento" htmlFor="q-disc"><AmountInput id="q-disc" value={f.discount} onValueChange={(n) => set('discount', Math.max(0, n))} placeholder="0" /></Field>
              <Field label="IVA">
                <span className="flex h-10 items-center gap-2">
                  <Checkbox id="q-vat" checked={f.vat} onCheckedChange={(v) => set('vat', v === true)} />
                  <Label htmlFor="q-vat" className="font-normal">{f.vatRate}%</Label>
                </span>
              </Field>
            </div>
          </div>
          <ItemsEditor items={f.items} onChange={(items) => set('items', items)} currency={f.currency} />
          <TotalsBox subtotal={subtotal} discount={f.discount} vatRate={f.vat ? f.vatRate : 0} currency={f.currency} />
          <Field label="Notas y condiciones (salen en el PDF)" htmlFor="q-notes">
            <Textarea id="q-notes" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Qué incluye, forma de pago (50% de anticipo…), plazos…" />
          </Field>
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 border-t pt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending && <LoaderCircle className="animate-spin" />}{quote ? 'Guardar' : 'Crear presupuesto'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ================================================================ Gasto
export function ExpenseDialog({ open, onOpenChange, expense, recurring }: { open: boolean; onOpenChange: (o: boolean) => void; expense?: Expense | null; recurring?: boolean }) {
  const qc = useQueryClient()
  const [f, setF] = useState<{ description: string; category: ExpenseCategory; amount: number; currency: Currency; date: string; client_id: string; project_id: string; is_recurring: boolean; day: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setError(null)
    const today = todayMvd()
    setF(
      expense
        ? { description: expense.description, category: expense.category, amount: Number(expense.amount), currency: expense.currency, date: expense.date, client_id: expense.client_id ?? '', project_id: expense.project_id ?? 'none', is_recurring: expense.is_recurring, day: expense.recurrence_day ?? Number(expense.date.slice(8)) }
        : { description: '', category: 'software', amount: 0, currency: 'UYU', date: today, client_id: '', project_id: 'none', is_recurring: !!recurring, day: Math.min(28, Number(today.slice(8))) },
    )
  }, [open, expense, recurring])

  const save = useMutation({
    mutationFn: () =>
      saveExpense(
        {
          description: f!.description.trim(), category: f!.category, amount: f!.amount, currency: f!.currency, date: f!.date,
          client_id: f!.client_id || null, project_id: f!.project_id === 'none' ? null : f!.project_id, is_recurring: f!.is_recurring,
          recurrence_day: f!.is_recurring ? f!.day : null,
        },
        expense?.id,
      ),
    onSuccess: () => {
      toast.success(f?.is_recurring ? 'Gasto recurrente guardado: se registra solo cada mes.' : 'Gasto guardado.')
      invalidateFinance(qc)
      onOpenChange(false)
    },
    onError: (e) => toast.error(friendlyError(e)),
  })
  if (!f) return null
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => (x ? { ...x, [k]: v } : x))
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!f!.description.trim()) return setError('Escribí en qué se gastó.')
    if (!(f!.amount > 0)) return setError('Escribí el monto.')
    setError(null)
    save.mutate()
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[6vh] max-h-[90vh] max-w-xl overflow-y-auto" aria-describedby={undefined}>
        <DialogTitle>{expense ? 'Editar gasto' : f.is_recurring ? 'Nuevo gasto recurrente' : 'Nuevo gasto'}</DialogTitle>
        <form onSubmit={onSubmit} className="mt-6 grid gap-5 sm:grid-cols-2" noValidate>
          <Field label="¿En qué? *" htmlFor="ex-desc" className="sm:col-span-2"><Input id="ex-desc" value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="Adobe Creative Cloud, pauta, flash…" autoFocus /></Field>
          <Field label="Categoría" htmlFor="ex-cat">
            <Select value={f.category} onValueChange={(v) => set('category', v as ExpenseCategory)}>
              <SelectTrigger id="ex-cat"><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{categoryLabel[c]}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-[7rem_1fr] gap-2">
            <Field label="Moneda" htmlFor="ex-cur"><CurrencySelect id="ex-cur" value={f.currency} onChange={(c) => set('currency', c)} /></Field>
            <Field label="Monto *" htmlFor="ex-amount"><AmountInput id="ex-amount" value={f.amount} onValueChange={(n) => set('amount', n)} placeholder="0" /></Field>
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Checkbox id="ex-rec" checked={f.is_recurring} onCheckedChange={(v) => set('is_recurring', v === true)} disabled={!!expense?.parent_expense_id} />
            <Label htmlFor="ex-rec" className="font-normal">Se repite todos los meses</Label>
          </div>
          {f.is_recurring ? (
            <>
              <Field label="Día del mes" htmlFor="ex-day" hint="Se registra solo ese día de cada mes.">
                <Select value={String(f.day)} onValueChange={(v) => set('day', Number(v))}>
                  <SelectTrigger id="ex-day"><SelectValue /></SelectTrigger>
                  <SelectContent>{Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Desde" htmlFor="ex-date"><Input id="ex-date" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
            </>
          ) : (
            <Field label="Fecha" htmlFor="ex-date"><Input id="ex-date" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} /></Field>
          )}
          <div className="grid gap-5 sm:col-span-2 sm:grid-cols-2">
            <ClientProjectFieldsOptional clientId={f.client_id} projectId={f.project_id} onClient={(v) => set('client_id', v)} onProject={(v) => set('project_id', v)} />
          </div>
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">{error}</p>}
          <div className="flex justify-end gap-2 border-t pt-5 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending && <LoaderCircle className="animate-spin" />}Guardar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Cliente y proyecto opcionales: sirven para la rentabilidad por cliente y proyecto. */
function ClientProjectFieldsOptional({ clientId, projectId, onClient, onProject }: { clientId: string; projectId: string; onClient: (v: string) => void; onProject: (v: string) => void }) {
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: listClients })
  const { data: projects } = useQuery({ queryKey: ['projects', {}], queryFn: () => listProjects() })
  return (
    <>
      <Field label="Cliente (opcional)" htmlFor="ex-client" hint="Si es un gasto de un cliente, cuenta en su rentabilidad.">
        <Select value={clientId || 'none'} onValueChange={(v) => { onClient(v === 'none' ? '' : v); onProject('none') }}>
          <SelectTrigger id="ex-client"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Gasto del estudio</SelectItem>
            {clients?.map((c) => <SelectItem key={c.id} value={c.id}>{c.brand_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Proyecto (opcional)" htmlFor="ex-project">
        <Select value={projectId} onValueChange={onProject} disabled={!clientId}>
          <SelectTrigger id="ex-project"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sin proyecto</SelectItem>
            {(projects ?? []).filter((p) => p.client_id === clientId).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
    </>
  )
}

// ================================================================ Fee recurrente
export function FeeDialog({ open, onOpenChange, fee, defaultClientId }: { open: boolean; onOpenChange: (o: boolean) => void; fee?: Fee | null; defaultClientId?: string }) {
  const qc = useQueryClient()
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: listClients, enabled: open })
  const [f, setF] = useState<{ client_id: string; description: string; amount: number; currency: Currency; billing_day: number; start_date: string; end_date: string; is_active: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!open) return
    setError(null)
    setF(
      fee
        ? { client_id: fee.client_id, description: fee.description, amount: Number(fee.amount), currency: fee.currency, billing_day: fee.billing_day, start_date: fee.start_date, end_date: fee.end_date ?? '', is_active: fee.is_active }
        : { client_id: defaultClientId ?? '', description: 'Gestión de redes', amount: 0, currency: 'UYU', billing_day: 1, start_date: todayMvd(), end_date: '', is_active: true },
    )
  }, [open, fee, defaultClientId])

  // Si el cliente tiene fee cargado en su ficha, lo sugerimos
  useEffect(() => {
    if (!f || fee || f.amount) return
    const c = clients?.find((x) => x.id === f.client_id)
    if (c?.monthly_fee) setF((x) => (x ? { ...x, amount: Number(c.monthly_fee), currency: c.currency } : x))
  }, [f?.client_id, clients]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: () => saveFee({ ...f!, description: f!.description.trim(), end_date: f!.end_date || null }, fee?.id),
    onSuccess: () => {
      toast.success('Fee guardado. El cobro de cada mes se crea solo.')
      invalidateFinance(qc)
      onOpenChange(false)
    },
    onError: (e) => toast.error(friendlyError(e)),
  })
  if (!f) return null
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => (x ? { ...x, [k]: v } : x))
  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!f!.client_id) return setError('Elegí el cliente.')
    if (!f!.description.trim()) return setError('Escribí el concepto, por ejemplo "Gestión de redes".')
    if (!(f!.amount > 0)) return setError('Escribí el monto mensual.')
    setError(null)
    save.mutate()
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" aria-describedby={undefined}>
        <DialogTitle>{fee ? 'Editar fee mensual' : 'Nuevo fee mensual'}</DialogTitle>
        <form onSubmit={onSubmit} className="mt-6 grid gap-5 sm:grid-cols-2" noValidate>
          <Field label="Cliente *" htmlFor="fee-client">
            <Select value={f.client_id} onValueChange={(v) => setF((x) => (x ? { ...x, client_id: v, amount: fee ? x.amount : 0 } : x))}>
              <SelectTrigger id="fee-client"><SelectValue placeholder="Elegí un cliente" /></SelectTrigger>
              <SelectContent>{clients?.filter((c) => c.status !== 'finalizado').map((c) => <SelectItem key={c.id} value={c.id}>{c.brand_name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Concepto *" htmlFor="fee-desc"><Input id="fee-desc" value={f.description} onChange={(e) => set('description', e.target.value)} /></Field>
          <div className="grid grid-cols-[7rem_1fr] gap-2">
            <Field label="Moneda" htmlFor="fee-cur"><CurrencySelect id="fee-cur" value={f.currency} onChange={(c) => set('currency', c)} /></Field>
            <Field label="Monto por mes *" htmlFor="fee-amount"><AmountInput id="fee-amount" value={f.amount} onValueChange={(n) => set('amount', n)} placeholder="0" /></Field>
          </div>
          <Field label="Día de cobro" htmlFor="fee-day" hint="Ese día se crea el cobro del mes, con 10 días para pagar.">
            <Select value={String(f.billing_day)} onValueChange={(v) => set('billing_day', Number(v))}>
              <SelectTrigger id="fee-day"><SelectValue /></SelectTrigger>
              <SelectContent>{Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <SelectItem key={d} value={String(d)}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Desde" htmlFor="fee-start"><Input id="fee-start" type="date" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} /></Field>
          <Field label="Hasta (opcional)" htmlFor="fee-end"><Input id="fee-end" type="date" value={f.end_date} onChange={(e) => set('end_date', e.target.value)} /></Field>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Checkbox id="fee-active" checked={f.is_active} onCheckedChange={(v) => set('is_active', v === true)} />
            <Label htmlFor="fee-active" className="font-normal">Activo (si lo pausás, deja de generar cobros)</Label>
          </div>
          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">{error}</p>}
          <div className="flex justify-end gap-2 border-t pt-5 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending && <LoaderCircle className="animate-spin" />}Guardar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
