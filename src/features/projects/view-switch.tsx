import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ViewSwitch<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { id: T; label: string; icon: LucideIcon }[] }) {
  return (
    <div className="inline-flex gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Vista">
      {options.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          aria-label={o.label}
          onClick={() => onChange(o.id)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            value === o.id ? 'bg-card text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <o.icon className="size-4" />
          <span className="hidden sm:inline">{o.label}</span>
        </button>
      ))}
    </div>
  )
}
