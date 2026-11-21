import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LayoutTemplate, Plus, Trash2, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { friendlyError } from '@/data/api'
import { addTemplateTask, createTemplate, deleteTemplate, deleteTemplateTask, listTemplates, type ServiceType, type Template } from '@/data/crm'
import { PRIORITIES, SERVICES, priorityLabel, serviceLabel } from '@/data/labels'
import type { TaskPriority } from '@/data/types'
import { useRole } from '@/features/auth/auth-context'
import { PriorityDot } from '@/features/projects/task-bits'
import { formatMoney } from '@/lib/format'

export function TemplatesTab() {
  const qc = useQueryClient()
  const isAdmin = useRole() === 'admin'
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['templates'], queryFn: listTemplates })
  const [creating, setCreating] = useState(false)
  const [toDelete, setToDelete] = useState<Template | null>(null)
  const refresh = () => qc.invalidateQueries({ queryKey: ['templates'] })

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Al crear un proyecto desde una plantilla, se copian sus tareas con la fecha calculada desde el inicio.</p>
        <Button onClick={() => setCreating(true)} className="shrink-0"><Plus /> Nueva plantilla</Button>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-48" />
      ) : !data?.length ? (
        <Card><EmptyState icon={LayoutTemplate} title="Sin plantillas" description='Creá una para los trabajos que repetís, como "Gestión mensual de redes".' /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {data.map((t) => (
            <TemplateCard key={t.id} t={t} isAdmin={isAdmin} onChange={refresh} onDelete={() => setToDelete(t)} />
          ))}
        </div>
      )}
      <NewTemplateDialog open={creating} onOpenChange={setCreating} isAdmin={isAdmin} onCreated={refresh} />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`¿Borrar la plantilla "${toDelete?.name}"?`}
        description="Los proyectos que ya se crearon con ella no cambian."
        confirmLabel="Borrar"
        destructive
        onConfirm={async () => {
          try {
            await deleteTemplate(toDelete!.id)
            await refresh()
          } catch (e) {
            toast.error(friendlyError(e))
          }
        }}
      />
    </>
  )
}

function TemplateCard({ t, isAdmin, onChange, onDelete }: { t: Template; isAdmin: boolean; onChange: () => void; onDelete: () => void }) {
  const [title, setTitle] = useState('')
  const [offset, setOffset] = useState('0')
  const [priority, setPriority] = useState<TaskPriority>('media')
  const add = useMutation({
    mutationFn: () => addTemplateTask(t.id, { title: title.trim(), day_offset: Math.max(0, Number(offset) || 0), default_priority: priority, checklist: [] }),
    onSuccess: () => {
      setTitle('')
      onChange()
    },
    onError: (e) => toast.error(friendlyError(e)),
  })
  const del = useMutation({ mutationFn: deleteTemplateTask, onSuccess: onChange, onError: (e) => toast.error(friendlyError(e)) })
  const tasks = [...t.tasks].sort((a, b) => a.day_offset - b.day_offset || a.position - b.position)

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0">
          <CardTitle>{t.name}</CardTitle>
          <CardDescription className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{serviceLabel[t.project_type]}</Badge>
            {isAdmin && t.default_budget != null && <span>{formatMoney(t.default_budget)}</span>}
            {t.description && <span>{t.description}</span>}
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" onClick={onDelete} aria-label={`Borrar ${t.name}`}><Trash2 className="text-muted-foreground" /></Button>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <p className="mb-3 text-sm text-muted-foreground">Sin tareas. Agregá la primera abajo.</p>
        ) : (
          <ol className="mb-4 divide-y rounded-lg border">
            {tasks.map((x) => (
              <li key={x.id} className="group flex items-center gap-3 px-3 py-2 text-sm">
                <span className="w-14 shrink-0 text-xs text-muted-foreground tabular-nums">Día {x.day_offset}</span>
                <PriorityDot priority={x.default_priority} />
                <span className="flex-1 truncate">{x.title}</span>
                {x.checklist.length > 0 && <span className="text-xs text-muted-foreground">{x.checklist.length} ítems</span>}
                <button onClick={() => del.mutate(x.id)} className="rounded p-1 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100 focus:opacity-100" aria-label={`Quitar ${x.title}`}>
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ol>
        )}
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            if (title.trim()) add.mutate()
          }}
          className="flex flex-wrap gap-2"
        >
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nueva tarea" className="h-9 min-w-40 flex-1" aria-label="Título de la tarea" />
          <Input value={offset} onChange={(e) => setOffset(e.target.value)} type="number" min={0} className="h-9 w-20" aria-label="Día desde el inicio" title="Día desde el inicio" />
          <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
            <SelectTrigger className="h-9 w-28" aria-label="Prioridad"><SelectValue /></SelectTrigger>
            <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{priorityLabel[p]}</SelectItem>)}</SelectContent>
          </Select>
          <Button type="submit" size="sm" variant="outline" className="h-9" disabled={!title.trim() || add.isPending}><Plus /> Agregar</Button>
        </form>
      </CardContent>
    </Card>
  )
}

function NewTemplateDialog({ open, onOpenChange, isAdmin, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; isAdmin: boolean; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [type, setType] = useState<ServiceType>('redes')
  const [budget, setBudget] = useState('')
  const save = useMutation({
    mutationFn: () => createTemplate({ name: name.trim(), project_type: type, description: null, default_budget: isAdmin && budget ? Number(budget) : null }),
    onSuccess: () => {
      setName('')
      setBudget('')
      onCreated()
      onOpenChange(false)
      toast.success('Plantilla creada. Ahora agregale tareas.')
    },
    onError: (e) => toast.error(friendlyError(e)),
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>Nueva plantilla</DialogTitle>
        <form
          className="mt-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) save.mutate()
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="tp-name">Nombre</Label>
            <Input id="tp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sesión de fotos de producto" autoFocus />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tp-type">Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as ServiceType)}>
                <SelectTrigger id="tp-type"><SelectValue /></SelectTrigger>
                <SelectContent>{SERVICES.map((s) => <SelectItem key={s} value={s}>{serviceLabel[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {isAdmin && (
              <div className="space-y-2">
                <Label htmlFor="tp-budget">Presupuesto sugerido ($)</Label>
                <Input id="tp-budget" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={!name.trim() || save.isPending}>Crear</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
