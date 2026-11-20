-- =====================================================================
-- AM Creators Hub — Datos de ejemplo (Fase 1)
-- Marcas ficticias para ver el dashboard funcionando. Todos los IDs
-- empiezan con 00000000-0000-4000-a para poder borrarlos de una vez con
-- supabase/limpiar_datos_ejemplo.sql
-- Las fechas son relativas a "hoy" en Montevideo.
-- =====================================================================

create or replace function pg_temp.at(day_offset int, hhmm text)
returns timestamptz language sql as $$
  select ((public.today_mvd() + day_offset) + hhmm::time) at time zone 'America/Montevideo'
$$;

-- Tipo de cambio de ejemplo
insert into public.exchange_rates (id, date, usd_to_uyu, note) values
  ('00000000-0000-4000-a000-000000000901', public.today_mvd() - 20, 39.6500, 'Ejemplo: cargá el valor real'),
  ('00000000-0000-4000-a000-000000000902', public.today_mvd(),      39.8000, 'Ejemplo: cargá el valor real');

-- Clientes
insert into public.clients (id, name, brand_name, industry, email, whatsapp, instagram_handle, monthly_fee, currency, start_date, status, color_tag) values
  ('00000000-0000-4000-a000-000000000001', 'Sofía Pereira',  'Café Rambla',          'Gastronomía',        'hola@caferambla.uy',      '+59899123456', 'caferambla',       18000, 'UYU', public.today_mvd() - 240, 'activo',     '#0300FF'),
  ('00000000-0000-4000-a000-000000000002', 'Valentina Ruiz', 'Pilates Pocitos',      'Salud y bienestar',  'contacto@pilatespocitos.uy','+59898765432','pilatespocitos',   15000, 'UYU', public.today_mvd() - 120, 'activo',     '#16A34A'),
  ('00000000-0000-4000-a000-000000000003', 'Diego Fernández','Bodega Los Altos',     'Vinos',              'diego@bodegalosaltos.uy', '+59894111222', 'bodegalosaltos',   null,  'USD', public.today_mvd() - 30,  'activo',     '#9333EA'),
  ('00000000-0000-4000-a000-000000000004', 'Martina Silva',  'Nómade Surf',          'Deportes',           'martina@nomadesurf.uy',   '+59892333444', 'nomadesurf.uy',    12000, 'UYU', public.today_mvd() - 300, 'pausado',    '#EA580C'),
  ('00000000-0000-4000-a000-000000000005', 'Jorge Méndez',   'Ferretería El Tornillo','Comercio',          'ventas@eltornillo.uy',    '+59891555666', 'ferreteriaeltornillo', null, 'UYU', null,                   'lead',       '#64748B');

insert into public.client_services (id, client_id, service, description) values
  ('00000000-0000-4000-a000-000000000011', '00000000-0000-4000-a000-000000000001', 'redes',      'Gestión de Instagram: 12 posts y 8 reels por mes'),
  ('00000000-0000-4000-a000-000000000012', '00000000-0000-4000-a000-000000000002', 'redes',      'Gestión de Instagram: 8 posts por mes'),
  ('00000000-0000-4000-a000-000000000013', '00000000-0000-4000-a000-000000000002', 'fotografia', 'Sesión mensual en estudio'),
  ('00000000-0000-4000-a000-000000000014', '00000000-0000-4000-a000-000000000003', 'branding',   'Identidad visual completa'),
  ('00000000-0000-4000-a000-000000000015', '00000000-0000-4000-a000-000000000004', 'web',        'Sitio institucional');

insert into public.client_assets (id, client_id, kind, name, value, sort_order) values
  ('00000000-0000-4000-a000-000000000021', '00000000-0000-4000-a000-000000000001', 'color', 'Azul Rambla', '#1E3A8A', 1),
  ('00000000-0000-4000-a000-000000000022', '00000000-0000-4000-a000-000000000001', 'color', 'Crema',       '#F5EFE6', 2),
  ('00000000-0000-4000-a000-000000000023', '00000000-0000-4000-a000-000000000001', 'font',  'Títulos',     'Playfair Display', 3);

