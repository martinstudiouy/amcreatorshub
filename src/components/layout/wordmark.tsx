import { useId } from 'react'
import { cn } from '@/lib/utils'

// Isotipo "am" extraído en vector del Brandbook de AM Creators (pág. 6).
export const ISOTIPO_PATH = 'M 173.23 204.82 L 144.32 204.82 L 144.32 173.13 C 138.13 183.69 129.04 191.94 117.04 197.86 C 105.05 203.79 90.80 206.75 74.29 206.75 C 51.59 206.75 33.53 201.34 20.12 190.52 C 6.71 179.70 0.00 165.40 0.00 147.62 C 0.00 130.36 6.25 116.45 18.77 105.89 C 31.27 95.32 51.20 90.04 78.54 90.04 L 143.16 90.04 L 143.16 77.68 C 143.16 60.16 138.26 46.82 128.46 37.68 C 118.65 28.53 104.34 23.96 85.51 23.96 C 72.61 23.96 60.23 26.09 48.36 30.34 C 36.50 34.59 26.31 40.45 17.80 47.92 L 5.42 27.44 C 15.73 18.68 28.11 11.91 42.56 7.15 C 57.00 2.38 72.22 0.00 88.21 0.00 C 114.79 0.00 135.16 6.63 149.35 19.90 C 155.82 25.95 160.82 33.33 164.34 42.04 C 164.46 42.32 164.59 42.61 164.71 42.89 C 172.20 29.50 182.96 19.00 197.02 11.40 C 211.08 3.80 227.14 0.00 245.20 0.00 C 270.73 0.00 290.79 7.34 305.36 22.03 C 319.93 36.71 327.22 58.36 327.22 86.95 L 327.22 204.82 L 299.75 204.82 L 299.75 89.66 C 299.75 68.53 294.66 52.43 284.46 41.35 C 274.28 30.27 259.90 24.73 241.32 24.73 C 220.18 24.73 203.54 31.24 191.41 44.25 C 179.29 57.26 173.23 75.23 173.23 98.16 Z M 78.54 185.11 C 94.02 185.11 107.30 181.57 118.39 174.48 C 129.49 167.40 137.74 157.16 143.16 143.76 L 143.16 110.52 L 79.32 110.52 C 44.50 110.52 27.08 122.63 27.08 146.85 C 27.08 158.70 31.60 168.04 40.62 174.87 C 49.65 181.70 62.29 185.11 78.54 185.11 Z M 78.54 185.11'

/**
 * Isotipo oficial. Variantes según el brandbook:
 * - "color": degradé azul royal #0300FF → negro (uso principal, sobre blanco)
 * - "mono": un solo color (currentColor). Blanco sobre fondos oscuros o azules.
 */
export function Isotipo({ className, variant = 'color' }: { className?: string; variant?: 'color' | 'mono' }) {
  const gid = useId()
  return (
    <svg viewBox="0 0 328 207" className={cn('h-6 w-auto', className)} role="img" aria-label="am creators">
      {variant === 'color' && (
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="328" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#0300ff" />
            <stop offset="1" stopColor="#000000" />
          </linearGradient>
        </defs>
      )}
      <path fillRule="evenodd" fill={variant === 'color' ? `url(#${gid})` : 'currentColor'} d={ISOTIPO_PATH} />
    </svg>
  )
}

/**
 * Logo horizontal: isotipo a la izquierda + "creators / estudio creativo" (brandbook pág. 4).
 * En modo oscuro el isotipo pasa a blanco, como indica el brandbook.
 */
export function Wordmark({ className, compact = false, onDark = false }: { className?: string; compact?: boolean; onDark?: boolean }) {
  const mono = onDark
  return (
    <span className={cn('inline-flex select-none items-center gap-2.5', onDark ? 'text-white' : 'text-foreground', className)}>
      <Isotipo variant={mono ? 'mono' : 'color'} className={cn('h-6', !mono && 'dark:hidden')} />
      {!mono && <Isotipo variant="mono" className="hidden h-6 dark:block" />}
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[19px] font-normal tracking-tight">creators</span>
          <span className="mt-0.5 text-[7.5px] font-normal tracking-[0.28em]">estudio creativo</span>
        </span>
      )}
    </span>
  )
}
