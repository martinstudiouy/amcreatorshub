import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, FileText, LoaderCircle, Paperclip, Plus, Send, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ClientChip } from '@/components/common/client-chip'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { friendlyError } from '@/data/api'
import {
  addChecklistItem,
  addComment,
  attachmentUrl,
  deleteAttachment,
  deleteChecklistItem,
  deleteComment,
  deleteTask,
  getTask,
  listAttachments,
  listChecklist,
  listComments,
  listMembers,
  updateChecklistItem,
  updateTask,
  uploadAttachment,
  type TaskAttachment,
} from '@/data/crm'
import { COLUMNS, PRIORITIES, columnLabel, priorityLabel } from '@/data/labels'
import type { TaskColumn, TaskPriority } from '@/data/types'
import { useAuth } from '@/features/auth/auth-context'
import { timeAgo } from '@/lib/format'
import { invalidateCrm } from '@/lib/invalidate'
import { cn } from '@/lib/utils'
import { PriorityDot } from './task-bits'

const MAX_MB = 100

/** Panel lateral con todo el detalle de una tarea. */
export function TaskSheet({ taskId, onClose }: { taskId: string | null; onClose: () => void }) {
  return (
    <Sheet open={!!taskId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent aria-describedby={undefined}>{taskId && <TaskDetail taskId={taskId} onClose={onClose} />}</SheetContent>
    </Sheet>
  )
}

function TaskDetail({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const qc = useQueryClient()
  const { data: t, isLoading } = useQuery({ queryKey: ['task', taskId], queryFn: () => getTask(taskId) })
  const { data: members } = useQuery({ queryKey: ['members'], queryFn: listMembers })
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (t) {
      setTitle(t.title)
      setDesc(t.description ?? '')
    }
  }, [t?.id, t?.title, t?.description]) // eslint-disable-line react-hooks/exhaustive-deps

  const patch = useMutation({
    mutationFn: (p: Parameters<typeof updateTask>[1]) => updateTask(taskId, p),
    onSuccess: () => invalidateCrm(qc),
    onError: (e) => toast.error(friendlyError(e)),
  })

  if (isLoading)
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-24" />
        <Skeleton className="h-40" />
      </div>
    )
  if (!t)
    return (
      <div className="p-6">
        <SheetTitle className="text-lg font-semibold">No encontramos esta tarea</SheetTitle>
        <p className="mt-2 text-sm text-muted-foreground">Puede que la hayan borrado.</p>
      </div>
    )

  return (
    <>
      <div className="border-b px-6 pb-4 pt-5 pr-14">
        <SheetDescription asChild>
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <ClientChip name={t.client_name} color={t.client_color} />
            <span>·</span>
            <Link to={`/proyectos/${t.project_id}`} onClick={onClose} className="truncate hover:text-brand hover:underline">
              {t.project_name}
            </Link>
          </div>
        </SheetDescription>
        <SheetTitle asChild>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title.trim() !== t.title && patch.mutate({ title: title.trim() })}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
            rows={1}
            className="mt-2 w-full resize-none bg-transparent text-xl font-semibold leading-snug outline-none [field-sizing:content] focus:rounded-md focus:ring-2 focus:ring-ring"
            aria-label="Título de la tarea"
          />
        </SheetTitle>
      </div>

      <div className="flex-1 space-y-7 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Estado</Label>
            <Select value={t.column} onValueChange={(v) => patch.mutate({ column: v as TaskColumn })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {COLUMNS.map((c) => <SelectItem key={c} value={c}>{columnLabel[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Prioridad</Label>
            <Select value={t.priority} onValueChange={(v) => patch.mutate({ priority: v as TaskPriority })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    <span className="inline-flex items-center gap-2"><PriorityDot priority={p} /> {priorityLabel[p]}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Responsable</Label>
            <Select value={t.assignee_id ?? 'none'} onValueChange={(v) => patch.mutate({ assignee_id: v === 'none' ? null : v })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin responsable</SelectItem>
                {members?.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="task-due" className="text-xs text-muted-foreground">Fecha límite</Label>
            <div className="flex gap-1">
              <Input id="task-due" type="date" className="h-9" value={t.due_date ?? ''} onChange={(e) => patch.mutate({ due_date: e.target.value || null })} />
              {t.due_date && (
                <Button variant="ghost" size="icon" className="size-9 shrink-0" onClick={() => patch.mutate({ due_date: null })} aria-label="Quitar fecha">
                  <X />
                </Button>
              )}
            </div>
          </div>
        </div>

        <section className="space-y-2">
          <Label htmlFor="task-desc">Descripción</Label>
          <Textarea
            id="task-desc"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onBlur={() => desc !== (t.description ?? '') && patch.mutate({ description: desc.trim() || null })}
            placeholder="Qué hay que hacer, links, referencias…"
            className="min-h-24"
          />
        </section>

        <Checklist taskId={taskId} />
        <Attachments taskId={taskId} />
        <Comments taskId={taskId} />
      </div>

      <div className="flex items-center justify-between border-t px-6 py-3 text-xs text-muted-foreground">
        <span>Creada {timeAgo(t.created_at)}</span>
        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleting(true)}>
          <Trash2 /> Borrar tarea
        </Button>
      </div>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title="¿Borrar esta tarea?"
        description="Va a la papelera junto con su checklist, comentarios y adjuntos."
        confirmLabel="Borrar"
        destructive
        onConfirm={async () => {
          try {
            await deleteTask(taskId)
            invalidateCrm(qc)
            toast.success('Tarea borrada.')
            onClose()
          } catch (e) {
            toast.error(friendlyError(e))
          }
        }}
      />
    </>
  )
}

function Checklist({ taskId }: { taskId: string }) {
  const qc = useQueryClient()
  const key = ['checklist', taskId]
  const { data } = useQuery({ queryKey: key, queryFn: () => listChecklist(taskId) })
  const [label, setLabel] = useState('')
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key })
    invalidateCrm(qc)
  }
  const onErr = (e: unknown) => toast.error(friendlyError(e))
  const add = useMutation({ mutationFn: () => addChecklistItem(taskId, label.trim()), onSuccess: () => { setLabel(''); refresh() }, onError: onErr })
  const toggle = useMutation({ mutationFn: (i: { id: string; is_done: boolean }) => updateChecklistItem(i.id, { is_done: !i.is_done }), onSuccess: refresh, onError: onErr })
  const del = useMutation({ mutationFn: deleteChecklistItem, onSuccess: refresh, onError: onErr })
  const done = data?.filter((i) => i.is_done).length ?? 0
  const total = data?.length ?? 0

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Checklist</Label>
        {total > 0 && <span className="text-xs text-muted-foreground tabular-nums">{done}/{total}</span>}
      </div>
      {total > 0 && (
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>
      )}
      <ul className="space-y-1">
        {data?.map((i) => (
          <li key={i.id} className="group flex items-center gap-3 rounded-md px-1 py-1.5 hover:bg-muted/60">
            <Checkbox checked={i.is_done} onCheckedChange={() => toggle.mutate(i)} id={`ci-${i.id}`} />
            <label htmlFor={`ci-${i.id}`} className={cn('flex-1 cursor-pointer text-sm', i.is_done && 'text-muted-foreground line-through')}>{i.label}</label>
            <button onClick={() => del.mutate(i.id)} className="rounded p-1 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100 focus:opacity-100" aria-label={`Borrar ${i.label}`}>
              <X className="size-3.5" />
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          if (label.trim()) add.mutate()
        }}
        className="flex gap-2"
      >
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Agregar un ítem…" className="h-9" aria-label="Nuevo ítem de checklist" />
        <Button type="submit" size="sm" variant="outline" className="h-9" disabled={!label.trim()}><Plus /></Button>
      </form>
    </section>
  )
}

function Attachments({ taskId }: { taskId: string }) {
  const qc = useQueryClient()
  const key = ['attachments', taskId]
  const input = useRef<HTMLInputElement>(null)
  const { data } = useQuery({ queryKey: key, queryFn: () => listAttachments(taskId) })
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key })
    invalidateCrm(qc)
  }
  const up = useMutation({
    mutationFn: async (files: File[]) => {
      for (const f of files) {
        if (f.size > MAX_MB * 1024 * 1024) throw new Error(`"${f.name}" pesa más de ${MAX_MB} MB.`)
        await uploadAttachment(taskId, f)
      }
    },
    onSuccess: refresh,
    onError: (e) => {
      toast.error(friendlyError(e))
      refresh()
    },
  })
  const del = useMutation({ mutationFn: deleteAttachment, onSuccess: refresh, onError: (e) => toast.error(friendlyError(e)) })

  const open = async (a: TaskAttachment) => {
    try {
      const url = await attachmentUrl(a, true)
      if (url) window.open(url, '_blank', 'noopener')
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Adjuntos</Label>
        <Button size="sm" variant="ghost" className="h-7" onClick={() => input.current?.click()} disabled={up.isPending}>
          {up.isPending ? <LoaderCircle className="animate-spin" /> : <Paperclip />} Adjuntar
        </Button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            e.target.value = ''
            if (files.length) up.mutate(files)
          }}
        />
      </div>
      {!data?.length ? (
        <p className="text-sm text-muted-foreground">Sin adjuntos.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {data.map((a) => (
            <li key={a.id} className="group flex items-center gap-3 px-3 py-2">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <button onClick={() => open(a)} className="min-w-0 flex-1 truncate text-left text-sm hover:text-brand hover:underline">{a.file_name}</button>
              {a.size_bytes != null && <span className="text-xs text-muted-foreground tabular-nums">{fmtSize(a.size_bytes)}</span>}
              <button onClick={() => open(a)} className="rounded p-1 text-muted-foreground hover:text-foreground" aria-label={`Descargar ${a.file_name}`}><Download className="size-3.5" /></button>
              <button onClick={() => del.mutate(a)} className="rounded p-1 text-muted-foreground hover:text-destructive" aria-label={`Borrar ${a.file_name}`}><Trash2 className="size-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

const fmtSize = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

function Comments({ taskId }: { taskId: string }) {
  const qc = useQueryClient()
  const { userId, profile } = useAuth()
  const key = ['comments', taskId]
  const { data } = useQuery({ queryKey: key, queryFn: () => listComments(taskId) })
  const [body, setBody] = useState('')
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key })
    invalidateCrm(qc)
  }
  const add = useMutation({ mutationFn: () => addComment(taskId, body.trim(), userId!), onSuccess: () => { setBody(''); refresh() }, onError: (e) => toast.error(friendlyError(e)) })
  const del = useMutation({ mutationFn: deleteComment, onSuccess: refresh, onError: (e) => toast.error(friendlyError(e)) })

  return (
    <section className="space-y-3">
      <Label>Comentarios</Label>
      <ul className="space-y-4">
        {data?.map((c) => (
          <li key={c.id} className="group flex gap-3">
            <Avatar name={c.author_name} className="size-7 text-[10px]" />
            <div className="min-w-0 flex-1">
              <p className="text-xs">
                <span className="font-semibold">{c.author_name ?? 'Alguien'}</span>{' '}
                <span className="text-muted-foreground">{timeAgo(c.created_at)}</span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</p>
            </div>
            {(c.author_id === userId || profile?.role === 'admin') && (
              <button onClick={() => del.mutate(c.id)} className="self-start rounded p-1 text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100 focus:opacity-100" aria-label="Borrar comentario">
                <Trash2 className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault()
          if (body.trim()) add.mutate()
        }}
        className="flex items-end gap-2"
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              if (body.trim()) add.mutate()
            }
          }}
          placeholder="Escribí un comentario… (Enter para enviar)"
          className="min-h-10 flex-1 [field-sizing:content]"
          rows={1}
          aria-label="Nuevo comentario"
        />
        <Button type="submit" size="icon" disabled={!body.trim() || add.isPending} aria-label="Enviar comentario"><Send /></Button>
      </form>
    </section>
  )
}
