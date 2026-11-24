// Accesos al portal de clientes (solo admin).
// POST { action: 'create', clientId, email, fullName } → crea el usuario (o le da una clave nueva) y devuelve una contraseña temporal
// POST { action: 'reset', userId }                      → nueva contraseña temporal
// La contraseña temporal se muestra una sola vez; al entrar, el cliente tiene que cambiarla.
import { adminClient, corsHeaders, getCaller, json, serve } from '../_shared/http.ts'

const WORDS = ['rambla', 'ceibo', 'puerto', 'faro', 'sol', 'mate', 'rio', 'duna', 'ola', 'bahia', 'palmar', 'cabo']
function tempPassword() {
  const n = crypto.getRandomValues(new Uint32Array(3))
  const w = (i: number) => WORDS[n[i] % WORDS.length]
  return `${w(0)[0].toUpperCase()}${w(0).slice(1)}-${w(1)}-${1000 + (n[2] % 9000)}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  const admin = adminClient()
  const caller = await getCaller(req, admin)
  if (!caller || caller.kind !== 'user' || caller.role !== 'admin') return json({ error: 'Solo un admin puede dar acceso al portal.' }, 403)
  const body = await req.json().catch(() => ({}))
  const password = tempPassword()
  const meta = { must_change_password: true }

  if (body.action === 'reset') {
    const { data: prof } = await admin.from('profiles').select('id, role, email').eq('id', body.userId).maybeSingle()
    if (!prof || prof.role !== 'cliente') return json({ error: 'Ese usuario no es un cliente.' }, 400)
    const { error } = await admin.auth.admin.updateUserById(prof.id, { password, user_metadata: meta })
    if (error) return json({ error: error.message }, 400)
    await admin.from('profiles').update({ is_active: true }).eq('id', prof.id)
    return json({ email: prof.email, password })
  }

  if (body.action === 'create') {
    const email = String(body.email ?? '').trim().toLowerCase()
    const fullName = String(body.fullName ?? '').trim()
    const clientId = String(body.clientId ?? '')
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: 'Revisá el email.' }, 400)
    const { data: client } = await admin.from('clients').select('id').eq('id', clientId).is('deleted_at', null).maybeSingle()
    if (!client) return json({ error: 'No encontramos el cliente.' }, 400)

    const { data: existing } = await admin.from('profiles').select('id, role, client_id').ilike('email', email).maybeSingle()
    if (existing) {
      if (existing.role !== 'cliente') return json({ error: 'Ese email ya es de alguien del equipo. Usá otro.' }, 400)
      if (existing.client_id !== clientId) return json({ error: 'Ese email ya tiene acceso al portal de otro cliente.' }, 400)
      const { error } = await admin.auth.admin.updateUserById(existing.id, { password, user_metadata: { ...meta, full_name: fullName || undefined } })
      if (error) return json({ error: error.message }, 400)
      await admin.from('profiles').update({ is_active: true, ...(fullName ? { full_name: fullName } : {}) }).eq('id', existing.id)
      return json({ email, password, existed: true })
    }

    const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { ...meta, full_name: fullName || email.split('@')[0] } })
    if (error || !created.user) return json({ error: error?.message ?? 'No se pudo crear el usuario.' }, 400)
    // El perfil lo crea un trigger como "equipo": lo pasamos a cliente
    const { error: pErr } = await admin.from('profiles').update({ role: 'cliente', client_id: clientId, is_active: true, full_name: fullName || email.split('@')[0] }).eq('id', created.user.id)
    if (pErr) {
      await admin.auth.admin.deleteUser(created.user.id)
      return json({ error: pErr.message }, 400)
    }
    return json({ email, password })
  }

  return json({ error: 'Acción desconocida' }, 400)
})
