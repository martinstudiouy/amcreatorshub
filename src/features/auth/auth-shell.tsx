import type { ReactNode } from 'react'
import { Isotipo, Wordmark } from '@/components/layout/wordmark'

/** Pantalla dividida: panel de marca (negro → azul royal, como el brandbook) + formulario. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-[linear-gradient(135deg,#000000_0%,#020061_55%,#0300ff_100%)] p-12 text-white lg:flex lg:flex-col">
        <Wordmark onDark />
        <div className="mt-auto max-w-md">
          <Isotipo variant="mono" className="mb-8 h-16 text-white/90" />
          <p className="text-3xl font-semibold leading-tight">Clientes, proyectos, contenido y finanzas del estudio, en un solo lugar.</p>
          <p className="mt-4 text-sm text-white/70">AM Creators Hub · Montevideo</p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Wordmark />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
