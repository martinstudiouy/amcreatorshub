// Conexión de cuentas de Instagram (Business Login for Instagram).
// POST { action: 'start', clientId? }        → link para autorizar en Instagram (solo admin)
// GET  ?code=…&state=…                       → Instagram vuelve acá; guarda el token en Vault y redirige al CRM
// POST { action: 'disconnect', accountId }   → borra el token (solo admin); se conserva el historial
// POST { action: 'sync', accountId? }        → actualiza métricas ahora (equipo o admin)
import { adminClient, corsHeaders, env, getCaller, json, sign, verify } from '../_shared/http.ts'
import { IG_SCOPES, IgError, exchangeCode, ig, markDisconnected, syncAccount, type Account } from '../_shared/instagram.ts'

const redirectUri = () => `${env('SUPABASE_URL')}/functions/v1/instagram-oauth`
const appUrl = () => env('APP_URL').replace(/\/+$/, '')

function backToApp(result: 'ok' | 'error', reason?: string, clientId?: string) {
  const url = new URL(clientId ? `${appUrl()}/clientes/${clientId}` : `${appUrl()}/configuracion`)
  url.searchParams.set('tab', clientId ? 'metricas' : 'integraciones')
  url.searchParams.set('instagram', result)
  if (reason) url.searchParams.set('motivo', reason)
  return Response.redirect(url.toString(), 302)
}

const ACCOUNT_FIELDS = 'id, client_id, external_id, username, status, token_expires_at, token_refreshed_at, last_synced_at'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const admin = adminClient()

  // ------------------------------------------------ Instagram vuelve después de autorizar
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const state = url.searchParams.get('state') ?? ''
    const payload = await verify(state, env('INSTAGRAM_APP_SECRET'))
    const [userId, clientId, exp] = payload?.split('|') ?? []
    const client = clientId || undefined
    if (url.searchParams.get('error')) return backToApp('error', 'Cancelaste la autorización en Instagram.', client)
    const code = url.searchParams.get('code')
    if (!code || !userId || Number(exp) < Date.now()) return backToApp('error', 'El link venció o vino incompleto. Probá conectar de nuevo.', client)

    try {
      const { token, expiresAt, permissions } = await exchangeCode(code, redirectUri())
      const me = await ig<{ user_id: string; username: string; name?: string; account_type?: string; profile_picture_url?: string; followers_count?: number }>('me', token, {
        fields: 'user_id,username,name,account_type,profile_picture_url,followers_count',
      })
      if (!permissions.includes('instagram_business_content_publish')) {
        // Se conecta igual (sirve para métricas), pero avisamos
        console.warn('Sin permiso de publicación para', me.username)
      }
      const { data: accountId, error } = await admin.rpc('save_instagram_account', {
        p_client_id: client ?? null,
        p_external_id: String(me.user_id),
        p_username: me.username,
        p_name: me.name ?? null,
        p_account_type: me.account_type ?? 'BUSINESS',
        p_token: token,
        p_expires_at: expiresAt,
        p_scopes: permissions,
        p_picture: me.profile_picture_url ?? null,
        p_followers: me.followers_count ?? null,
        p_user: userId,
      })
      if (error) throw new Error(error.message)

      // Crons de publicación y métricas (necesitan la URL del proyecto)
      await admin.rpc('setup_instagram_crons', { p_project_url: env('SUPABASE_URL') })

      // Primera carga: últimos 30 días (si falla, la hace el cron de mañana)
      const { data: acc } = await admin.from('social_accounts').select(ACCOUNT_FIELDS).eq('id', accountId).single()
      try {
        await syncAccount(admin, acc as Account, 30)
      } catch (e) {
        console.error('Primera sincronización', e)
      }
      return backToApp('ok', undefined, client)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido'
      return backToApp('error', `Instagram rechazó la conexión: ${msg}`, client)
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
    const clientId = typeof body.clientId === 'string' && /^[0-9a-f-]{36}$/.test(body.clientId) ? body.clientId : ''
    const state = await sign(`${caller.userId}|${clientId}|${Date.now() + 15 * 60_000}`, env('INSTAGRAM_APP_SECRET'))
    const url = new URL('https://www.instagram.com/oauth/authorize')
    url.searchParams.set('client_id', env('INSTAGRAM_APP_ID'))
    url.searchParams.set('redirect_uri', redirectUri())
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', IG_SCOPES.join(','))
    url.searchParams.set('force_reauth', 'true')
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
