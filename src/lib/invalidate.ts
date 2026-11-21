import type { QueryClient } from '@tanstack/react-query'

/** Después de tocar clientes, proyectos o tareas, refrescamos todo lo que depende de eso. */
export function invalidateCrm(qc: QueryClient) {
  for (const key of ['clients', 'client', 'projects', 'project', 'tasks', 'task', 'dashboard', 'search']) {
    void qc.invalidateQueries({ queryKey: [key] })
  }
}
