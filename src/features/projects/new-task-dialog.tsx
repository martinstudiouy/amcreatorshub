import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LoaderCircle } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { friendlyError } from '@/data/api'
import { createTask, listMembers, listProjects } from '@/data/crm'
import { COLUMNS, PRIORITIES, columnLabel, priorityLabel } from '@/data/labels'
import type { TaskColumn, TaskPriority } from '@/data/types'
import { invalidateCrm } from '@/lib/invalidate'

export function NewTaskDialog({
  open,
  onOpenChange,
  projectId,
  column = 'por_hacer',
  onCreated,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  projectId?: string
  column?: TaskColumn
  onCreated?: (id: string) => void
}) {
  const qc = useQueryClient()
  const { data: projects } = useQuery({ queryKey: ['projects', {}], queryFn: () => listProjects(), enabled: open && !projectId })
  const { data: members } = useQuery({ queryKey: ['members'], queryFn: listMembers, enabled: open })
  const [f, setF] = useState({ project_id: '', title: '', assignee_id: 'none', due_date: '', priority: 'media' as TaskPriority, column })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setF({ project_id: projectId ?? '', title: '', assignee_id: 'none', due_date: '', priority: 'media', column })
      setError(null)
    }
  }, [open, projectId, column])

  const save = useMutation({
    mutationFn: () =>
      createTask({
        project_id: f.project_id,
        title: f.title.trim(),
        assignee_id: f.assignee_id === 'none' ? null : f.assignee_id,
        due_date: f.due_date || null,
        priority: f.priority,
        column: f.column,
        description: null,
      }),
    onSuccess: (id) => {
      toast.success('Tarea creada.')
      invalidateCrm(qc)
      onOpenChange(false)
      onCreated?.(id)
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!f.project_id) return setError('Elegí a qué proyecto pertenece.')
    if (!f.title.trim()) return setError('Escribí qué hay que hacer.')
    setError(null)
    save.mutate()
  }

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }))
  const activeProjects = (projects ?? []).filter((p) => p.status === 'activo' || p.status === 'en_pausa')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>Nueva tarea</DialogTitle>
        <form onSubmit={onSubmit} className="mt-5 grid gap-4 sm:grid-cols-2" noValidate>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="nt-title">¿Qué hay que hacer? *</Label>
            <Input id="nt-title" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Diseñar historia para el lanzamiento" autoFocus />
          </div>
          {!projectId && (
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nt-project">Proyecto *</Label>
              <Select value={f.project_id} onValueChange={(v) => set('project_id', v)}>
                <SelectTrigger id="nt-project"><SelectValue placeholder="Elegí un proyecto" /></SelectTrigger>
                <SelectContent>
                  {activeProjects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {p.client_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="nt-assignee">Responsable</Label>
            <Select value={f.assignee_id} onValueChange={(v) => set('assignee_id', v)}>
              <SelectTrigger id="nt-assignee"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin responsable</SelectItem>
                {members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nt-due">Fecha límite</Label>
            <Input id="nt-due" type="date" value={f.due_date} onChange={(e) => set('due_date', e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nt-priority">Prioridad</Label>
            <Select value={f.priority} onValueChange={(v) => set('priority', v as TaskPriority)}>
              <SelectTrigger id="nt-priority"><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{priorityLabel[p]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nt-column">Columna</Label>
            <Select value={f.column} onValueChange={(v) => set('column', v as TaskColumn)}>
              <SelectTrigger id="nt-column"><SelectValue /></SelectTrigger>
              <SelectContent>{COLUMNS.map((c) => <SelectItem key={c} value={c}>{columnLabel[c]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive sm:col-span-2">{error}</p>}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <LoaderCircle className="animate-spin" />}
              Crear tarea
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
