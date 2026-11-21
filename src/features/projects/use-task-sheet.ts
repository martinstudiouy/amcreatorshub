import { useSearchParams } from 'react-router-dom'

/** La tarea abierta vive en la URL (?tarea=…), así los links de notificaciones la abren directo. */
export function useTaskSheet() {
  const [params, setParams] = useSearchParams()
  const taskId = params.get('tarea')
  const open = (id: string) =>
    setParams((p) => {
      p.set('tarea', id)
      return p
    })
  const close = () =>
    setParams(
      (p) => {
        p.delete('tarea')
        return p
      },
      { replace: true },
    )
  return { taskId, open, close }
}

export function useParam<T extends string>(key: string, fallback: T, allowed?: readonly T[]) {
  const [params, setParams] = useSearchParams()
  const raw = params.get(key) as T | null
  const value = raw && (!allowed || allowed.includes(raw)) ? raw : fallback
  const set = (v: T) =>
    setParams(
      (p) => {
        if (v === fallback) p.delete(key)
        else p.set(key, v)
        return p
      },
      { replace: true },
    )
  return [value, set] as const
}
