import { CircleAlert } from 'lucide-react'
import { friendlyError } from '@/data/api'
import { Button } from '@/components/ui/button'

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-6 py-10 text-center">
      <CircleAlert className="size-6 text-destructive" />
      <div>
        <p className="font-semibold">No pudimos cargar esta información</p>
        <p className="mt-1 text-sm text-muted-foreground">{friendlyError(error)}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}
