import { Plus, X } from 'lucide-react'
import { useEffect, useState, type ComponentProps } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ExpenseCategory, InvoiceStatus, LineItem, QuoteStatus } from '@/data/finance'
import { formatMoney, type Currency } from '@/lib/format'
import { cn } from '@/lib/utils'

export const invoiceStatusLabel: Record<InvoiceStatus, string> = { pendiente: 'Pendiente', cobrado: 'Cobrado', vencido: 'Vencido', anulado: 'Anulado' }
const invoiceVariant: Record<InvoiceStatus, 'warning' | 'success' | 'danger' | 'neutral'> = { pendiente: 'warning', cobrado: 'success', vencido: 'danger', anulado: 'neutral' }
export const InvoiceBadge = ({ status }: { status: InvoiceStatus }) => <Badge variant={invoiceVariant[status]}>{invoiceStatusLabel[status]}</Badge>

export const quoteStatusLabel: Record<QuoteStatus, string> = { borrador: 'Borrador', enviado: 'Enviado', aceptado: 'Aceptado', rechazado: 'Rechazado', vencido: 'Vencido' }
const quoteVariant: Record<QuoteStatus, 'neutral' | 'default' | 'success' | 'danger' | 'warning'> = { borrador: 'neutral', enviado: 'default', aceptado: 'success', rechazado: 'danger', vencido: 'warning' }
export const QuoteBadge = ({ status }: { status: QuoteStatus }) => <Badge variant={quoteVariant[status]}>{quoteStatusLabel[status]}</Badge>

export const categoryLabel: Record<ExpenseCategory, string> = {
  software: 'Software', equipos: 'Equipos', publicidad: 'Publicidad', freelancers: 'Freelancers', impuestos: 'Impuestos', otros: 'Otros',
}
export const CATEGORIES = Object.keys(categoryLabel) as ExpenseCategory[]
export const categoryColor: Record<ExpenseCategory, string> = {
  software: '#0300FF', equipos: '#020061', publicidad: '#9333EA', freelancers: '#EA580C', impuestos: '#64748B', otros: '#94A3B8',
}

export const PAYMENT_METHODS = ['Transferencia', 'Efectivo', 'Mercado Pago', 'Tarjeta', 'Depósito', 'Otro']

/** Monto en su moneda y, si es en dólares, su equivalente en pesos debajo. */
export function Money({ amount, currency, fx, className }: { amount: number | string; currency: Currency; fx?: number | string; className?: string }) {
  return (
    <span className={cn('tabular-nums', className)}>
      {formatMoney(amount, currency)}
      {currency === 'USD' && fx && Number(fx) !== 1 && (
        <span className="block text-[11px] font-normal text-muted-foreground">≈ {formatMoney(Number(amount) * Number(fx), 'UYU')}</span>
      )}
    </span>
  )
}

/** "1.234,50" → 1234.5 · "12,5" → 12.5 · "12.5" → 12.5 */
export function parseAmount(v: string): number {
  let t = v.trim().replace(/\s|\$|US/g, '')
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  else if ((t.match(/\./g) ?? []).length > 1 || /^-?\d{1,3}\.\d{3}$/.test(t)) t = t.replace(/\./g, '') // 18.000 = dieciocho mil
  const n = Number(t)
  return Number.isFinite(n) ? n : 0
}

const show = (n: number) => (n === 0 ? '' : String(n).replace('.', ','))

/** Campo de monto que deja escribir con coma decimal sin "saltar" mientras se tipea. */
export function AmountInput({ value, onValueChange, ...props }: { value: number; onValueChange: (n: number) => void } & Omit<ComponentProps<typeof Input>, 'value' | 'onChange'>) {
  const [text, setText] = useState(show(value))
  useEffect(() => {
    if (parseAmount(text) !== value) setText(show(value))
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Input
      inputMode="decimal"
      {...props}
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        onValueChange(parseAmount(e.target.value))
      }}
    />
  )
}

