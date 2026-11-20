// localStorage/sessionStorage pueden fallar (modo privado, iframes). Nunca rompemos la app por eso.
export const safeStorage = {
  get(kind: 'local' | 'session', key: string): string | null {
    try {
      return (kind === 'local' ? localStorage : sessionStorage).getItem(key)
    } catch {
      return null
    }
  },
  set(kind: 'local' | 'session', key: string, value: string) {
    try {
      ;(kind === 'local' ? localStorage : sessionStorage).setItem(key, value)
    } catch {
      /* sin almacenamiento: se pierde al recargar */
    }
  },
  remove(kind: 'local' | 'session', key: string) {
    try {
      ;(kind === 'local' ? localStorage : sessionStorage).removeItem(key)
    } catch {
      /* nada */
    }
  },
}
