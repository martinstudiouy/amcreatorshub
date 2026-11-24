// Publicación automática en Instagram.
// · Cron cada minuto: publica lo que está "Programado" y ya llegó a su hora.
// · POST { postId } desde el CRM (equipo o admin): "Publicar ahora".
import { adminClient, corsHeaders, getCaller, json, serve } from '../_shared/http.ts'
import { IgError, getToken, ig, markDisconnected, notifyStaff, publishStep, type Account, type MediaRow, type PostRow } from '../_shared/instagram.ts'

type Result = { id: string; status: string; message?: string }
const MAX_ATTEMPTS = 3
const POST_FIELDS = 'id, client_id, social_account_id, format, caption, hashtags, publish_attempts, ig_container, created_by'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const started = Date.now()
  const admin = adminClient()
  const caller = await getCaller(req, admin)
  if (!caller || (caller.kind === 'user' && caller.role === 'cliente')) return json({ error: 'No tenés permiso.' }, 401)

  let postId: string | null = null
  if (caller.kind === 'user') {
    const body = await req.json().catch(() => ({}))
    postId = typeof body.postId === 'string' ? body.postId : null
    if (!postId) return json({ error: 'Falta la publicación.' }, 400)
    // "Publicar ahora": la pasamos a Programado para este momento
    const { error } = await admin.from('content_posts').update({ status: 'programado', scheduled_at: new Date().toISOString(), error_message: null }).eq('id', postId).is('deleted_at', null).in('status', ['aprobado', 'programado', 'error', 'borrador'])
    if (error) return json({ error: error.message }, 400)
  }

  const { data: claimed, error } = await admin.rpc('claim_posts_to_publish', { p_post_id: postId })
  if (error) return json({ error: error.message }, 500)
  const posts = (claimed ?? []) as (PostRow & { scheduled_at: string })[]
  const results: Result[] = []

  for (const [i, post] of posts.entries()) {
    // Reparte el tiempo disponible (~50 s) entre las publicaciones de esta vuelta
    const deadline = started + 50_000 - (posts.length - i - 1) * 5_000
    results.push(await handle(admin, post, deadline))
  }
  const one = results[0]
  if (postId && one && one.status === 'error') return json({ error: one.message }, 502)
  return json({ results })
})

async function handle(admin: ReturnType<typeof adminClient>, post: PostRow, deadline: number): Promise<Result> {
  // Cuenta: la elegida en la publicación o la cuenta de Instagram conectada del cliente
  let accQ = admin.from('social_accounts').select('id, client_id, external_id, username, status, token_expires_at, token_refreshed_at, last_synced_at').eq('platform', 'instagram')
  accQ = post.social_account_id
    ? accQ.eq('id', post.social_account_id)
    : (post.client_id ? accQ.eq('client_id', post.client_id) : accQ.is('client_id', null)).neq('status', 'desconectada')
  const { data: accs } = await accQ.order('created_at').limit(1)
  const acc = accs?.[0] as Account | undefined
  if (!acc) return fail(admin, post, post.client_id ? 'El cliente no tiene una cuenta de Instagram conectada. Conectala en la ficha del cliente → Métricas.' : 'El estudio no tiene su cuenta de Instagram conectada. Conectala en Configuración → Integraciones.', true)
  if (acc.status === 'desconectada') return fail(admin, post, `La cuenta @${acc.username} está desconectada. Reconectala en Configuración → Integraciones.`, true)

  try {
    const token = await getToken(admin, acc.id)
    const { data: media } = await admin.from('content_media').select('storage_path, media_type, position').eq('post_id', post.id).order('position')
    const paths = ((media ?? []) as MediaRow[]).map((m) => m.storage_path)
    // Links temporales para que Instagram descargue los archivos (2 horas)
    const { data: signed } = paths.length ? await admin.storage.from('content').createSignedUrls(paths, 7200) : { data: [] }
    const urls = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
    const withUrls = ((media ?? []) as MediaRow[]).map((m) => ({ ...m, url: urls.get(m.storage_path) ?? '' }))
    if (withUrls.some((m) => !m.url)) throw new IgError('No se encontró alguno de los archivos de la publicación.')

    const step = await publishStep(acc.external_id, post, withUrls, token, deadline)
    if (!step.done) {
      // Instagram sigue procesando el video: se retoma en el próximo minuto
      await admin.from('content_posts').update({ ig_container: step.container, publishing_started_at: null }).eq('id', post.id)
      return { id: post.id, status: 'procesando' }
    }
    const info = await ig<{ permalink?: string; timestamp?: string }>(step.mediaId, token, { fields: 'permalink,timestamp' }).catch(() => ({}) as { permalink?: string; timestamp?: string })
    await admin
      .from('content_posts')
      .update({ status: 'publicado', ig_media_id: step.mediaId, ig_permalink: info.permalink ?? null, published_at: info.timestamp ?? new Date().toISOString(), error_message: null, ig_container: null, publishing_started_at: null, social_account_id: acc.id })
      .eq('id', post.id)
    await notifyStaff(admin, `Se publicó en @${acc.username}`, (post.caption ?? '').slice(0, 100), `/contenidos?post=${post.id}`, 'instagram', post.created_by)
    return { id: post.id, status: 'publicado' }
  } catch (e) {
    const err = e instanceof IgError ? e : new IgError(e instanceof Error ? e.message : String(e))
    if (err.message === 'EXPIRED') {
      // El contenedor venció (24 h): se arma de nuevo
      await admin.from('content_posts').update({ ig_container: null, publishing_started_at: null }).eq('id', post.id)
      return { id: post.id, status: 'reintento' }
    }
    if (err.isAuth) {
      await markDisconnected(admin, acc, err.message)
      return fail(admin, post, `Instagram pidió volver a conectar @${acc.username}: ${err.message}`, true)
    }
    return fail(admin, post, `Instagram respondió: ${err.message}`, !err.isTransient)
  }
}

/** Error definitivo → estado Error y aviso. Pasajero → se reintenta (hasta 3 veces). */
async function fail(admin: ReturnType<typeof adminClient>, post: PostRow, message: string, final: boolean): Promise<Result> {
  const attempts = post.publish_attempts + 1
  if (!final && attempts < MAX_ATTEMPTS) {
    await admin.from('content_posts').update({ publish_attempts: attempts, error_message: message }).eq('id', post.id)
    return { id: post.id, status: 'reintento', message }
  }
  await admin.from('content_posts').update({ status: 'error', error_message: message, publish_attempts: attempts, ig_container: null, publishing_started_at: null }).eq('id', post.id)
  await notifyStaff(admin, 'No se pudo publicar en Instagram', message.slice(0, 160), `/contenidos?post=${post.id}`, 'instagram')
  return { id: post.id, status: 'error', message }
}
