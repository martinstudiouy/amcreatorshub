import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, Clock, LoaderCircle, MapPin, Trash2, Video } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { createEvent, deleteEvent, getGoogleStatus, syncGoogleNow, updateEvent, type CalendarEvent } from '@/data/agenda'
import { friendlyError } from '@/data/api'
import { listClients, listMembers } from '@/data/crm'
import { eventTypeLabel } from '@/data/labels'
import type { EventType } from '@/data/types'
import { useAuth } from '@/features/auth/auth-context'
import { formatDateTime, todayMvd } from '@/lib/format'
import { isDemo } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { localDate, localMinutes, localTime, toIso } from './dates'
import { eventTypeIcon } from './event-style'

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240]
const REMINDERS: { value: string; label: string }[] = [
  { value: 'none', label: 'Sin recordatorio' },
  { value: '10', label: '10 minutos antes' },
  { value: '30', label: '30 minutos antes' },
  { value: '60', label: '1 hora antes' },
  { value: '1440', label: '1 día antes' },
]
const durLabel = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`)

export interface EventDraft {
  date?: string
  time?: string
  clientId?: string
}

type Form = {
  title: string
  type: EventType
  client_id: string
  date: string
  all_day: boolean
  time: string
  duration: number
  location: string
  meet_url: string
  create_meet: boolean
  attendee_ids: string[]
  remind: string
  whatsapp_reminder: boolean
  notes: string
}

/** Refresca la agenda y, si hay Google conectado, sincroniza en segundo plano. */
export function useAfterEventChange() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['events'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
    if (!isDemo)
      void syncGoogleNow()
        .catch(() => null)
        .finally(() => {
          void qc.invalidateQueries({ queryKey: ['events'] })
          void qc.invalidateQueries({ queryKey: ['google-status'] })
        })
  }
}

export function EventDialog({
  open,
  onOpenChange,
  event,
  draft,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  event?: CalendarEvent | null
  draft?: EventDraft
}) {
  const { userId } = useAuth()
  const after = useAfterEventChange()
  const { data: clients } = useQuery({ queryKey: ['clients'], queryFn: listClients, enabled: open })
  const { data: members } = useQuery({ queryKey: ['members'], queryFn: listMembers, enabled: open })
  const { data: google } = useQuery({ queryKey: ['google-status'], queryFn: getGoogleStatus, enabled: open })
  const [f, setF] = useState<Form | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (event) {
      const dur = Math.max(15, Math.round((new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime()) / 60000))
      setF({
        title: event.title, type: event.type, client_id: event.client_id ?? 'none', date: localDate(event.starts_at),
        all_day: event.all_day, time: localTime(event.starts_at), duration: dur, location: event.location ?? '',
        meet_url: event.meet_url ?? '', create_meet: event.create_meet, attendee_ids: event.attendee_ids ?? [],
        remind: event.remind_minutes_before != null ? String(event.remind_minutes_before) : 'none',
        whatsapp_reminder: event.whatsapp_reminder, notes: event.notes ?? '',
      })
    } else {
      setF({
        title: '', type: 'reunion', client_id: draft?.clientId ?? 'none', date: draft?.date ?? todayMvd(), all_day: false,
        time: draft?.time ?? '10:00', duration: 60, location: '', meet_url: '', create_meet: false,
        attendee_ids: userId ? [userId] : [], remind: '30', whatsapp_reminder: false, notes: '',
      })
    }
  }, [open, event, draft, userId])

  const save = useMutation({
    mutationFn: async (form: Form) => {
      const starts = form.all_day ? toIso(form.date, '00:00') : toIso(form.date, form.time)
      const ends = form.all_day ? toIso(form.date, '23:59') : new Date(new Date(starts).getTime() + form.duration * 60000).toISOString()
      const input = {
        title: form.title.trim(),
        type: form.type,
        client_id: form.client_id === 'none' ? null : form.client_id,
        starts_at: starts,
        ends_at: ends,
        all_day: form.all_day,
        location: form.location.trim() || null,
        meet_url: form.meet_url.trim() || null,
        create_meet: form.create_meet && !form.meet_url.trim(),
        attendee_ids: form.attendee_ids,
        remind_minutes_before: form.remind === 'none' ? null : Number(form.remind),
        whatsapp_reminder: form.whatsapp_reminder,
        notes: form.notes.trim() || null,
      }
      if (event) await updateEvent(event.id, input)
      else await createEvent(input)
    },
    onSuccess: () => {
      toast.success(event ? 'Evento actualizado.' : 'Evento agendado.')
      after()
      onOpenChange(false)
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  if (!f) return null
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => (x ? { ...x, [k]: v } : x))
  const Icon = eventTypeIcon[f.type]
  const durations = DURATIONS.includes(f.duration) ? DURATIONS : [...DURATIONS, f.duration].sort((a, b) => a - b)
  const endLabel = !f.all_day && f.time ? (() => {
    const mins = localMinutes(toIso(f.date, f.time)) + f.duration
    return `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`
  })() : null

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!f!.title.trim()) return setError('Poné un título, por ejemplo "Reunión de arranque".')
    if (!f!.date) return setError('Elegí la fecha.')
    if (!f!.all_day && !/^\d{2}:\d{2}$/.test(f!.time)) return setError('Elegí la hora.')
    if (f!.meet_url && !/^https?:\/\//.test(f!.meet_url.trim())) return setError('El link de la videollamada tiene que empezar con https://')
    setError(null)
    save.mutate(f!)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[4vh] max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogTitle className="flex items-center gap-2">
          <Icon className="size-5 text-brand" />
          {event ? 'Editar evento' : 'Nuevo evento'}
          {event?.source === 'google' && <Badge variant="neutral">De Google Calendar</Badge>}
        </DialogTitle>
        <DialogDescription className="mt-1">
          {event
            ? [event.created_by_name && `Creado por ${event.created_by_name}`, event.sync_status === 'sincronizado' && event.google_event_id ? 'Sincronizado con Google' : event.sync_status === 'pendiente' && google?.connected ? 'Pendiente de subir a Google' : event.sync_status === 'error' ? 'No se pudo subir a Google' : null]
                .filter(Boolean)
                .join(' · ') || ' '
            : 'Reunión, evento, sesión de fotos o entrega.'}
        </DialogDescription>

        <form onSubmit={onSubmit} className="mt-6 space-y-5" noValidate>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo">
            {(Object.keys(eventTypeLabel) as EventType[]).map((t) => {
              const I = eventTypeIcon[t]
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={f.type === t}
                  onClick={() => set('type', t)}
                  className={cn('inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium', f.type === t ? 'border-primary bg-accent text-brand' : 'border-input text-muted-foreground hover:text-foreground')}
                >
                  <I className="size-4" /> {eventTypeLabel[t]}
                </button>
              )
            })}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ev-title">Título *</Label>
              <Input id="ev-title" value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Presentación de propuestas" autoFocus={!event} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-client">Cliente</Label>
              <Select value={f.client_id} onValueChange={(v) => set('client_id', v)}>
                <SelectTrigger id="ev-client"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin cliente</SelectItem>
                  {clients?.filter((c) => c.status !== 'finalizado' || c.id === f.client_id).map((c) => <SelectItem key={c.id} value={c.id}>{c.brand_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-date">Fecha *</Label>
              <Input id="ev-date" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Checkbox id="ev-allday" checked={f.all_day} onCheckedChange={(v) => set('all_day', v === true)} />
              <Label htmlFor="ev-allday" className="font-normal">Todo el día</Label>
            </div>
            {!f.all_day && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="ev-time">Hora *</Label>
                  <Input id="ev-time" type="time" step={900} value={f.time} onChange={(e) => set('time', e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ev-dur">Duración</Label>
                  <Select value={String(f.duration)} onValueChange={(v) => set('duration', Number(v))}>
                    <SelectTrigger id="ev-dur"><SelectValue /></SelectTrigger>
                    <SelectContent>{durations.map((d) => <SelectItem key={d} value={String(d)}>{durLabel(d)}</SelectItem>)}</SelectContent>
                  </Select>
                  {endLabel && <p className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="size-3" /> Termina a las {endLabel}</p>}
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="ev-location" className="flex items-center gap-1.5"><MapPin className="size-3.5" /> Lugar</Label>
              <Input id="ev-location" value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="Estudio, oficina del cliente…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-meet" className="flex items-center gap-1.5"><Video className="size-3.5" /> Link de videollamada</Label>
              <Input id="ev-meet" value={f.meet_url} onChange={(e) => set('meet_url', e.target.value)} placeholder="https://meet.google.com/…" />
              {!f.meet_url && (google?.connected || isDemo) && (
                <span className="flex items-center gap-2 pt-1">
                  <Checkbox id="ev-cmeet" checked={f.create_meet} onCheckedChange={(v) => set('create_meet', v === true)} />
                  <Label htmlFor="ev-cmeet" className="text-xs font-normal">Crear link de Meet automáticamente</Label>
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Participantes del equipo</Label>
            <div className="flex flex-wrap gap-2">
              {members?.map((m) => {
                const on = f.attendee_ids.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => set('attendee_ids', on ? f.attendee_ids.filter((x) => x !== m.id) : [...f.attendee_ids, m.id])}
                    className={cn('rounded-full border px-3 py-1.5 text-sm', on ? 'border-primary bg-accent text-brand' : 'border-input text-muted-foreground hover:text-foreground')}
                  >
                    {m.full_name}
                  </button>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground">Les llega el recordatorio dentro del CRM.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ev-remind">Recordatorio interno</Label>
              <Select value={f.remind} onValueChange={(v) => set('remind', v)}>
                <SelectTrigger id="ev-remind"><SelectValue /></SelectTrigger>
                <SelectContent>{REMINDERS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-muted-foreground">Recordatorio por WhatsApp al cliente</Label>
              <span className="flex h-10 items-center gap-2">
                <Checkbox id="ev-wa" checked={f.whatsapp_reminder} onCheckedChange={(v) => set('whatsapp_reminder', v === true)} disabled={f.client_id === 'none'} />
                <Label htmlFor="ev-wa" className="text-sm font-normal text-muted-foreground" title="Se manda unas 24 horas antes con la plantilla aprobada recordatorio_reunion">Avisarle 24 h antes</Label>
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ev-notes">Notas</Label>
            <Textarea id="ev-notes" value={f.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Temas a tratar, qué llevar…" />
          </div>

          {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:items-center">
            {event && (
              <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive/10 sm:mr-auto" onClick={() => setDeleting(true)}>
                <Trash2 /> Borrar
              </Button>
            )}
            {event?.meet_url && (
              <Button type="button" variant="outline" asChild className={cn(!event && 'sm:mr-auto')}>
                <a href={event.meet_url} target="_blank" rel="noreferrer"><Video /> Unirse</a>
              </Button>
            )}
            <div className="flex gap-2 sm:ml-auto">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" className="flex-1" disabled={save.isPending}>
                {save.isPending ? <LoaderCircle className="animate-spin" /> : <CalendarCheck />}
                {event ? 'Guardar' : 'Agendar'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
      {event && (
        <ConfirmDialog
          open={deleting}
          onOpenChange={setDeleting}
          title={`¿Borrar "${event.title}"?`}
          description={`${formatDateTime(event.starts_at)}${event.google_event_id ? '. También se borra de Google Calendar.' : '.'}`}
          confirmLabel="Borrar"
          destructive
          onConfirm={async () => {
            try {
              await deleteEvent(event.id)
              toast.success('Evento borrado.')
              after()
              onOpenChange(false)
            } catch (e) {
              toast.error(friendlyError(e))
            }
          }}
        />
      )}
    </Dialog>
  )
}