/** Editor de líneas (concepto, cantidad, precio) con importe calculado. */
export function ItemsEditor({ items, onChange, currency }: { items: LineItem[]; onChange: (items: LineItem[]) => void; currency: Currency }) {
  const set = (i: number, patch: Partial<LineItem>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)))
  return (
    <div className="space-y-2">
      <div className="hidden grid-cols-[1fr_5rem_8rem_7rem_2rem] gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid">
        <span>Concepto</span>
        <span className="text-right">Cant.</span>
        <span className="text-right">Precio unit.</span>
        <span className="text-right">Importe</span>
        <span />
      </div>
      {items.map((it, i) => (
        <div key={i} className="grid grid-cols-[1fr_2rem] gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_5rem_8rem_7rem_2rem] sm:border-0 sm:p-0">
          <Input value={it.description} onChange={(e) => set(i, { description: e.target.value })} placeholder="Ej: Diseño de logo" aria-label={`Concepto ${i + 1}`} className="col-span-1" />
          <Button type="button" variant="ghost" size="icon" className="size-10 sm:order-last" onClick={() => onChange(items.filter((_, j) => j !== i))} disabled={items.length === 1} aria-label="Quitar línea">
            <X />
          </Button>
          <div className="col-span-2 grid grid-cols-3 gap-2 sm:col-span-3 sm:grid-cols-[5rem_8rem_7rem]">
            <AmountInput className="text-right" value={it.quantity} onValueChange={(n) => set(i, { quantity: n })} aria-label={`Cantidad ${i + 1}`} />
            <AmountInput className="text-right" value={it.unit_price} onValueChange={(n) => set(i, { unit_price: n })} placeholder="0" aria-label={`Precio ${i + 1}`} />
            <span className="flex h-10 items-center justify-end text-sm font-medium tabular-nums">{formatMoney(Math.round(it.quantity * it.unit_price * 100) / 100, currency, { decimals: true })}</span>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, { description: '', quantity: 1, unit_price: 0 }])}>
        <Plus /> Agregar línea
      </Button>
    </div>
  )
}

/** Bloque de totales: subtotal, descuento, IVA y total. */
export function TotalsBox({ subtotal, discount = 0, vatRate, currency }: { subtotal: number; discount?: number; vatRate: number; currency: Currency }) {
  const base = subtotal - discount
  const vat = Math.round(base * vatRate) / 100
  const total = Math.round((base + vat) * 100) / 100
  const row = (l: string, v: string, strong?: boolean) => (
    <div className={cn('flex justify-between py-1 text-sm', strong && 'border-t pt-2 text-base font-bold')}>
      <span className={cn(!strong && 'text-muted-foreground')}>{l}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  )
  return (
    <div className="ml-auto w-full max-w-xs rounded-lg bg-muted/60 p-4">
      {row('Subtotal', formatMoney(subtotal, currency, { decimals: true }))}
      {discount > 0 && row('Descuento', `− ${formatMoney(discount, currency, { decimals: true })}`)}
      {vatRate > 0 && row(`IVA ${vatRate}%`, formatMoney(vat, currency, { decimals: true }))}
      {row('Total', formatMoney(total, currency, { decimals: true }), true)}
    </div>
  )
}

export interface BarSeries {
  label: string
  color: string
  values: number[]
}

/** Gráfico de barras agrupadas, simple y legible. */
export function BarChart({ categories, series, height = 220, format }: { categories: string[]; series: BarSeries[]; height?: number; format: (n: number) => string }) {
  const max = Math.max(1, ...series.flatMap((s) => s.values))
  const nice = niceMax(max)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * nice)
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs">
        {series.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="flex flex-col justify-between pb-6 text-right text-[10px] text-muted-foreground tabular-nums" style={{ height }}>
          {[...ticks].reverse().map((t) => (
            <span key={t} className="-translate-y-1/2 leading-none first:translate-y-0 last:translate-y-0">{compact(t)}</span>
          ))}
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height: height - 24 }}>
            {ticks.map((t) => <span key={t} className="border-t border-border/70" />)}
          </div>
          <div className="relative grid gap-2" style={{ gridTemplateColumns: `repeat(${categories.length}, minmax(0,1fr))`, height }}>
            {categories.map((c, ci) => (
              <div key={c} className="flex flex-col">
                <div className="flex flex-1 items-end justify-center gap-1 px-1" style={{ maxHeight: height - 24 }}>
                  {series.map((s) => {
                    const v = s.values[ci] ?? 0
                    return (
                      <div
                        key={s.label}
                        className="w-full max-w-7 rounded-t-[3px] transition-[height]"
                        style={{ height: `${(v / nice) * 100}%`, background: s.color, minHeight: v > 0 ? 2 : 0 }}
                        title={`${s.label} ${c}: ${format(v)}`}
                      />
                    )
                  })}
                </div>
                <span className="h-6 pt-1.5 text-center text-[11px] capitalize text-muted-foreground">{c}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function niceMax(n: number) {
  const p = 10 ** Math.floor(Math.log10(n))
  const m = n / p
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p
}
const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toLocaleString('es-UY', { maximumFractionDigits: 1 })} M` : n >= 1000 ? `${(n / 1000).toLocaleString('es-UY', { maximumFractionDigits: 1 })} mil` : String(Math.round(n)))