insert into public.client_notes (id, client_id, body, is_pinned) values
  ('00000000-0000-4000-a000-000000000031', '00000000-0000-4000-a000-000000000001', 'Prefiere aprobar el contenido los lunes. Nada de fondos negros.', true);

-- Plantillas de proyecto
insert into public.project_templates (id, name, project_type, description, default_budget) values
  ('00000000-0000-4000-a000-000000000041', 'Identidad visual completa', 'branding', 'Desde el brief hasta el manual de marca', 60000),
  ('00000000-0000-4000-a000-000000000042', 'Gestión mensual de redes',  'redes',    'Planificación, producción y publicación del mes', null);

insert into public.template_tasks (id, template_id, title, day_offset, default_priority, checklist, position) values
  ('00000000-0000-4000-a000-000000000051', '00000000-0000-4000-a000-000000000041', 'Brief y reunión de arranque', 0,  'alta',  '{"Cuestionario de marca","Referencias visuales"}', 1),
  ('00000000-0000-4000-a000-000000000052', '00000000-0000-4000-a000-000000000041', 'Moodboard',                   5,  'media', '{}', 2),
  ('00000000-0000-4000-a000-000000000053', '00000000-0000-4000-a000-000000000041', 'Propuestas de logo',          14, 'alta',  '{"3 rutas creativas"}', 3),
  ('00000000-0000-4000-a000-000000000054', '00000000-0000-4000-a000-000000000041', 'Manual de marca',             28, 'media', '{}', 4),
  ('00000000-0000-4000-a000-000000000055', '00000000-0000-4000-a000-000000000042', 'Planificación del mes',       0,  'alta',  '{"Fechas clave","Grilla"}', 1),
  ('00000000-0000-4000-a000-000000000056', '00000000-0000-4000-a000-000000000042', 'Producción de piezas',        5,  'media', '{}', 2),
  ('00000000-0000-4000-a000-000000000057', '00000000-0000-4000-a000-000000000042', 'Reporte mensual',             29, 'media', '{}', 3);

-- Proyectos
insert into public.projects (id, client_id, name, type, start_date, due_date, budget, currency, status, template_id) values
  ('00000000-0000-4000-a000-000000000061', '00000000-0000-4000-a000-000000000001', 'Redes: plan del mes',        'redes',      date_trunc('month', public.today_mvd())::date, (date_trunc('month', public.today_mvd()) + interval '1 month - 1 day')::date, 18000, 'UYU', 'activo', '00000000-0000-4000-a000-000000000042'),
  ('00000000-0000-4000-a000-000000000062', '00000000-0000-4000-a000-000000000003', 'Identidad visual completa',  'branding',   public.today_mvd() - 20, public.today_mvd() + 25, 1800, 'USD', 'activo', '00000000-0000-4000-a000-000000000041'),
  ('00000000-0000-4000-a000-000000000063', '00000000-0000-4000-a000-000000000002', 'Sesión de fotos de temporada','fotografia', public.today_mvd() - 5,  public.today_mvd() + 7,  9000, 'UYU', 'activo', null),
  ('00000000-0000-4000-a000-000000000064', '00000000-0000-4000-a000-000000000004', 'Web institucional',          'web',        public.today_mvd() - 90, public.today_mvd() + 30, 45000, 'UYU', 'en_pausa', null);

