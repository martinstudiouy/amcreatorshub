// Cron diario (06:10 de Montevideo): renueva tokens y guarda las métricas de todas las cuentas.
import { adminClient, corsHeaders, getCaller, json, serve } from '../_shared/http.ts'
import { IgError, markDisconnected, notifyStaff, syncAccount, type Account } from '../_shared/instagram.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const admin = adminClient()
  const caller = await getCaller(req, admin)
  if (caller?.kind !== 'cron') return json({ error: 'Solo el cron interno puede llamar a esta función.' }, 401)

  const { data: accounts } = await admin
    .from('social_accounts')
    .select('id, client_id, external_id, username, status, token_expires_at, token_refreshed_at, last_synced_at')
    .eq('platform', 'instagram')
    .neq('status', 'desconectada')

  const results = []
  for (const acc of (accounts ?? []) as Account[]) {
    try {
      results.push({ id: acc.id, ok: true, ...(await syncAccount(admin, acc, acc.last_synced_at ? 3 : 30)) })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (e instanceof IgError && e.isAuth) await markDisconnected(admin, acc, msg)
      else await admin.from('social_accounts').update({ last_error: msg }).eq('id', acc.id)
      results.push({ id: acc.id, ok: false, error: msg })
    }
  }

  // Aviso una semana antes de que venza un acceso que no se pudo renovar
  const { data: expiring } = await admin
    .from('social_accounts')
    .select('id, username, token_expires_at')
    .eq('platform', 'instagram')
    .eq('status', 'conectada')
    .lt('token_expires_at', new Date(Date.now() + 7 * 864e5).toISOString())
  for (const a of expiring ?? []) {
    await admin.from('social_accounts').update({ status: 'por_vencer' }).eq('id', a.id)
    await notifyStaff(admin, `El acceso a @${a.username} vence pronto`, 'Entrá a Configuración → Integraciones y tocá Reconectar.', '/configuracion?tab=integraciones', 'cuenta')
  }
  return json({ results })
})
