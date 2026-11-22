// POST /functions/v1/approval
// Página pública de aprobación: el cliente entra con un link (token único), sin login.
//   { action: "get", token }                         → publicaciones con links temporales a los archivos
//   { action: "submit", token, decisions, comment }  → guarda la respuesta y avisa al equipo
import { adminClient, corsHeaders, json } from '../_shared/http.ts'

const TOKEN_RE = /^[a-f0-9]{48}$/
const URL_TTL = 60 * 60 * 6 // 6 horas

type Media = { storage_path: string; media_type: string; cover_path: string | null; url?: string | null; cover_url?: string | null }
type Payload = { error?: string; posts?: { media: Media[] }[] }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)

  let body: { action?: string; token?: string; decisions?: unknown; comment?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Pedido inválido' }, 400)
  }
  const token = String(body.token ?? '')
  if (!TOKEN_RE.test(token)) return json({ error: 'no_existe' }, 404)

  const admin = adminClient()

  if (body.action === 'get') {
    const { data, error } = await admin.rpc('approval_payload', { p_token: token })
    if (error) return json({ error: 'No pudimos cargar el contenido. Probá de nuevo en un rato.' }, 500)
    const payload = data as Payload
    if (payload.error) return json(payload, payload.error === 'vencido' ? 410 : 404)

    // Links temporales a imágenes y videos (el bucket es privado)
    const paths = payload.posts!.flatMap((p) => p.media.flatMap((m) => [m.storage_path, m.cover_path].filter(Boolean) as string[]))
    if (paths.length) {
      const { data: signed } = await admin.storage.from('content').createSignedUrls(paths, URL_TTL)
      const map = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
      for (const p of payload.posts!) for (const m of p.media) {
        m.url = map.get(m.storage_path) ?? null
        m.cover_url = m.cover_path ? (map.get(m.cover_path) ?? null) : null
      }
    }
    return json(payload)
  }

  if (body.action === 'submit') {
    const comment = typeof body.comment === 'string' ? body.comment.slice(0, 2000) : null
    const { data, error } = await admin.rpc('approval_submit', { p_token: token, p_decisions: body.decisions ?? {}, p_comment: comment })
    if (error) return json({ error: error.message }, 400)
    return json(data)
  }

  return json({ error: 'Acción desconocida' }, 400)
})
