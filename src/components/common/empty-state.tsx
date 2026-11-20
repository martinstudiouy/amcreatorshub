import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function EmptyState({ icon: Icon, title, description, action, className, compact }: {
  icon: LucideIcon
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center', compact ? 'gap-2 py-6' : 'gap-3 py-14', className)}>
      <div className={cn('flex items-center justify-center rounded-full bg-accent text-brand', compact ? 'size-9' : 'size-12')}>
        <Icon className={compact ? 'size-4' : 'size-5'} />
      </div>
      <div className="space-y-1">
        <p className={cn('font-semibold', compact ? 'text-sm' : 'text-base')}>{title}</p>
        {description && <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}
