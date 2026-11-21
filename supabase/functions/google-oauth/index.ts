// Conexión con Google Calendar.
// POST { action: 'start' }      → devuelve el link para autorizar en Google (solo admin)
// GET  ?code=…&state=…          → Google vuelve acá; guarda el token en Vault y redirige al CRM
// POST { action: 'disconnect' } → revoca el acceso y borra el token (solo admin)
import { adminClient, corsHeaders, env, getCaller, json, sign, verify } from '../_shared/http.ts'
import { GOOGLE_SCOPES, syncStudio } from '../_shared/google.ts'

const redirectUri = () => `${env('SUPABASE_URL')}/functions/v1/google-oauth`
const appUrl = () => env('APP_URL').replace(/\/+$/, '')

function backToApp(result: 'ok' | 'error', reason?: string) {
  const url = new URL(`${appUrl()}/configuracion`)
  url.searchParams.set('tab', 'integraciones')
  url.searchParams.set('google', result)
  if (reason) url.searchParams.set('motivo', reason)
  return Response.redirect(url.toString(), 302)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const admin = adminClient()

  // ------------------------------------------------ Google vuelve después de autorizar
  if (req.method === 'GET') {
    const url = new URL(req.url)
    if (url.searchParams.get('error')) return backToApp('error', 'Cancelaste la autorización en Google.')
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code || !state) return backToApp('error', 'Faltan datos en la respuesta de Google.')

    const payload = await verify(state, env('GOOGLE_CLIENT_SECRET'))
    const [userId, exp] = payload?.split('|') ?? []
    if (!userId || Number(exp) < Date.now()) return backToApp('error', 'El link venció. Probá conectar de nuevo.')

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env('GOOGLE_CLIENT_ID'),
        client_secret: env('GOOGLE_CLIENT_SECRET'),
        redirect_uri: redirectUri(),
        grant_type: 'authorization_code',
      }),
    })
    const tokens = await tokenRes.json()
    if (!tokenRes.ok) return backToApp('error', `Google rechazó la conexión (${tokens.error ?? tokenRes.status}).`)
    if (!tokens.refresh_token) return backToApp('error', 'Google no dio acceso permanente. Quitá el acceso en myaccount.google.com/permissions y conectá de nuevo.')

    const me = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: `Bearer ${tokens.access_token}` } }).then((r) => r.json())

    const { error } = await admin.rpc('save_google_connection', {
      p_user_id: userId,
      p_email: me.email ?? 'cuenta de Google',
      p_refresh_token: tokens.refresh_token,
    })
    if (error) return backToApp('error', 'No pudimos guardar la conexión.')

    // Programa la sincronización automática cada 5 minutos
    await admin.rpc('setup_google_sync_cron', { p_project_url: env('SUPABASE_URL') })
    // Primera sincronización (si falla, la reintenta el cron)
    try {
      await syncStudio(admin)
    } catch {
      /* se reintenta en 5 minutos */
    }
    return backToApp('ok')
  }

  // ------------------------------------------------ Acciones desde el CRM
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const caller = await getCaller(req, admin)
  if (!caller || caller.kind !== 'user') return json({ error: 'Tenés que iniciar sesión.' }, 401)
  if (caller.role !== 'admin') return json({ error: 'Solo un admin puede conectar o desconectar Google Calendar.' }, 403)
  const { action } = await req.json().catch(() => ({ action: null }))

  if (action === 'start') {
    const state = await sign(`${caller.userId}|${Date.now() + 15 * 60_000}`, env('GOOGLE_CLIENT_SECRET'))
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.searchParams.set('client_id', env('GOOGLE_CLIENT_ID'))
    url.searchParams.set('redirect_uri', redirectUri())
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', GOOGLE_SCOPES)
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
    url.searchParams.set('include_granted_scopes', 'true')
    url.searchParams.set('state', state)
    return json({ url: url.toString() })
  }

  if (action === 'disconnect') {
    const { data: conns } = await admin.from('calendar_connections').select('id')
    for (const c of conns ?? []) {
      const { data: refresh } = await admin.rpc('get_google_refresh_token', { p_connection_id: c.id })
      if (refresh) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refresh as string)}`, { method: 'POST' }).catch(() => {})
      await admin.rpc('delete_google_connection', { p_connection_id: c.id })
    }
    return json({ ok: true })
  }

  return json({ error: 'Acción desconocida' }, 400)
})
