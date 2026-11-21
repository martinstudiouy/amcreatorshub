import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LayoutTemplate, LoaderCircle } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { friendlyError } from '@/data/api'
import { createProject, listClients, listTemplates, updateProject, type ProjectOverview, type ProjectStatus, type ServiceType } from '@/data/crm'
import { SERVICES, projectStatusLabel, serviceLabel } from '@/data/labels'
import { useRole } from '@/features/auth/auth-context'
import { todayMvd } from '@/lib/format'
import { invalidateCrm } from '@/lib/invalidate'

type Form = {
  client_id: string
  name: string
  type: ServiceType
  template_id: string
  start_date: string
  due_date: string
  budget: string
  currency: 'UYU' | 'USD'
  status: ProjectStatus
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  defaultClientId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  project?: ProjectOverview | null
  defaultClientId?: string
  onSaved?: (id: string) => void
}) {
  const qc = useQueryClient()
  const isAdmin = useRole() === 'admin'
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: listClients, enabled: open })
  const { data: templates } = useQuery({ queryKey: ['templates'], queryFn: listTemplates, enabled: open && !project })
  const [f, setF] = useState<Form | null>(null)
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({})

  useEffect(() => {
    if (!open) return
    setErrors({})
    setF(
      project
        ? {
            client_id: project.client_id, name: project.name, type: project.type, template_id: 'none',
            start_date: project.start_date ?? '', due_date: project.due_date ?? '',
            budget: project.budget != null ? String(project.budget) : '', currency: project.currency, status: project.status,
          }
        : {
            client_id: defaultClientId ?? '', name: '', type: 'branding', template_id: 'none', start_date: todayMvd(),
            due_date: '', budget: '', currency: 'UYU', status: 'activo',
          },
    )
  }, [open, project, defaultClientId])

  const save = useMutation({
    mutationFn: async (form: Form) => {
      const input = {
        client_id: form.client_id,
        name: form.name.trim(),
        type: form.type,
        start_date: form.start_date || null,
        due_date: form.due_date || null,
        currency: form.currency,
        status: form.status,
        ...(isAdmin ? { budget: form.budget ? Number(form.budget.replace(',', '.')) : null } : {}),
      }
      if (project) {
        await updateProject(project.id, input)
        return project.id
      }
      return createProject(input, form.template_id === 'none' ? null : form.template_id)
    },
    onSuccess: (id) => {
      toast.success(project ? 'Proyecto actualizado.' : 'Proyecto creado.')
      invalidateCrm(qc)
      onOpenChange(false)
      onSaved?.(id)
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  if (!f) return null
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => (x ? { ...x, [k]: v } : x))
  const tpl = templates?.find((t) => t.id === f.template_id)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    const errs: typeof errors = {}
    if (!f!.client_id) errs.client_id = 'Elegí el cliente.'
    if (!f!.name.trim()) errs.name = 'Poné un nombre al proyecto.'
    if (f!.start_date && f!.due_date && f!.due_date < f!.start_date) errs.due_date = 'La entrega no puede ser antes del inicio.'
    if (tpl && !f!.start_date) errs.start_date = 'Con plantilla necesitamos la fecha de inicio para calcular las tareas.'
    setErrors(errs)
    if (!Object.keys(errs).length) save.mutate(f!)
  }

  const activeClients = (clients ?? []).filter((c) => c.status !== 'finalizado' || c.id === f.client_id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[5vh] max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogTitle>{project ? 'Editar proyecto' : 'Nuevo proyecto'}</DialogTitle>
        <DialogDescription className="mt-1">{project ? project.name : 'Podés partir de una plantilla para que se creen las tareas solas.'}</DialogDescription>
        <form onSubmit={onSubmit} className="mt-6 grid gap-5 sm:grid-cols-2" noValidate>
          {!project && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="pf-template">Plantilla</Label>
              <Select
                value={f.template_id}
                onValueChange={(v) => {
                  const t = templates?.find((x) => x.id === v)
                  setF((x) => x && { ...x, template_id: v, ...(t ? { type: t.project_type, name: x.name || t.name } : {}) })
                }}
              >
                <SelectTrigger id="pf-template"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Proyecto en blanco</SelectItem>
                  {templates?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name} ({t.tasks.length} tareas)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {tpl && (
                <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <LayoutTemplate className="mt-px size-3.5 shrink-0" />
                  Se crean {tpl.tasks.length} tareas: {tpl.tasks.map((t) => t.title).join(', ')}.
                </p>
              )}
            </div>
          )}
          <Field label="Cliente *" htmlFor="pf-client" error={errors.client_id}>
            <Select value={f.client_id} onValueChange={(v) => set('client_id', v)}>
              <SelectTrigger id="pf-client"><SelectValue placeholder="Elegí un cliente" /></SelectTrigger>
              <SelectContent>
                {activeClients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.brand_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Tipo" htmlFor="pf-type">
            <Select value={f.type} onValueChange={(v) => set('type', v as ServiceType)} disabled={!!tpl}>
              <SelectTrigger id="pf-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SERVICES.map((s) => (
                  <SelectItem key={s} value={s}>{serviceLabel[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Nombre *" htmlFor="pf-name" error={errors.name}>
              <Input id="pf-name" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Identidad visual completa" />
            </Field>
          </div>
          <Field label="Inicio" htmlFor="pf-start" error={errors.start_date}>
            <Input id="pf-start" type="date" value={f.start_date} onChange={(e) => set('start_date', e.target.value)} />
          </Field>
          <Field label="Entrega" htmlFor="pf-due" error={errors.due_date}>
            <Input id="pf-due" type="date" value={f.due_date} min={f.start_date || undefined} onChange={(e) => set('due_date', e.target.value)} />
          </Field>
          {isAdmin && (
            <Field label="Presupuesto" htmlFor="pf-budget" hint={tpl?.default_budget && !f.budget ? 'Si lo dejás vacío, usa el de la plantilla.' : 'Solo lo ven los admin.'}>
              <div className="flex gap-2">
                <Select value={f.currency} onValueChange={(v) => set('currency', v as 'UYU' | 'USD')}>
                  <SelectTrigger className="w-24" aria-label="Moneda"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UYU">$</SelectItem>
                    <SelectItem value="USD">US$</SelectItem>
                  </SelectContent>
                </Select>
                <Input id="pf-budget" inputMode="decimal" value={f.budget} onChange={(e) => set('budget', e.target.value)} placeholder={tpl?.default_budget ? String(tpl.default_budget) : '0'} />
              </div>
            </Field>
          )}
          <Field label="Estado" htmlFor="pf-status">
            <Select value={f.status} onValueChange={(v) => set('status', v as ProjectStatus)}>
              <SelectTrigger id="pf-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(projectStatusLabel) as ProjectStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{projectStatusLabel[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <LoaderCircle className="animate-spin" />}
              {project ? 'Guardar cambios' : 'Crear proyecto'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
