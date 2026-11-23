// Utilidades comunes de las Edge Functions de AM Creators Hub.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/**
 * Igual que Deno.serve, pero si algo falla devuelve el error en JSON y con CORS.
 * Sin esto, el navegador ve una respuesta sin CORS y solo informa "no se pudo conectar".
 */
export function serve(handler: (req: Request) => Response | Promise<Response>) {
  Deno.serve(async (req) => {
    try {
      return await handler(req)
    } catch (e) {
      console.error(e)
      return json({ error: e instanceof Error ? e.message : 'Error inesperado en el servidor.' }, 500)
    }
  })
}

export function env(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Falta configurar el secreto ${name} en Supabase.`)
  return v
}

/** Cliente con permisos de servidor (service role). Nunca sale de la Edge Function. */
export function adminClient(): SupabaseClient {
  return createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type Caller = { kind: 'user'; userId: string; role: 'admin' | 'equipo' | 'cliente' } | { kind: 'cron' }

/** Identifica quién llama: un usuario logueado (por su JWT) o el cron interno (por su clave). */
export async function getCaller(req: Request, admin: SupabaseClient): Promise<Caller | null> {
  const cronHeader = req.headers.get('x-cron-secret')
  if (cronHeader) {
    const { data } = await admin.rpc('get_cron_secret')
    return data && timingSafeEqual(cronHeader, data as string) ? { kind: 'cron' } : null
  }
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  const { data: profile } = await admin.from('profiles').select('role, is_active').eq('id', data.user.id).maybeSingle()
  if (!profile?.is_active) return null
  return { kind: 'user', userId: data.user.id, role: profile.role }
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// ---------------------------------------------------------------- Firma (HMAC) para el "state" de OAuth
const enc = new TextEncoder()
const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

export async function sign(payload: string, secret: string) {
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(payload))
  return `${b64url(enc.encode(payload))}.${b64url(sig)}`
}

export async function verify(token: string, secret: string): Promise<string | null> {
  const [p, s] = token.split('.')
  if (!p || !s) return null
  const payload = new TextDecoder().decode(Uint8Array.from(atob(p.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))
  const expected = await sign(payload, secret)
  return timingSafeEqual(expected, token) ? payload : null
}
