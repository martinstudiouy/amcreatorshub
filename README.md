# AM Creators Hub

CRM interno de **AM Creators** (Montevideo): clientes, proyectos, contenidos, agenda, mensajes, métricas de Instagram y finanzas.

- **Stack:** React + TypeScript + Tailwind + shadcn/ui · Supabase (Auth, Postgres, Storage, Edge Functions, Realtime, Cron)
- **Idioma:** español rioplatense · **Moneda:** UYU y USD · **Zona horaria:** America/Montevideo · **Fechas:** DD/MM/AAAA
- **Marca:** azul royal `#0300FF`, Montserrat, isotipo "am" en vector tomado del brandbook

## Estado: Fase 6 de 8

| Fase | Qué incluye | Estado |
| --- | --- | --- |
| 1 | Login, roles, layout, búsqueda Ctrl/Cmd + K, notificaciones, dashboard, configuración, **base de datos completa (34 tablas con RLS)** | ✅ |
| 2 | Clientes (ficha, brand kit, notas) y proyectos: tablero Kanban, lista, timeline, tareas con checklist, comentarios y adjuntos, plantillas | ✅ |
| 3 | Agenda (mes, semana, lista), recordatorios internos y sincronización en ambos sentidos con Google Calendar | ✅ |
| 4 | Finanzas (solo admin): cobros, presupuestos, gastos, fees mensuales automáticos, reportes de rentabilidad, proyección y PDFs con la marca | ✅ |
| 5 | Calendario de contenidos (mes, semana, lista y grilla de Instagram, arrastrar y soltar) y aprobación del cliente por link, sin login | ✅ |
| 6 | Instagram: conexión por OAuth (Instagram Login), publicación automática, métricas diarias, top 5, mejor horario y reporte mensual en PDF | ✅ |
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

## Publicación automática

- **App (frontend):** Netlify publica sola cada cambio en `main` (`netlify.toml`).
- **Base de datos y funciones:** el workflow `.github/workflows/supabase.yml` aplica las migraciones nuevas y publica las Edge Functions en cada cambio dentro de `supabase/`.
  Necesita estos secretos en GitHub (Settings → Secrets and variables → Actions):
  `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `APP_URL`.
- `supabase/instalar_todo.sql` contiene solo las Fases 1 y 2 (la base que se instaló a mano). Desde la Fase 3, las migraciones las aplica el workflow.

## Google Calendar

- Se conecta **una sola cuenta** (la del estudio) desde Configuración → Integraciones (solo admin).
- El refresh token se guarda en Supabase Vault; la Edge Function `google-oauth` maneja la conexión y `google-sync` sincroniza.
- Un cron (pg_cron + pg_net) llama a `google-sync` cada 5 minutos; además se sincroniza al guardar un evento.
- Los recordatorios internos los manda otro cron cada minuto (`send_event_reminders`).

## Finanzas

- Solo el rol admin ve la sección y los montos (RLS en la base, no solo en la pantalla).
- Numeración automática: `AMC-R-0001` (recibos/cobros) y `AMC-P-0001` (presupuestos), según el prefijo de Configuración → Estudio.
- Los cobros en dólares guardan el tipo de cambio de su fecha; si falta, la app avisa que hay que cargarlo en Configuración → Tipo de cambio.
- Un cron diario (`finanzas-diario`, 09:15 UTC) crea los cobros de los fees mensuales, registra los gastos fijos y marca vencidos. También corre al abrir Finanzas.
- Los PDFs son comprobantes internos: la factura electrónica (CFE) se emite en el proveedor de e-factura y su número se anota en el cobro.

## Contenidos y aprobaciones

- Los archivos de cada publicación van al bucket privado `content`, en la carpeta `<cliente>/<publicación>/`. Máximo 50 MB por archivo (límite del plan gratis de Supabase).
- “Pedir aprobación” genera un link `/aprobar/<token>`. En la base solo se guarda el sha256 del token; vence a los 14 días y se responde una sola vez.
- La página pública habla con la Edge Function `approval` (sin login), que usa `approval_payload` y `approval_submit` y arma links temporales a los archivos.
- Al responder, las publicaciones aprobadas pasan a “Aprobado”, las que tienen cambios vuelven a “Borrador” con el comentario, y el equipo recibe una notificación.
- La publicación automática en Instagram llega en la Fase 6.

## Instagram

- Usa el **inicio de sesión unificado** de Meta (Facebook Login for Business con una configuración). Meta dejó de ofrecer “Instagram Login” a las apps nuevas en octubre de 2026. No hace falta página de Facebook; sí un portfolio comercial.
- La persona que autoriza elige el portfolio y marca las cuentas de Instagram. El token es de usuario del sistema y no vence; se guarda en Vault.
- Llamadas a `graph.facebook.com/v25.0/{id de la cuenta de Instagram}`.
- Secretos en GitHub: `META_APP_ID`, `META_APP_SECRET` (Configuración de la app → Básica) y `META_CONFIG_ID` (id de la configuración del login). URL de redirección en Meta: `https://<proyecto>.supabase.co/functions/v1/instagram-oauth`.
- Permisos de la configuración: `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`.
- “Link para el cliente”: genera el link de autorización (sirve 7 días) para que el cliente conecte su cuenta sin entrar al CRM; vuelve a `/instagram-conectado`.
- `instagram-publish` corre cada minuto: arma los contenedores (imagen, video, carrusel, reel o story), espera a que Instagram procese los videos y publica. Reintenta 3 veces los errores pasajeros; si no, marca la publicación con estado Error y el motivo.
- `instagram-sync` corre todos los días a las 06:10 (Montevideo): seguidores, alcance, visualizaciones, interacciones y clics del día anterior, y métricas de las publicaciones de los últimos 90 días.
- Las imágenes se convierten a JPG en el navegador al subirlas, porque Instagram solo publica JPG.

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
