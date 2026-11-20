import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { EmptyState } from '@/components/common/empty-state'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { listNotifications, markAllNotificationsRead, markNotificationRead, subscribeToNotifications } from '@/data/api'
import { useAuth } from '@/features/auth/auth-context'
import { timeAgo } from '@/lib/format'
import { cn } from '@/lib/utils'

export function NotificationsMenu() {
  const { userId } = useAuth()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const key = ['notifications', userId]
  const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => listNotifications(userId!), enabled: !!userId })

  useEffect(() => {
    if (!userId) return
    return subscribeToNotifications(userId, () => void qc.invalidateQueries({ queryKey: ['notifications'] }))
  }, [userId, qc])

  const readOne = useMutation({ mutationFn: markNotificationRead, onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }) })
  const readAll = useMutation({ mutationFn: markAllNotificationsRead, onSettled: () => qc.invalidateQueries({ queryKey: ['notifications'] }) })

  const unread = data?.filter((n) => !n.read_at).length ?? 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notificaciones${unread ? ` (${unread} sin leer)` : ''}`}>
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
              {unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notificaciones</p>
          {unread > 0 && (
            <button className="flex items-center gap-1 text-xs font-medium text-brand hover:underline" onClick={() => readAll.mutate()}>
              <CheckCheck className="size-3.5" /> Marcar todo como leído
            </button>
          )}
        </div>
        <div className="max-h-96 overflow-y-auto p-1">
          {isLoading ? (
            <div className="space-y-2 p-3">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : !data?.length ? (
            <EmptyState compact icon={Bell} title="No tenés notificaciones" description="Acá te avisamos de aprobaciones, tareas asignadas y cuentas por vencer." />
          ) : (
            data.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className="items-start gap-3 py-2.5"
                onSelect={() => {
                  if (!n.read_at) readOne.mutate(n.id)
                  if (n.link) navigate(n.link)
                }}
              >
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-primary')} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block text-sm', !n.read_at && 'font-semibold')}>{n.title}</span>
                  {n.body && <span className="mt-0.5 block text-xs text-muted-foreground">{n.body}</span>}
                  <span className="mt-1 block text-[11px] text-muted-foreground">{timeAgo(n.created_at)}</span>
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
