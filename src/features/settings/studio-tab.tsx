import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ErrorState } from '@/components/common/error-state'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { friendlyError, getSettings, updateSettings } from '@/data/api'
import type { Settings } from '@/data/types'
import { Field } from './field'

type Form = Pick<Settings, 'studio_name' | 'legal_name' | 'rut' | 'address' | 'email' | 'phone' | 'website' | 'default_currency' | 'vat_mode' | 'invoice_prefix' | 'quote_validity_days'>

export function StudioTab() {
  const qc = useQueryClient()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['settings'], queryFn: getSettings })
  const [form, setForm] = useState<Form | null>(null)

  useEffect(() => {
    if (data) setForm({ ...data })
  }, [data])

  const save = useMutation({
    mutationFn: (f: Form) => updateSettings(f),
    onSuccess: () => {
      toast.success('Datos del estudio guardados.')
      void qc.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />
  if (isLoading || !form)
    return (
      <Card className="space-y-4 p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 max-w-lg" />
        ))}
      </Card>
    )

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f))
  const text = (k: keyof Form) => ({
    value: (form[k] as string | null) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, (e.target.value || null) as never),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form?.studio_name?.trim()) return toast.error('El nombre del estudio no puede quedar vacío.')
    save.mutate(form)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Datos del estudio</CardTitle>
          <CardDescription>Aparecen en presupuestos, recibos y reportes en PDF.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field id="studio_name" label="Nombre comercial"><Input id="studio_name" {...text('studio_name')} /></Field>
          <Field id="legal_name" label="Razón social"><Input id="legal_name" {...text('legal_name')} /></Field>
          <Field id="rut" label="RUT"><Input id="rut" inputMode="numeric" {...text('rut')} /></Field>
          <Field id="address" label="Dirección"><Input id="address" {...text('address')} /></Field>
          <Field id="email" label="Email de contacto"><Input id="email" type="email" {...text('email')} /></Field>
          <Field id="phone" label="Teléfono"><Input id="phone" {...text('phone')} /></Field>
          <Field id="website" label="Sitio web"><Input id="website" {...text('website')} placeholder="https://" /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Facturación</CardTitle>
          <CardDescription>
            El CRM emite presupuestos y recibos internos. La factura oficial (e-factura de DGI) la sacás en tu proveedor y anotás el número en el cobro.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <Field id="vat_mode" label="Régimen" hint={form.vat_mode === 'sin_definir' ? 'Lo podés definir más adelante. Mientras tanto, los recibos salen sin IVA.' : undefined}>
            <Select value={form.vat_mode} onValueChange={(v) => set('vat_mode', v)}>
              <SelectTrigger id="vat_mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sin_definir">Sin definir</SelectItem>
                <SelectItem value="monotributo">Monotributo (sin IVA)</SelectItem>
                <SelectItem value="iva">Con IVA (22%)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="default_currency" label="Moneda principal">
            <Select value={form.default_currency} onValueChange={(v) => set('default_currency', v as Form['default_currency'])}>
              <SelectTrigger id="default_currency"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="UYU">Pesos uruguayos (UYU)</SelectItem>
                <SelectItem value="USD">Dólares (USD)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field id="invoice_prefix" label="Prefijo de numeración" hint="Ejemplo: AMC-0001">
            <Input id="invoice_prefix" {...text('invoice_prefix')} />
          </Field>
          <Field id="quote_validity_days" label="Validez de los presupuestos (días)">
            <Input
              id="quote_validity_days"
              type="number"
              min={1}
              value={form.quote_validity_days}
              onChange={(e) => set('quote_validity_days', Math.max(1, Number(e.target.value) || 1))}
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending && <LoaderCircle className="animate-spin" />}
          Guardar cambios
        </Button>
      </div>
    </form>
  )
}
