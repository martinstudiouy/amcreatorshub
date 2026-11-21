# AM Creators Hub

CRM interno de **AM Creators** (Montevideo): clientes, proyectos, contenidos, agenda, mensajes, métricas de Instagram y finanzas.

- **Stack:** React + TypeScript + Tailwind + shadcn/ui · Supabase (Auth, Postgres, Storage, Edge Functions, Realtime, Cron)
- **Idioma:** español rioplatense · **Moneda:** UYU y USD · **Zona horaria:** America/Montevideo · **Fechas:** DD/MM/AAAA
- **Marca:** azul royal `#0300FF`, Montserrat, isotipo "am" en vector tomado del brandbook

## Estado: Fase 2 de 8

| Fase | Qué incluye | Estado |
| --- | --- | --- |
| 1 | Login, roles, layout, búsqueda Ctrl/Cmd + K, notificaciones, dashboard, configuración, **base de datos completa (34 tablas con RLS)** | ✅ |
| 2 | Clientes (ficha, brand kit, notas) y proyectos: tablero Kanban, lista, timeline, tareas con checklist, comentarios y adjuntos, plantillas | ✅ |
| 3 | Agenda + Google Calendar | — |
| 4 | Finanzas y PDFs | — |
| 5 | Calendario de contenidos y aprobaciones | — |
| 6 | Instagram: conexión, métricas y publicación automática | — |
| 7 | Bandeja unificada WhatsApp + Instagram | — |
| 8 | Portal de cliente y reportes mensuales | — |

## Probarlo sin configurar nada (modo demo)

Si no hay archivo `.env`, la app arranca en **modo demo** con datos de ejemplo y te deja entrar como Admin, Equipo o Cliente.

```bash
npm install
npm run dev          # abre http://localhost:5173
npm run build:demo   # arma dist-demo/index.html: un solo archivo que se abre con doble clic
```

## Conectar Supabase

1. Creá un proyecto en [supabase.com](https://supabase.com) (región São Paulo, la más cercana).
2. En **SQL Editor**, pegá y corré `supabase/instalar_todo.sql` (crea las 34 tablas, vistas, permisos y buckets).
   Si ya habías instalado una fase anterior, corré solo los archivos nuevos de `supabase/migrations/`, en orden.
3. Opcional: corré `supabase/seed.sql` para cargar datos de ejemplo. Para borrarlos después: `supabase/limpiar_datos_ejemplo.sql`.
4. Copiá `.env.example` como `.env` y completá URL y clave *anon* (Project Settings → API).
5. Creá tu usuario en **Authentication → Users → Add user**. **El primer usuario queda como Admin**; los siguientes, como Equipo.
6. En **Authentication → URL Configuration** poné la URL donde publiques la app (y `http://localhost:5173` para desarrollo), para que funcionen los links de recuperar contraseña.

## Estructura

```
supabase/
  migrations/      esquema (34 tablas), RLS + funciones, Storage
  seed.sql         datos de ejemplo (IDs 00000000-0000-4000-a…)
  instalar_todo.sql  las 3 migraciones en un solo archivo
src/
  components/ui      componentes base (estilo shadcn/ui)
  components/layout  barra lateral, barra superior, Ctrl/Cmd + K, notificaciones, logo
  data/              acceso a datos (Supabase o demo), tipos y etiquetas
  features/          un módulo por sección: auth, dashboard, clients, projects, settings…
  types/database.ts  tipos generados desde Supabase
```

## Seguridad

- RLS activado en las 34 tablas; por defecto nadie ve nada hasta que una política lo permite.
- El equipo no ve finanzas ni montos (fee del cliente, presupuesto del proyecto): se leen desde las vistas `clients_v` y `projects_v`.
- Un usuario que no es admin no puede cambiarse el rol; siempre tiene que quedar al menos un admin activo.
- Los tokens de Meta y Google irán en Supabase Vault (Fases 3, 6 y 7); las tablas guardan solo una referencia.

## Comandos

| Comando | Para qué |
| --- | --- |
| `npm run dev` | Desarrollo local |
| `npm run build` | Build de producción (`dist/`) |
| `npm run build:demo` | Demo en un solo archivo (`dist-demo/index.html`) |
| `npm run typecheck` | Revisión de tipos |
| `npm run types` | Regenera `src/types/database.ts` desde el proyecto vinculado |
