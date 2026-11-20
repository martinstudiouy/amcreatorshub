/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly VITE_DEMO_MODE?: string
  readonly VITE_ROUTER?: 'memory' | 'browser'
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
