import { useQuery } from '@tanstack/react-query'
import { Plus, Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { BrandMark } from '@/components/common/client-chip'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { PageHeader } from '@/components/common/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { listClients, type ClientStatus } from '@/data/crm'
import { SERVICES, clientStatusLabel, clientStatusVariant, serviceLabel } from '@/data/labels'
import { useRole } from '@/features/auth/auth-context'
import { formatDate, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ClientFormDialog } from './client-form-dialog'

const STATUS_TABS: (ClientStatus | 'todos')[] = ['todos', 'activo', 'lead', 'pausado', 'finalizado']

export function ClientsPage() {
  const isAdmin = useRole() === 'admin'
  const navigate = useNavigate()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['clients'], queryFn: listClients })
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ClientStatus | 'todos'>('todos')
  const [service, setService] = useState<string>('todos')
  const [creating, setCreating] = useState(false)

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: data?.length ?? 0 }
    data?.forEach((x) => (c[x.status] = (c[x.status] ?? 0) + 1))
    return c
  }, [data])

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (data ?? []).filter(
      (c) =>
        (status === 'todos' || c.status === status) &&
        (service === 'todos' || c.services?.includes(service as never)) &&
        (!t || [c.brand_name, c.name, c.industry, c.instagram_handle, c.email].some((x) => x?.toLowerCase().includes(t))),
    )
  }, [data, q, status, service])

  return (
    <>
      <PageHeader
        title="Clientes"
        description={data ? `${counts.activo ?? 0} activos · ${counts.lead ?? 0} leads` : undefined}
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> Nuevo cliente
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1" role="tablist" aria-label="Filtrar por estado">
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={status === s}
              onClick={() => setStatus(s)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                status === s ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {s === 'todos' ? 'Todos' : clientStatusLabel[s]}
              <span className="text-xs text-muted-foreground">{counts[s] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-1 gap-2 lg:justify-end">
          <div className="relative flex-1 lg:max-w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente…" className="pl-9" aria-label="Buscar cliente" />
          </div>
          <Select value={service} onValueChange={setService}>
            <SelectTrigger className="w-40" aria-label="Filtrar por servicio"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los servicios</SelectItem>
              {SERVICES.map((s) => (
                <SelectItem key={s} value={s}>{serviceLabel[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isLoading ? (
        <Card className="space-y-1 p-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </Card>
      ) : !data?.length ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Todavía no hay clientes"
            description="Creá el primero para empezar a armar sus proyectos, su brand kit y su calendario de contenidos."
            action={<Button onClick={() => setCreating(true)}><Plus /> Crear el primero</Button>}
          />
        </Card>
      ) : !rows.length ? (
        <Card>
          <EmptyState compact icon={Search} title="No hay clientes con esos filtros" description="Probá con otra búsqueda o sacá algún filtro." />
        </Card>
      ) : (
        <>
          {/* Escritorio: tabla */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Marca</th>
                  <th className="px-4 py-3 font-medium">Contacto</th>
                  <th className="px-4 py-3 font-medium">Servicios</th>
                  {isAdmin && <th className="px-4 py-3 text-right font-medium">Fee mensual</th>}
                  <th className="px-4 py-3 text-center font-medium">Proyectos</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Desde</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((c) => (
                  <tr key={c.id} className="cursor-pointer transition-colors hover:bg-muted/40" onClick={() => navigate(`/clientes/${c.id}`)}>
                    <td className="px-4 py-3">
                      <Link to={`/clientes/${c.id}`} className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <BrandMark name={c.brand_name} color={c.color_tag} className="size-9" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{c.brand_name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{c.industry}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block">{c.name}</span>
                      {c.instagram_handle && <span className="block text-xs text-muted-foreground">@{c.instagram_handle}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {c.services?.length ? c.services.map((s) => <Badge key={s} variant="neutral">{serviceLabel[s]}</Badge>) : <span className="text-muted-foreground">—</span>}
                      </div>
                    </td>
                    {isAdmin && <td className="px-4 py-3 text-right tabular-nums">{c.monthly_fee ? formatMoney(c.monthly_fee, c.currency) : '—'}</td>}
                    <td className="px-4 py-3 text-center tabular-nums">{c.active_projects || '—'}</td>
                    <td className="px-4 py-3"><Badge variant={clientStatusVariant[c.status]}>{clientStatusLabel[c.status]}</Badge></td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{formatDate(c.start_date) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {/* Celular: tarjetas */}
          <div className="grid gap-3 md:hidden">
            {rows.map((c) => (
              <Link key={c.id} to={`/clientes/${c.id}`}>
                <Card className="flex items-center gap-3 p-4">
                  <BrandMark name={c.brand_name} color={c.color_tag} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{c.brand_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[c.name, c.services?.map((s) => serviceLabel[s]).join(', ')].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <Badge variant={clientStatusVariant[c.status]}>{clientStatusLabel[c.status]}</Badge>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

      <ClientFormDialog open={creating} onOpenChange={setCreating} onSaved={(id) => navigate(`/clientes/${id}`)} />
    </>
  )
}
