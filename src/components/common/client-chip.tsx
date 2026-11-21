import { cn } from '@/lib/utils'

/** Punto de color + nombre de la marca */
export function ClientChip({ name, color, className }: { name: string; color?: string | null; className?: string }) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-1.5', className)}>
      <span className="size-2 shrink-0 rounded-full" style={{ background: color ?? 'var(--muted-foreground)' }} />
      <span className="truncate">{name}</span>
    </span>
  )
}

/** Cuadrado con la inicial de la marca, en su color */
export function BrandMark({ name, color, className }: { name: string; color?: string | null; className?: string }) {
  return (
    <span
      className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white', className)}
      style={{ background: color ?? '#64748B' }}
      aria-hidden
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}
