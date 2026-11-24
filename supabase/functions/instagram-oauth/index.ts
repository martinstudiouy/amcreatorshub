// Conexión de cuentas de Instagram (inicio de sesión unificado de Meta).
// POST { action: 'start', clientId? }        → link de autorización (solo admin). Sirve 7 días: se puede mandar al cliente.
// GET  ?code=…&state=…                       → Meta vuelve acá; guarda el token en Vault y muestra el resultado
// POST { action: 'disconnect', accountId }   → borra el token (solo admin); se conserva el historial
// POST { action: 'sync', accountId? }        → actualiza métricas ahora (equipo o admin)
import { adminClient, corsHeaders, env, getCaller, json, serve, sign, verify } from '../_shared/http.ts'
import { GRAPH_VERSION, IgError, assignedAccounts, exchangeCode, markDisconnected, syncAccount, type Account } from '../_shared/instagram.ts'

const redirectUri = () => `${env('SUPABASE_URL')}/functions/v1/instagram-oauth`
const appUrl = () => env('APP_URL').replace(/\/+$/, '')
const LINK_DAYS = 7

/** Página pública del CRM que muestra si salió bien (la puede abrir el cliente sin cuenta). */
function result(ok: boolean, detail: string) {
  const url = new URL(`${appUrl()}/instagram-conectado`)
  url.searchParams.set('resultado', ok ? 'ok' : 'error')
  url.searchParams.set(ok ? 'cuentas' : 'motivo', detail)
  return Response.redirect(url.toString(), 302)
}

const ACCOUNT_FIELDS = 'id, client_id, external_id, username, status, token_expires_at, token_refreshed_at, last_synced_at'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const admin = adminClient()

  // ------------------------------------------------ Instagram vuelve después de autorizar
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const payload = await verify(url.searchParams.get('state') ?? '', env('META_APP_SECRET'))
    const [userId, clientId, exp] = payload?.split('|') ?? []
    if (url.searchParams.get('error')) return result(false, 'Se canceló la autorización.')
    const code = url.searchParams.get('code')
    if (!code || !userId || Number(exp) < Date.now()) return result(false, 'El link venció o vino incompleto. Pedí uno nuevo.')

    try {
      const { token, expiresAt } = await exchangeCode(code, redirectUri())
      const accounts = await assignedAccounts(token)
      if (!accounts.length) return result(false, 'No se compartió ninguna cuenta de Instagram. Volvé a intentar y marcá la cuenta cuando Meta lo pida.')
      const saved: string[] = []
      for (const ig of accounts) {
        const { data: accountId, error } = await admin.rpc('save_instagram_account', {
          // Si se compartieron varias, el cliente se asigna después desde Integraciones
          p_client_id: accounts.length === 1 && clientId ? clientId : null,
          p_external_id: String(ig.id),
          p_username: ig.username,
          p_name: ig.name ?? null,
          p_account_type: 'BUSINESS',
          p_token: token,
          p_expires_at: expiresAt,
          p_scopes: [],
          p_picture: ig.profile_picture_url ?? null,
          p_followers: ig.followers_count ?? null,
          p_user: userId,
        })
        if (error) throw new Error(error.message)
        saved.push(`@${ig.username}`)
        // Primera carga: últimos 30 días (si falla, la hace el cron de mañana)
        const { data: acc } = await admin.from('social_accounts').select(ACCOUNT_FIELDS).eq('id', accountId).single()
        try {
          await syncAccount(admin, acc as Account, 30)
        } catch (e) {
          console.error('Primera sincronización', e)
        }
      }
      await admin.rpc('setup_instagram_crons', { p_project_url: env('SUPABASE_URL') })
      return result(true, saved.join(', '))
    } catch (e) {
      return result(false, `Meta rechazó la conexión: ${e instanceof Error ? e.message : 'error desconocido'}`)
    }
  }

  // ------------------------------------------------ Acciones desde el CRM
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const caller = await getCaller(req, admin)
  if (!caller || caller.kind !== 'user') return json({ error: 'Tenés que iniciar sesión.' }, 401)
  if (caller.role === 'cliente') return json({ error: 'No tenés permiso.' }, 403)
  const body = await req.json().catch(() => ({}))

  if (body.action === 'sync') {
    let q = admin.from('social_accounts').select(ACCOUNT_FIELDS).eq('platform', 'instagram').neq('status', 'desconectada')
    if (body.accountId) q = q.eq('id', body.accountId)
    const { data: accounts } = await q
    const results = []
    for (const acc of (accounts ?? []) as Account[]) {
      try {
        const r = await syncAccount(admin, acc, acc.last_synced_at ? 3 : 30)
        results.push({ id: acc.id, ok: true, ...r })
      } catch (e) {
        if (e instanceof IgError && e.isAuth) await markDisconnected(admin, acc, e.message)
        else await admin.from('social_accounts').update({ last_error: e instanceof Error ? e.message : String(e) }).eq('id', acc.id)
        results.push({ id: acc.id, ok: false, error: e instanceof Error ? e.message : String(e) })
      }
    }
    const failed = results.find((r) => !r.ok)
    return failed && results.length === 1 ? json({ error: failed.error }, 502) : json({ results })
  }

  if (caller.role !== 'admin') return json({ error: 'Solo un admin puede conectar o desconectar cuentas.' }, 403)

  if (body.action === 'start') {
    if (!Deno.env.get('META_APP_ID') || !Deno.env.get('META_APP_SECRET') || !Deno.env.get('META_CONFIG_ID'))
      return json({ error: 'Todavía falta terminar la configuración de la app en Meta y cargar sus claves (Fase 6). Cuando estén, este botón funciona.' }, 503)
    const clientId = typeof body.clientId === 'string' && /^[0-9a-f-]{36}$/.test(body.clientId) ? body.clientId : ''
    const state = await sign(`${caller.userId}|${clientId}|${Date.now() + LINK_DAYS * 864e5}`, env('META_APP_SECRET'))
    const url = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`)
    url.searchParams.set('client_id', env('META_APP_ID'))
    url.searchParams.set('redirect_uri', redirectUri())
    url.searchParams.set('config_id', env('META_CONFIG_ID'))
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('override_default_response_type', 'true')
    url.searchParams.set('state', state)
    return json({ url: url.toString() })
  }

  if (body.action === 'disconnect') {
    if (!body.accountId) return json({ error: 'Falta la cuenta.' }, 400)
    const { error } = await admin.rpc('disconnect_social_account', { p_account_id: body.accountId, p_reason: 'Desconectada desde el CRM.' })
    if (error) return json({ error: error.message }, 400)
    return json({ ok: true })
  }

  return json({ error: 'Acción desconocida' }, 400)
})
