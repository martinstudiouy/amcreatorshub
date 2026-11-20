import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Modo demo: si todavía no cargaste las claves de Supabase en el archivo .env,
 * la app funciona con datos de ejemplo guardados en memoria. Así podés recorrerla
 * antes de configurar nada.
 */
export const isDemo = !url || !anonKey || import.meta.env.VITE_DEMO_MODE === 'true'

const client: SupabaseClient<Database> | null = isDemo
  ? null
  : createClient<Database>(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })

/** Cliente de Supabase. Solo se llama cuando no estamos en modo demo. */
export function sb(): SupabaseClient<Database> {
  if (!client) throw new Error('Supabase no está configurado (modo demo).')
  return client
}
