// POST /functions/v1/google-sync
// Lo llama el cron cada 5 minutos (con x-cron-secret) o un usuario del equipo
// con el botón "Sincronizar ahora" / después de guardar un evento.
import { adminClient, corsHeaders, getCaller, json, serve } from '../_shared/http.ts'
import { syncStudio } from '../_shared/google.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const admin = adminClient()
  const caller = await getCaller(req, admin)
  if (!caller || (caller.kind === 'user' && caller.role === 'cliente')) return json({ error: 'No autorizado' }, 401)
  try {
    return json(await syncStudio(admin))
  } catch (e) {
    return json({ error: (e as Error).message }, 502)
  }
})
