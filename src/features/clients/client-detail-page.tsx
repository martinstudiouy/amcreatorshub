import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CalendarDays, Ellipsis, FolderKanban, Hourglass, Mail, Pencil, Phone, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ChannelIcon } from '@/components/common/channel-icon'
import { BrandMark } from '@/components/common/client-chip'
import { ConfirmDialog } from '@/components/common/confirm-dialog'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { friendlyError } from '@/data/api'
import { archiveClient, getClient, listProjects, listServices } from '@/data/crm'
import { clientStatusLabel, clientStatusVariant, serviceLabel } from '@/data/labels'
import { useRole } from '@/features/auth/auth-context'
import { ProjectCard } from '@/features/projects/project-card'
import { ProjectFormDialog } from '@/features/projects/project-form-dialog'
import { formatDate, formatMoney } from '@/lib/format'
import { invalidateCrm } from '@/lib/invalidate'
import { ClientFinanceTab } from '@/features/finance/client-finance-tab'
import { BrandKitTab } from './brand-kit-tab'
import { ClientFormDialog } from './client-form-dialog'
import { NotesTab } from './notes-tab'

export function ClientDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const isAdmin = useRole() === 'admin'
  const [params, setParams] = useSearchParams()
  const { data: c, isLoading, error, refetch } = useQuery({ queryKey: ['client', id], queryFn: () => getClient(id) })
  const [editing, setEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const archive = useMutation({
    mutationFn: () => archiveClient(id),
    onSuccess: () => {
      toast.success('Cliente enviado a la papelera.')
      invalidateCrm(qc)
      navigate('/clientes')
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />
  if (isLoading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    )
  if (!c)
    return (
      <Card>
        <EmptyState icon={FolderKanban} title="No encontramos este cliente" description="Puede que lo hayan borrado." action={<Button variant="outline" onClick={() => navigate('/clientes')}>Volver a clientes</Button>} />
      </Card>
    )

  const tabs = [
    { id: 'brand-kit', label: 'Brand kit' },
    { id: 'proyectos', label: 'Proyectos' },
    { id: 'notas', label: 'Notas' },
    { id: 'contenido', label: 'Contenido', phase: 5 },
    { id: 'mensajes', label: 'Mensajes', phase: 7 },
    { id: 'metricas', label: 'Métricas', phase: 6 },
    ...(isAdmin ? [{ id: 'finanzas', label: 'Finanzas' }] : []),
  ]
  const tab = tabs.some((t) => t.id === params.get('tab')) ? params.get('tab')! : 'brand-kit'

  return (
    <>
      <Link to="/clientes" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Clientes
      </Link>

      <Card className="mb-6 p-5 md:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <BrandMark name={c.brand_name} color={c.color_tag} className="size-14 text-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{c.brand_name}</h1>
              <Badge variant={clientStatusVariant[c.status]}>{clientStatusLabel[c.status]}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{[c.name, c.industry].filter(Boolean).join(' · ')}</p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {c.whatsapp && (
                <a href={`https://wa.me/${c.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-brand">
                  <Phone className="size-4 text-muted-foreground" /> {c.whatsapp}
                </a>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 hover:text-brand">
                  <Mail className="size-4 text-muted-foreground" /> {c.email}
                </a>
              )}
              {c.instagram_handle && (
                <a href={`https://instagram.com/${c.instagram_handle}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 hover:text-brand">
                  <ChannelIcon channel="instagram" className="text-muted-foreground" /> @{c.instagram_handle}
                </a>
              )}
              {c.start_date && (
                <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                  <CalendarDays className="size-4" /> Cliente desde el {formatDate(c.start_date)}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil /> Editar
            </Button>
            {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Más opciones"><Ellipsis /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => setArchiving(true)} className="text-destructive">
                    <Trash2 /> Enviar a la papelera
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
        <ServicesRow clientId={c.id} fee={isAdmin && c.monthly_fee ? formatMoney(c.monthly_fee, c.currency) : null} />
      </Card>

      <Tabs value={tab} onValueChange={(v) => setParams({ tab: v }, { replace: true })}>
        <TabsList className="max-w-full">
          {tabs.map((t) => (
            <TabsTrigger key={t.id} value={t.id}>
              {t.label}
              {t.phase && <span className="ml-1.5 text-[10px] text-muted-foreground">F{t.phase}</span>}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="brand-kit"><BrandKitTab clientId={c.id} /></TabsContent>
        <TabsContent value="proyectos"><ClientProjects clientId={c.id} /></TabsContent>
        <TabsContent value="notas"><NotesTab clientId={c.id} /></TabsContent>
        {isAdmin && <TabsContent value="finanzas"><ClientFinanceTab clientId={c.id} /></TabsContent>}
        {tabs.filter((t) => t.phase).map((t) => (
          <TabsContent key={t.id} value={t.id}>
            <Card>
              <EmptyState icon={Hourglass} title={`${t.label} llega en la Fase ${t.phase}`} description={`Acá vas a ver ${t.label.toLowerCase()} de ${c.brand_name}.`} />
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      <ClientFormDialog open={editing} onOpenChange={setEditing} client={c} />
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={`¿Enviar ${c.brand_name} a la papelera?`}
        description="Deja de aparecer en las listas. Sus proyectos y archivos no se borran y se puede recuperar."
        confirmLabel="Enviar a la papelera"
        destructive
        onConfirm={() => archive.mutateAsync()}
      />
    </>
  )
}

function ServicesRow({ clientId, fee }: { clientId: string; fee: string | null }) {
  const { data } = useQuery({ queryKey: ['client', clientId, 'services'], queryFn: () => listServices(clientId) })
  if (!data?.length && !fee) return null
  return (
    <div className="mt-5 grid gap-3 border-t pt-5 sm:grid-cols-2 lg:grid-cols-4">
      {data?.map((s) => (
        <div key={s.id} className="rounded-lg bg-muted/60 px-3 py-2.5">
          <p className="text-sm font-medium">{serviceLabel[s.service]}</p>
          {s.description && <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>}
        </div>
      ))}
      {fee && (
        <div className="rounded-lg bg-accent px-3 py-2.5">
          <p className="text-xs text-accent-foreground/80">Fee mensual</p>
          <p className="text-sm font-semibold text-brand">{fee}</p>
        </div>
      )}
    </div>
  )
}

function ClientProjects({ clientId }: { clientId: string }) {
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['projects', { clientId }], queryFn: () => listProjects({ clientId }) })
  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => setCreating(true)}><Plus /> Nuevo proyecto</Button>
      </div>
      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Skeleton className="h-36" />
      ) : !data?.length ? (
        <Card>
          <EmptyState compact icon={FolderKanban} title="Este cliente no tiene proyectos" description="Creá uno, o partí de una plantilla para que las tareas se armen solas." />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((p) => <ProjectCard key={p.id} p={p} showClient={false} />)}
        </div>
      )}
      <ProjectFormDialog open={creating} onOpenChange={setCreating} defaultClientId={clientId} onSaved={(pid) => navigate(`/proyectos/${pid}`)} />
    </>
  )
}
