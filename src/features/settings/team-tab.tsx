import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserPlus, Users } from 'lucide-react'
import { toast } from 'sonner'
import { EmptyState } from '@/components/common/empty-state'
import { ErrorState } from '@/components/common/error-state'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { friendlyError, listTeam, updateTeamMember } from '@/data/api'
import type { Role } from '@/data/types'
import { useAuth } from '@/features/auth/auth-context'

export function TeamTab() {
  const qc = useQueryClient()
  const { userId, refreshProfile } = useAuth()
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['team'], queryFn: listTeam })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { role?: Role; is_active?: boolean } }) => updateTeamMember(id, patch),
    onSuccess: (_d, v) => {
      toast.success('Cambio guardado.')
      void qc.invalidateQueries({ queryKey: ['team'] })
      if (v.id === userId) void refreshProfile()
    },
    onError: (e) => toast.error(friendlyError(e)),
  })

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <Card>
        <CardHeader>
          <CardTitle>Equipo</CardTitle>
          <CardDescription>Admin ve todo. Equipo ve proyectos, contenidos, agenda y mensajes, pero no finanzas ni montos.</CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : !data?.length ? (
            <EmptyState compact icon={Users} title="Todavía estás solo" description="Invitá a alguien siguiendo los pasos de la derecha." />
          ) : (
            <ul className="divide-y">
              {data.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar name={p.full_name} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {p.full_name || 'Sin nombre'}
                      {p.id === userId && <Badge variant="neutral">Vos</Badge>}
                      {!p.is_active && <Badge variant="danger">Desactivado</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                  </div>
                  <Select value={p.role} onValueChange={(v) => update.mutate({ id: p.id, patch: { role: v as Role } })}>
                    <SelectTrigger className="h-9 w-32" aria-label={`Rol de ${p.full_name}`}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="equipo">Equipo</SelectItem>
                    </SelectContent>
                  </Select>
                  {p.id !== userId && (
                    <Button variant="ghost" size="sm" onClick={() => update.mutate({ id: p.id, patch: { is_active: !p.is_active } })}>
                      {p.is_active ? 'Desactivar' : 'Activar'}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserPlus className="size-4 text-brand" /> Invitar a alguien</CardTitle>
          <CardDescription>Por ahora la invitación se manda desde Supabase:</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal space-y-2 pl-4 text-sm text-muted-foreground">
            <li>Entrá a tu proyecto en supabase.com.</li>
            <li>Menú <strong className="text-foreground">Authentication → Users</strong>.</li>
            <li>Botón <strong className="text-foreground">Add user → Send invitation</strong> y escribí su email.</li>
            <li>Cuando acepte, aparece en esta lista como <strong className="text-foreground">Equipo</strong>.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
