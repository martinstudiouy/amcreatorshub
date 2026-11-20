import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// "npm run build:demo" arma un único index.html con datos de ejemplo (modo demo),
// para mostrar el CRM sin servidor. El build normal no cambia.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'demo' ? [viteSingleFile()] : [])],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: mode === 'demo' ? { outDir: 'dist-demo' } : undefined,
}))