-- Tareas
insert into public.tasks (id, project_id, title, due_date, priority, "column", position) values
  ('00000000-0000-4000-a000-000000000071', '00000000-0000-4000-a000-000000000062', 'Propuestas de logo (3 rutas)',     public.today_mvd() - 1, 'urgente', 'en_proceso',  1),
  ('00000000-0000-4000-a000-000000000072', '00000000-0000-4000-a000-000000000061', 'Diseñar carrusel de la carta de verano', public.today_mvd(), 'alta', 'en_proceso', 2),
  ('00000000-0000-4000-a000-000000000073', '00000000-0000-4000-a000-000000000061', 'Editar reel del brunch',           public.today_mvd(),     'media',   'por_hacer',   3),
  ('00000000-0000-4000-a000-000000000074', '00000000-0000-4000-a000-000000000063', 'Armar shotlist de la sesión',      public.today_mvd(),     'media',   'en_proceso',  4),
  ('00000000-0000-4000-a000-000000000075', '00000000-0000-4000-a000-000000000063', 'Confirmar modelos y vestuario',    public.today_mvd() + 1, 'alta',    'por_hacer',   5),
  ('00000000-0000-4000-a000-000000000076', '00000000-0000-4000-a000-000000000061', 'Copys de la semana',               public.today_mvd() + 2, 'baja',    'por_hacer',   6),
  ('00000000-0000-4000-a000-000000000077', '00000000-0000-4000-a000-000000000062', 'Moodboard',                        public.today_mvd() - 10,'media',   'entregado',   7),
  ('00000000-0000-4000-a000-000000000078', '00000000-0000-4000-a000-000000000062', 'Manual de marca',                  public.today_mvd() + 20,'media',   'por_hacer',   8);

insert into public.task_checklist_items (id, task_id, label, is_done, position) values
  ('00000000-0000-4000-a000-000000000081', '00000000-0000-4000-a000-000000000071', 'Ruta clásica',  true,  1),
  ('00000000-0000-4000-a000-000000000082', '00000000-0000-4000-a000-000000000071', 'Ruta moderna',  true,  2),
  ('00000000-0000-4000-a000-000000000083', '00000000-0000-4000-a000-000000000071', 'Ruta artesanal', false, 3);

-- Cuentas sociales (sin tokens: son de ejemplo)
insert into public.social_accounts (id, client_id, platform, external_id, username, display_name, account_type, status, token_expires_at) values
  ('00000000-0000-4000-a000-000000000101', null,                                   'instagram', 'demo-amcreators', 'amcreators',     'AM Creators',      'business', 'conectada',  now() + interval '50 days'),
  ('00000000-0000-4000-a000-000000000102', '00000000-0000-4000-a000-000000000001', 'instagram', 'demo-caferambla', 'caferambla',     'Café Rambla',      'business', 'conectada',  now() + interval '40 days'),
  ('00000000-0000-4000-a000-000000000103', '00000000-0000-4000-a000-000000000003', 'instagram', 'demo-bodega',     'bodegalosaltos', 'Bodega Los Altos', 'business', 'por_vencer', now() + interval '4 days'),
  ('00000000-0000-4000-a000-000000000104', null,                                   'whatsapp',  'demo-wa',         '+598 99 000 000','AM Creators',      null,       'conectada',  null);

-- Métricas de la cuenta propia: 35 días de seguidores en subida
insert into public.ig_metrics_daily (social_account_id, date, followers, follows, reach, views, interactions, profile_views, link_clicks, engagement_rate)
select '00000000-0000-4000-a000-000000000101',
       public.today_mvd() - g,
       2310 - g * 5,
       412,
       900 + ((g * 37) % 400),
       2100 + ((g * 53) % 900),
       80 + ((g * 11) % 60),
       60 + ((g * 7) % 40),
       6 + (g % 9),
       round(((80 + ((g * 11) % 60))::numeric / (900 + ((g * 37) % 400))) * 100, 3)
from generate_series(0, 34) g;

