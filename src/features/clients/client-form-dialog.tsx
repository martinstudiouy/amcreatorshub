import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, LoaderCircle } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { friendlyError } from '@/data/api'
import { createClient, updateClient, type ClientInput, type ClientOverview, type ClientStatus, type ServiceType } from '@/data/crm'
import { CLIENT_COLORS, SERVICES, clientStatusLabel, serviceLabel } from '@/data/labels'
import { useRole } from '@/features/auth/auth-context'
import { invalidateCrm } from '@/lib/invalidate'
import { cn } from '@/lib/utils'

type Form = {
  brand_name: string
  name: string
  industry: string
  email: string
  whatsapp: string
  instagram_handle: string
  status: ClientStatus
  start_date: string
  monthly_fee: string
  currency: 'UYU' | 'USD'
  color_tag: string
  services: ServiceType[]
}

const empty: Form = {
  brand_name: '', name: '', industry: '', email: '', whatsapp: '', instagram_handle: '',
  status: 'lead', start_date: '', monthly_fee: '', currency: 'UYU', color_tag: CLIENT_COLORS[0], services: [],
}

function fromClient(c: ClientOverview): Form {
  return {
    brand_name: c.brand_name, name: c.name, industry: c.industry ?? '', email: c.email ?? '', whatsapp: c.whatsapp ?? '',
    instagram_handle: c.instagram_handle ?? '', status: c.status, start_date: c.start_date ?? '',
    monthly_fee: c.monthly_fee != null ? String(c.monthly_fee) : '', currency: c.currency, color_tag: c.color_tag ?? CLIENT_COLORS[0],
    services: c.services ?? [],
  }
}

/** Normaliza WhatsApp a formato internacional uruguayo: 099 123 456 → +59899123456 */
export function normalizeWhatsapp(v: string) {
  const digits = v.replace(/[^\d+]/g, '')
  if (!digits) return ''
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('598')) return '+' + digits
  if (digits.startsWith('0')) return '+598' + digits.slice(1)
  return '+598' + digits
}

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSaved,
  initial,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  client?: ClientOverview | null
  onSaved?: (id: string) => void
  /** Datos para precargar un cliente nuevo (por ejemplo, desde una conversación) */
  initial?: Partial<Form>
}) {
  const qc = useQueryClient()
  const isAdmin = useRole() === 'admin'
  const [f, setF] = useState<Form>(empty)
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})

  useEffect(() => {
    if (open) {
      setF(client ? fromClient(client) : { ...empty, ...initial })
      setErrors({})
    }
  }, [open, client]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }))

  const save = useMutation({
    mutationFn: async (form: Form) => {
      const input: ClientInput = {
        brand_name: form.brand_name.trim(),
        name: form.name.trim(),
        industry: form.industry.trim() || null,
        email: form.email.trim() || null,
        whatsapp: normalizeWhatsapp(form.whatsapp) || null,
        instagram_handle: form.instagram_handle.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '') || null,
        status: form.status,
        start_date: form.start_date || null,
        currency: form.currency,
        color_tag: form.color_tag,
        ...(isAdmin ? { monthly_fee: form.monthly_fee ? Number(form.monthly_fee.replace(',', '.')) : null } : {}),
      }
      if (client) {
        await updateClient(client.id, input, form.services)
        return client.id
      }
      return createClient(input, form.services)
    },
    onSuccess: (id) => {
      toast.success(client ? 'Cliente actualizado.' : 'Cliente creado.')
      invalidateCrm(qc)
      onOpenChange(false)
      onSaved?.(id)
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!f.brand_name.trim()) errs.brand_name = 'Poné el nombre de la marca.'
    if (!f.name.trim()) errs.name = 'Poné el nombre de la persona de contacto.'
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email.trim())) errs.email = 'Ese email no parece válido.'
    if (f.monthly_fee && Number.isNaN(Number(f.monthly_fee.replace(',', '.')))) errs.monthly_fee = 'Escribí solo números.'
    setErrors(errs)
    if (Object.keys(errs).length === 0) save.mutate(f)
  }

  const text = (k: keyof Form) => ({
    id: `cf-${k}`,
    value: f[k] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value as never),
    'aria-invalid': !!errors[k],
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[5vh] max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{client ? `Editar ${client.brand_name}` : 'Nuevo cliente'}</DialogTitle>
        <DialogDescription className="mt-1">Los campos con * son obligatorios.</DialogDescription>
        <form onSubmit={onSubmit} className="mt-6 grid gap-5 sm:grid-cols-2" noValidate>
          <F label="Marca *" htmlFor="cf-brand_name" error={errors.brand_name}><Input {...text('brand_name')} placeholder="Café Rambla" autoFocus /></F>
          <F label="Persona de contacto *" htmlFor="cf-name" error={errors.name}><Input {...text('name')} placeholder="Sofía Pereira" /></F>
          <F label="Rubro" htmlFor="cf-industry"><Input {...text('industry')} placeholder="Gastronomía" /></F>
          <F label="Estado" htmlFor="cf-status">
            <Select value={f.status} onValueChange={(v) => set('status', v as ClientStatus)}>
              <SelectTrigger id="cf-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(clientStatusLabel) as ClientStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{clientStatusLabel[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </F>
          <F label="WhatsApp" htmlFor="cf-whatsapp" hint="Podés escribir 099 123 456: lo pasamos a +598."><Input {...text('whatsapp')} inputMode="tel" placeholder="099 123 456" /></F>
          <F label="Email" htmlFor="cf-email" error={errors.email}><Input {...text('email')} type="email" placeholder="hola@marca.uy" /></F>
          <F label="Instagram" htmlFor="cf-instagram_handle"><Input {...text('instagram_handle')} placeholder="@marca" /></F>
          <F label="Fecha de inicio" htmlFor="cf-start_date"><Input {...text('start_date')} type="date" /></F>
          {isAdmin && (
            <F label="Fee mensual" htmlFor="cf-monthly_fee" error={errors.monthly_fee} hint="Solo lo ven los admin.">
              <div className="flex gap-2">
                <Select value={f.currency} onValueChange={(v) => set('currency', v as 'UYU' | 'USD')}>
                  <SelectTrigger className="w-24" aria-label="Moneda"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UYU">$</SelectItem>
                    <SelectItem value="USD">US$</SelectItem>
                  </SelectContent>
                </Select>
                <Input {...text('monthly_fee')} inputMode="decimal" placeholder="18000" />
              </div>
            </F>
          )}
          <F label="Color en tableros y calendarios" htmlFor="cf-color">
            <div className="flex flex-wrap gap-2" id="cf-color" role="radiogroup">
              {CLIENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={f.color_tag === c}
                  aria-label={c}
                  onClick={() => set('color_tag', c)}
                  className={cn('flex size-7 items-center justify-center rounded-full ring-offset-2 ring-offset-card', f.color_tag === c && 'ring-2 ring-foreground')}
                  style={{ background: c }}
                >
                  {f.color_tag === c && <Check className="size-3.5 text-white" />}
                </button>
              ))}
            </div>
          </F>
          <div className="space-y-2 sm:col-span-2">
            <Label>Servicios contratados</Label>
            <div className="flex flex-wrap gap-2">
              {SERVICES.map((s) => {
                const on = f.services.includes(s)
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set('services', on ? f.services.filter((x) => x !== s) : [...f.services, s])}
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
                      on ? 'border-primary bg-accent text-brand' : 'border-input text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {serviceLabel[s]}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <LoaderCircle className="animate-spin" />}
              {client ? 'Guardar cambios' : 'Crear cliente'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function F({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
