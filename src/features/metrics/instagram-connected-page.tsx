import { CheckCircle2, CircleAlert } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Wordmark } from '@/components/layout/wordmark'
import { Button } from '@/components/ui/button'

/** Página pública a la que vuelve Meta después de autorizar (la puede ver el cliente sin cuenta). */
export function InstagramConnectedPage() {
  const [params] = useSearchParams()
  const ok = params.get('resultado') === 'ok'
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <Wordmark />
      <div className="mt-8 w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-soft">
        <span className={`mx-auto flex size-14 items-center justify-center rounded-full ${ok ? 'bg-brand text-white' : 'bg-destructive/10 text-destructive'}`}>
          {ok ? <CheckCircle2 className="size-7" /> : <CircleAlert className="size-7" />}
        </span>
        <h1 className="mt-4 text-2xl font-bold">{ok ? '¡Instagram conectado!' : 'No se pudo conectar'}</h1>
        <p className="mt-2 text-muted-foreground">
          {ok ? (
            <>
              <strong className="text-foreground">{params.get('cuentas')}</strong> quedó conectada con AM Creators. Ya podés cerrar esta pestaña.
            </>
          ) : (
            (params.get('motivo') ?? 'Probá de nuevo en un rato.')
          )}
        </p>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/configuracion?tab=integraciones">Ir al CRM</Link>
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">El botón es para el equipo de AM Creators.</p>
      </div>
    </div>
  )
}