-- Publicaciones
insert into public.content_posts (id, client_id, social_account_id, format, scheduled_at, caption, hashtags, status) values
  ('00000000-0000-4000-a000-000000000111', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000102', 'carrusel', pg_temp.at(0, '12:30'), 'Llegó la carta de verano: 5 bebidas frías para la rambla', '#montevideo #cafe', 'aprobado'),
  ('00000000-0000-4000-a000-000000000112', '00000000-0000-4000-a000-000000000002', null,                                   'reel',     pg_temp.at(0, '18:00'), 'Clase abierta de reformer: te esperamos el sábado',          '#pilates #pocitos', 'aprobado'),
  ('00000000-0000-4000-a000-000000000113', '00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000103', 'feed',     pg_temp.at(0, '20:00'), 'Detrás de escena: así nace nuestra nueva etiqueta',          '#vino #uruguay', 'en_aprobacion'),
  ('00000000-0000-4000-a000-000000000114', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000102', 'reel',     pg_temp.at(1, '13:00'), 'Brunch de domingo en 15 segundos',                           '#brunch', 'borrador'),
  ('00000000-0000-4000-a000-000000000115', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000102', 'story',    pg_temp.at(3, '10:00'), 'Encuesta: ¿qué torta sumamos?',                              null, 'idea');

-- Agenda
insert into public.events (id, client_id, type, title, starts_at, ends_at, location, meet_url, notes) values
  ('00000000-0000-4000-a000-000000000121', '00000000-0000-4000-a000-000000000003', 'reunion',      'Presentación de rutas de logo', pg_temp.at(0, '10:00'), pg_temp.at(0, '11:00'), null, 'https://meet.google.com/abc-defg-hij', 'Llevar las 3 rutas impresas en PDF'),
  ('00000000-0000-4000-a000-000000000122', '00000000-0000-4000-a000-000000000002', 'sesion_fotos', 'Sesión de fotos de temporada',  pg_temp.at(0, '15:00'), pg_temp.at(0, '17:30'), 'Estudio AM Creators', null, null),
  ('00000000-0000-4000-a000-000000000123', '00000000-0000-4000-a000-000000000005', 'reunion',      'Primera reunión: redes',        pg_temp.at(1, '09:30'), pg_temp.at(1, '10:15'), 'Ferretería El Tornillo, Av. Italia', null, null),
  ('00000000-0000-4000-a000-000000000124', '00000000-0000-4000-a000-000000000001', 'entrega',      'Entrega del plan de diciembre', pg_temp.at(5, '09:00'), pg_temp.at(5, '09:00'), null, null, null);

-- Finanzas
insert into public.recurring_fees (id, client_id, description, amount, currency, billing_day, start_date) values
  ('00000000-0000-4000-a000-000000000131', '00000000-0000-4000-a000-000000000001', 'Gestión de redes', 18000, 'UYU', 1, public.today_mvd() - 240),
  ('00000000-0000-4000-a000-000000000132', '00000000-0000-4000-a000-000000000002', 'Gestión de redes', 15000, 'UYU', 5, public.today_mvd() - 120);

insert into public.invoices (id, client_id, project_id, recurring_fee_id, number, issue_date, due_date, currency, fx_rate, total, status, paid_at, payment_method) values
  ('00000000-0000-4000-a000-000000000141', '00000000-0000-4000-a000-000000000001', null, '00000000-0000-4000-a000-000000000131', 'EJ-0001', date_trunc('month', public.today_mvd())::date,                     date_trunc('month', public.today_mvd())::date + 10, 'UYU', 1,       18000, 'cobrado',   now() - interval '8 days', 'Transferencia'),
  ('00000000-0000-4000-a000-000000000142', '00000000-0000-4000-a000-000000000002', null, '00000000-0000-4000-a000-000000000132', 'EJ-0002', (date_trunc('month', public.today_mvd()) + interval '4 days')::date, public.today_mvd() + 5,                         'UYU', 1,       15000, 'pendiente', null, null),
  ('00000000-0000-4000-a000-000000000143', '00000000-0000-4000-a000-000000000003', '00000000-0000-4000-a000-000000000062', null, 'EJ-0003', public.today_mvd() - 20,                                       public.today_mvd() - 15,                        'USD', 39.6500, 900,   'cobrado',   now() - interval '17 days', 'Transferencia'),
  ('00000000-0000-4000-a000-000000000144', '00000000-0000-4000-a000-000000000004', '00000000-0000-4000-a000-000000000064', null, 'EJ-0004', public.today_mvd() - 40,                                       public.today_mvd() - 25,                        'UYU', 1,       12000, 'vencido',   null, null);

insert into public.invoice_items (id, invoice_id, description, quantity, unit_price, position) values
  ('00000000-0000-4000-a000-000000000151', '00000000-0000-4000-a000-000000000141', 'Gestión de redes: mes en curso', 1, 18000, 1),
  ('00000000-0000-4000-a000-000000000152', '00000000-0000-4000-a000-000000000142', 'Gestión de redes: mes en curso', 1, 15000, 1),
  ('00000000-0000-4000-a000-000000000153', '00000000-0000-4000-a000-000000000143', 'Identidad visual: anticipo 50%', 1, 900,   1),
  ('00000000-0000-4000-a000-000000000154', '00000000-0000-4000-a000-000000000144', 'Web institucional: segunda cuota', 1, 12000, 1);

insert into public.expenses (id, category, description, amount, currency, fx_rate, date, is_recurring, recurrence_day) values
  ('00000000-0000-4000-a000-000000000161', 'software', 'Adobe Creative Cloud', 60, 'USD', 39.8, public.today_mvd() - 3, true, 15),
  ('00000000-0000-4000-a000-000000000162', 'software', 'Supabase Pro',          25, 'USD', 39.8, public.today_mvd() - 3, true, 15);

-- Mensajes
insert into public.conversations (id, channel, external_contact_id, contact_name, client_id, social_account_id, labels, status, last_message_at, last_inbound_at, last_message_preview, unread_count) values
  ('00000000-0000-4000-a000-000000000171', 'whatsapp',  '+59899123456', 'Sofía Pereira', '00000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000104', '{cliente}', 'abierta', now() - interval '25 minutes', now() - interval '25 minutes', '¿Podemos cambiar la foto del carrusel de hoy?', 2),
  ('00000000-0000-4000-a000-000000000172', 'instagram', 'demo-lucia',   'lucia.eventos', null,                                   '00000000-0000-4000-a000-000000000101', '{lead}',    'abierta', now() - interval '2 hours',    now() - interval '2 hours',    'Hola! Quería saber precios de branding', 1),
  ('00000000-0000-4000-a000-000000000173', 'whatsapp',  '+59891555666', 'Jorge Méndez',  '00000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000104', '{lead,consulta}', 'abierta', now() - interval '5 hours', now() - interval '5 hours', 'Confirmo la reunión de mañana', 1);

insert into public.messages (id, conversation_id, direction, type, body, sent_at) values
  ('00000000-0000-4000-a000-000000000181', '00000000-0000-4000-a000-000000000171', 'entrante', 'texto', 'Hola Martín!',                                         now() - interval '26 minutes'),
  ('00000000-0000-4000-a000-000000000182', '00000000-0000-4000-a000-000000000171', 'entrante', 'texto', '¿Podemos cambiar la foto del carrusel de hoy?',        now() - interval '25 minutes'),
  ('00000000-0000-4000-a000-000000000183', '00000000-0000-4000-a000-000000000172', 'entrante', 'texto', 'Hola! Quería saber precios de branding',               now() - interval '2 hours'),
  ('00000000-0000-4000-a000-000000000184', '00000000-0000-4000-a000-000000000173', 'entrante', 'texto', 'Confirmo la reunión de mañana',                        now() - interval '5 hours');

insert into public.quick_replies (id, shortcut, title, body) values
  ('00000000-0000-4000-a000-000000000191', '/precios', 'Precios de branding', '¡Hola! Gracias por escribirnos. Te paso nuestra propuesta de identidad visual: ¿te queda bien una llamada de 15 minutos para entender tu marca?'),
  ('00000000-0000-4000-a000-000000000192', '/gracias', 'Agradecimiento',       '¡Gracias! Cualquier cosa nos escribís por acá.');

-- Repartir la actividad generada por los triggers en las últimas horas
with ranked as (
  select id, row_number() over (order by created_at, id) as rn, count(*) over () as total
  from public.activity_log
)
update public.activity_log a
set created_at = now() - ((ranked.total - ranked.rn) * interval '37 minutes')
from ranked where ranked.id = a.id;

-- Algunos cambios de estado para que la actividad sea variada
update public.tasks set "column" = 'en_revision' where id = '00000000-0000-4000-a000-000000000074';
update public.content_posts set status = 'programado' where id = '00000000-0000-4000-a000-000000000111';
