-- =====================================================================
-- AM Creators Hub — INSTALACIÓN COMPLETA (Fases 1 y 2)
-- Pegá TODO este archivo en Supabase → SQL Editor → New query → Run.
-- Es la suma de las migraciones de supabase/migrations, en orden.
-- =====================================================================

-- >>> supabase/migrations/20261120000001_schema.sql
-- =====================================================================
-- AM Creators Hub — Esquema base (Fase 1)
-- 34 tablas en 8 módulos. Las reglas de acceso (RLS) están en la
-- migración 20261120000002_rls.sql.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.user_role         as enum ('admin', 'equipo', 'cliente');
create type public.currency_code     as enum ('UYU', 'USD');
create type public.client_status     as enum ('lead', 'activo', 'pausado', 'finalizado');
create type public.service_type      as enum ('branding', 'redes', 'web', 'fotografia', 'otro');
create type public.asset_kind        as enum ('logo', 'color', 'font', 'file');
create type public.project_status    as enum ('activo', 'en_pausa', 'terminado', 'cancelado');
create type public.task_column       as enum ('por_hacer', 'en_proceso', 'en_revision', 'aprobado', 'entregado');
create type public.task_priority     as enum ('baja', 'media', 'alta', 'urgente');
create type public.post_format       as enum ('feed', 'carrusel', 'reel', 'story');
create type public.post_status       as enum ('idea', 'borrador', 'en_aprobacion', 'aprobado', 'programado', 'publicado', 'error');
create type public.media_type        as enum ('imagen', 'video');
create type public.event_type        as enum ('reunion', 'evento', 'sesion_fotos', 'entrega');
create type public.sync_status       as enum ('local', 'sincronizado', 'pendiente', 'error');
create type public.connection_status as enum ('conectado', 'desconectado');
create type public.quote_status      as enum ('borrador', 'enviado', 'aceptado', 'rechazado', 'vencido');
create type public.invoice_status    as enum ('pendiente', 'cobrado', 'vencido', 'anulado');
create type public.expense_category  as enum ('software', 'equipos', 'publicidad', 'freelancers', 'impuestos', 'otros');
create type public.channel_type      as enum ('whatsapp', 'instagram');
create type public.conversation_status as enum ('abierta', 'pendiente', 'cerrada');
create type public.message_direction as enum ('entrante', 'saliente');
create type public.message_type      as enum ('texto', 'imagen', 'video', 'audio', 'documento', 'plantilla');
create type public.delivery_status   as enum ('enviado', 'entregado', 'leido', 'fallo');
create type public.template_status   as enum ('aprobada', 'pendiente', 'rechazada');
create type public.account_status    as enum ('conectada', 'por_vencer', 'desconectada');
create type public.ig_account_type   as enum ('business', 'creator');

-- ---------------------------------------------------------------------
-- Utilidad: updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- =====================================================================
-- 1. Usuarios, configuración y actividad (5)
-- =====================================================================
-- clients se crea antes porque profiles.client_id apunta ahí.

create table public.clients (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,                       -- persona de contacto
  brand_name       text not null,
  industry         text,
  email            text,
  whatsapp         text,                                -- formato +598...
  instagram_handle text,
  monthly_fee      numeric(12,2),
  currency         public.currency_code not null default 'UYU',
  start_date       date,
  status           public.client_status not null default 'lead',
  color_tag        text,
  created_by       uuid,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  email       text,
  avatar_path text,
  role        public.user_role not null default 'equipo',
  client_id   uuid references public.clients (id) on delete set null,
  phone       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_cliente_needs_client check (role <> 'cliente' or client_id is not null)
);

alter table public.clients
  add constraint clients_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null;

create table public.settings (
  id                   boolean primary key default true check (id),   -- una sola fila
  studio_name          text not null default 'AM Creators',
  legal_name           text,
  rut                  text,
  address              text,
  email                text,
  phone                text,
  website              text,
  logo_path            text,
  default_currency     public.currency_code not null default 'UYU',
  vat_mode             text not null default 'sin_definir'
                         check (vat_mode in ('sin_definir', 'monotributo', 'iva')),
  vat_rate             numeric(5,2) not null default 22,
  invoice_prefix       text not null default 'AMC',
  next_invoice_number  integer not null default 1,
  next_quote_number    integer not null default 1,
  quote_validity_days  integer not null default 15,
  theme_default        text not null default 'system' check (theme_default in ('light', 'dark', 'system')),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
insert into public.settings (id) values (true);

create table public.exchange_rates (
  id          uuid primary key default gen_random_uuid(),
  date        date not null unique,
  usd_to_uyu  numeric(10,4) not null check (usd_to_uyu > 0),
  note        text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles (id) on delete set null,
  entity_type text not null,
  entity_id   uuid,
  action      text not null,
  summary     text not null,
  client_id   uuid references public.clients (id) on delete set null,
  created_at  timestamptz not null default now()
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 2. Clientes y brand kit (4)  — clients ya creada arriba
-- =====================================================================
create table public.client_services (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  service     public.service_type not null,
  description text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.client_assets (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients (id) on delete cascade,
  kind         public.asset_kind not null,
  name         text not null,
  storage_path text,
  value        text,           -- p. ej. #0300FF para un color
  sort_order   integer not null default 0,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.client_notes (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  body       text not null,
  is_pinned  boolean not null default false,
  author_id  uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =====================================================================
-- 3. Proyectos, tareas y plantillas (7)
-- =====================================================================
create table public.project_templates (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  project_type   public.service_type not null,
  description    text,
  default_budget numeric(12,2),
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.template_tasks (
  id               uuid primary key default gen_random_uuid(),
  template_id      uuid not null references public.project_templates (id) on delete cascade,
  title            text not null,
  description      text,
  day_offset       integer not null default 0,
  default_priority public.task_priority not null default 'media',
  checklist        text[] not null default '{}',
  position         integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete restrict,
  name        text not null,
  type        public.service_type not null,
  start_date  date,
  due_date    date,
  budget      numeric(12,2),
  currency    public.currency_code not null default 'UYU',
  status      public.project_status not null default 'activo',
  template_id uuid references public.project_templates (id) on delete set null,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  title       text not null,
  description text,
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date    date,
  priority    public.task_priority not null default 'media',
  "column"    public.task_column not null default 'por_hacer',
  position    double precision not null default 0,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table public.task_checklist_items (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  label      text not null,
  is_done    boolean not null default false,
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_comments (
  id         uuid primary key default gen_random_uuid(),
  task_id    uuid not null references public.tasks (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  body       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_attachments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references public.tasks (id) on delete cascade,
  storage_path text not null,
  file_name    text not null,
  mime_type    text,
  size_bytes   bigint,
  uploaded_by  uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- =====================================================================
-- 8 (antes que 4 y 7). Cuentas sociales — las usan contenidos y mensajes
-- =====================================================================
create table public.social_accounts (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid references public.clients (id) on delete cascade,  -- null = cuenta propia
  platform         public.channel_type not null,
  external_id      text not null,
  username         text,
  display_name     text,
  account_type     public.ig_account_type,
  vault_secret_id  uuid,          -- token en Supabase Vault, nunca en claro
  token_expires_at timestamptz,
  scopes           text[] not null default '{}',
  status           public.account_status not null default 'conectada',
  last_error       text,
  connected_by     uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (platform, external_id)
);

-- =====================================================================
-- 4. Calendario de contenidos y aprobaciones (3)
-- =====================================================================
create table public.content_posts (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients (id) on delete restrict,
  social_account_id uuid references public.social_accounts (id) on delete set null,
  format            public.post_format not null default 'feed',
  scheduled_at      timestamptz,
  caption           text,
  hashtags          text,
  status            public.post_status not null default 'idea',
  ig_media_id       text,
  ig_permalink      text,
  published_at      timestamptz,
  error_message     text,
  publish_attempts  integer not null default 0,
  grid_position     integer,
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create table public.content_media (
  id           uuid primary key default gen_random_uuid(),
  post_id      uuid not null references public.content_posts (id) on delete cascade,
  storage_path text not null,
  media_type   public.media_type not null,
  position     integer not null default 0,
  width        integer,
  height       integer,
  duration_s   numeric(8,2),
  cover_path   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.approvals (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients (id) on delete cascade,
  token_hash     text not null unique,                   -- sha256 del token, nunca el token
  post_ids       uuid[] not null,
  decisions      jsonb not null default '{}'::jsonb,     -- { post_id: { decision, comment } }
  client_comment text,
  expires_at     timestamptz not null default now() + interval '14 days',
  decided_at     timestamptz,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- =====================================================================
-- 5. Agenda y Google Calendar (2)
-- =====================================================================
create table public.events (
  id                        uuid primary key default gen_random_uuid(),
  client_id                 uuid references public.clients (id) on delete set null,
  type                      public.event_type not null default 'reunion',
  title                     text not null,
  starts_at                 timestamptz not null,
  ends_at                   timestamptz not null,
  all_day                   boolean not null default false,
  location                  text,
  meet_url                  text,
  notes                     text,
  attendee_ids              uuid[] not null default '{}',
  remind_minutes_before     integer default 30,
  whatsapp_reminder         boolean not null default false,
  whatsapp_reminder_sent_at timestamptz,
  google_event_id           text,
  google_etag               text,
  sync_status               public.sync_status not null default 'local',
  created_by                uuid references public.profiles (id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  deleted_at                timestamptz,
  constraint events_dates_ok check (ends_at >= starts_at)
);

create table public.calendar_connections (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  google_email     text not null,
  calendar_id      text not null default 'primary',
  vault_secret_id  uuid,
  sync_token       text,
  watch_channel_id text,
  watch_expires_at timestamptz,
  last_synced_at   timestamptz,
  status           public.connection_status not null default 'conectado',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (user_id, calendar_id)
);

-- =====================================================================
-- 6. Finanzas (6) — solo admin
-- =====================================================================
create table public.recurring_fees (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete cascade,
  description text not null default 'Fee mensual',
  amount      numeric(12,2) not null check (amount >= 0),
  currency    public.currency_code not null default 'UYU',
  billing_day smallint not null default 1 check (billing_day between 1 and 28),
  start_date  date not null default current_date,
  end_date    date,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.quotes (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients (id) on delete restrict,
  project_id  uuid references public.projects (id) on delete set null,
  number      text not null unique,
  issue_date  date not null default current_date,
  valid_until date,
  currency    public.currency_code not null default 'UYU',
  fx_rate     numeric(10,4) not null default 1,
  subtotal    numeric(12,2) not null default 0,
  discount    numeric(12,2) not null default 0,
  total       numeric(12,2) not null default 0,
  status      public.quote_status not null default 'borrador',
  pdf_path    text,
  notes       text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table public.quote_items (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references public.quotes (id) on delete cascade,
  description text not null,
  quantity    numeric(10,2) not null default 1,
  unit_price  numeric(12,2) not null default 0,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.invoices (
  id               uuid primary key default gen_random_uuid(),
  client_id        uuid not null references public.clients (id) on delete restrict,
  project_id       uuid references public.projects (id) on delete set null,
  recurring_fee_id uuid references public.recurring_fees (id) on delete set null,
  number           text not null unique,
  issue_date       date not null default current_date,
  due_date         date,
  currency         public.currency_code not null default 'UYU',
  fx_rate          numeric(10,4) not null default 1,     -- UYU por 1 unidad de la moneda
  total            numeric(12,2) not null default 0,
  status           public.invoice_status not null default 'pendiente',
  paid_at          timestamptz,
  payment_method   text,
  cfe_number       text,                                 -- e-factura oficial (DGI)
  pdf_path         text,
  notes            text,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

create table public.invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices (id) on delete cascade,
  description text not null,
  quantity    numeric(10,2) not null default 1,
  unit_price  numeric(12,2) not null default 0,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.expenses (
  id             uuid primary key default gen_random_uuid(),
  category       public.expense_category not null default 'otros',
  description    text not null,
  amount         numeric(12,2) not null check (amount >= 0),
  currency       public.currency_code not null default 'UYU',
  fx_rate        numeric(10,4) not null default 1,
  date           date not null default current_date,
  client_id      uuid references public.clients (id) on delete set null,
  project_id     uuid references public.projects (id) on delete set null,
  is_recurring   boolean not null default false,
  recurrence_day smallint check (recurrence_day between 1 and 28),
  receipt_path   text,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

-- =====================================================================
-- 7. Bandeja de mensajes (4)
-- =====================================================================
create table public.conversations (
  id                  uuid primary key default gen_random_uuid(),
  channel             public.channel_type not null,
  external_contact_id text not null,
  contact_name        text,
  client_id           uuid references public.clients (id) on delete set null,
  social_account_id   uuid references public.social_accounts (id) on delete set null,
  labels              text[] not null default '{}'
                        check (labels <@ array['lead', 'consulta', 'soporte', 'cliente']),
  status              public.conversation_status not null default 'abierta',
  assignee_id         uuid references public.profiles (id) on delete set null,
  last_message_at     timestamptz,
  last_inbound_at     timestamptz,
  last_message_preview text,
  unread_count        integer not null default 0,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (channel, social_account_id, external_contact_id)
);

create table public.messages (
  id                  uuid primary key default gen_random_uuid(),
  conversation_id     uuid not null references public.conversations (id) on delete cascade,
  direction           public.message_direction not null,
  external_message_id text unique,
  type                public.message_type not null default 'texto',
  body                text,
  media_path          text,
  template_name       text,
  sent_by             uuid references public.profiles (id) on delete set null,
  delivery_status     public.delivery_status,
  error_message       text,
  sent_at             timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.quick_replies (
  id         uuid primary key default gen_random_uuid(),
  shortcut   text not null unique check (shortcut ~ '^/[a-z0-9_-]+$'),
  title      text not null,
  body       text not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whatsapp_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  language   text not null default 'es',
  category   text,
  body       text not null,
  variables  text[] not null default '{}',
  status     public.template_status not null default 'pendiente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, language)
);

-- =====================================================================
-- 8. Métricas de Instagram (2 más; social_accounts arriba)
-- =====================================================================
create table public.ig_metrics_daily (
  id                uuid primary key default gen_random_uuid(),
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,
  date              date not null,
  followers         integer,
  follows           integer,
  reach             integer,
  views             integer,
  interactions      integer,
  profile_views     integer,
  link_clicks       integer,
  engagement_rate   numeric(6,3),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (social_account_id, date)
);

create table public.ig_post_metrics (
  id                uuid primary key default gen_random_uuid(),
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,
  ig_media_id       text not null,
  content_post_id   uuid references public.content_posts (id) on delete set null,
  media_type        text,
  permalink         text,
  caption           text,
  posted_at         timestamptz,
  snapshot_date     date not null,
  reach             integer,
  views             integer,
  likes             integer,
  comments          integer,
  saves             integer,
  shares            integer,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (ig_media_id, snapshot_date)
);

-- ---------------------------------------------------------------------
-- updated_at en todas las tablas que lo tienen
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  for t in
    select c.table_name from information_schema.columns c
    join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public' and c.column_name = 'updated_at' and tb.table_type = 'BASE TABLE'
  loop
    execute format('create trigger set_updated_at before update on public.%I
                    for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Índices (claves foráneas y filtros frecuentes)
-- ---------------------------------------------------------------------
create index on public.profiles (client_id);
create index on public.clients (status) where deleted_at is null;
create index on public.activity_log (created_at desc);
create index on public.activity_log (client_id);
create index on public.notifications (user_id, read_at, created_at desc);
create index on public.client_services (client_id);
create index on public.client_assets (client_id);
create index on public.client_notes (client_id);
create index on public.template_tasks (template_id);
create index on public.projects (client_id);
create index on public.projects (status) where deleted_at is null;
create index on public.tasks (project_id);
create index on public.tasks (assignee_id);
create index on public.tasks (due_date) where deleted_at is null;
create index on public.task_checklist_items (task_id);
create index on public.task_comments (task_id);
create index on public.task_attachments (task_id);
create index on public.social_accounts (client_id);
create index on public.content_posts (client_id);
create index on public.content_posts (scheduled_at) where deleted_at is null;
create index on public.content_posts (status, scheduled_at);
create index on public.content_media (post_id);
create index on public.approvals (client_id);
create index on public.events (starts_at) where deleted_at is null;
create index on public.events (client_id);
create index on public.recurring_fees (client_id);
create index on public.quotes (client_id);
create index on public.quote_items (quote_id);
create index on public.invoices (client_id);
create index on public.invoices (status, due_date);
create index on public.invoices (issue_date);
create index on public.invoice_items (invoice_id);
create index on public.expenses (date);
create index on public.conversations (client_id);
create index on public.conversations (last_message_at desc);
create index on public.messages (conversation_id, sent_at);
create index on public.ig_metrics_daily (social_account_id, date desc);
create index on public.ig_post_metrics (social_account_id, posted_at);

-- >>> supabase/migrations/20261120000002_rls.sql
-- =====================================================================
-- AM Creators Hub — Roles, RLS, triggers de negocio, vistas y funciones
-- Regla por defecto: nadie ve nada hasta que una política lo permita.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helpers de rol (security definer para no chocar con el RLS de profiles)
-- ---------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() = 'admin', false)
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role() in ('admin', 'equipo'), false)
$$;

create or replace function public.current_client_id()
returns uuid language sql stable security definer set search_path = public as $$
  select client_id from public.profiles
  where id = auth.uid() and is_active and role = 'cliente'
$$;

-- ---------------------------------------------------------------------
-- Alta automática de perfil al registrarse un usuario.
-- El PRIMER usuario queda como admin; los siguientes como equipo.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  has_admin boolean;
begin
  select exists (select 1 from public.profiles where role = 'admin') into has_admin;
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.email,
    case when has_admin then 'equipo'::public.user_role else 'admin'::public.user_role end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Un no-admin no puede cambiarse el rol, activarse ni asignarse cliente.
create or replace function public.protect_profile_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.role is distinct from old.role
       or new.is_active is distinct from old.is_active
       or new.client_id is distinct from old.client_id
       or new.email is distinct from old.email then
      raise exception 'Solo un admin puede cambiar el rol, el estado o el email de un usuario.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger protect_profile_fields before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Evitar quedarse sin admin.
create or replace function public.keep_one_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.role = 'admin' and (new.role <> 'admin' or not new.is_active) then
    if not exists (select 1 from public.profiles
                   where role = 'admin' and is_active and id <> old.id) then
      raise exception 'Tiene que quedar al menos un admin activo.' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create trigger keep_one_admin before update on public.profiles
  for each row execute function public.keep_one_admin();

-- El equipo no puede tocar montos (fee del cliente, presupuesto del proyecto).
create or replace function public.protect_money_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_table_name = 'clients' then
      if tg_op = 'INSERT' then new.monthly_fee := null;
      elsif new.monthly_fee is distinct from old.monthly_fee then new.monthly_fee := old.monthly_fee;
      end if;
    elsif tg_table_name = 'projects' then
      if tg_op = 'INSERT' then new.budget := null;
      elsif new.budget is distinct from old.budget then new.budget := old.budget;
      end if;
    end if;
  end if;
  return new;
end $$;

create trigger protect_money_fields before insert or update on public.clients
  for each row execute function public.protect_money_fields();
create trigger protect_money_fields before insert or update on public.projects
  for each row execute function public.protect_money_fields();

-- created_by automático
create or replace function public.set_created_by()
returns trigger language plpgsql as $$
begin
  if new.created_by is null then new.created_by := auth.uid(); end if;
  return new;
end $$;

do $$
declare t text;
begin
  for t in
    select table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'created_by'
  loop
    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = t and table_type = 'BASE TABLE') then
      execute format('create trigger set_created_by before insert on public.%I
                      for each row execute function public.set_created_by()', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Registro de actividad (alimenta "Actividad reciente" del dashboard)
-- Argumentos: 0 = columna con el nombre visible, 1 = columna de estado
--             2 = etiqueta del tipo ("Cliente", "Tarea"...), 3 = columna client_id
-- ---------------------------------------------------------------------
create or replace function public.log_activity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  label_col  text := tg_argv[0];
  status_col text := tg_argv[1];
  kind       text := tg_argv[2];
  client_col text := tg_argv[3];
  rec        jsonb := to_jsonb(new);
  old_rec    jsonb;
  label      text := coalesce(rec ->> label_col, '(sin nombre)');
  cid        uuid;
  act        text;
  summ       text;
begin
  if client_col = 'self' then
    cid := (rec ->> 'id')::uuid;
  elsif client_col = 'project' then
    select client_id into cid from public.projects where id = (rec ->> 'project_id')::uuid;
  elsif client_col <> '' then
    cid := nullif(rec ->> client_col, '')::uuid;
  end if;

  if tg_op = 'INSERT' then
    act  := 'creo';
    summ := kind || case when kind in ('Tarea', 'Publicación') then ' creada: ' else ' creado: ' end || label;
  else
    old_rec := to_jsonb(old);
    if (rec ->> 'deleted_at') is not null and (old_rec ->> 'deleted_at') is null then
      act  := 'borro';
      summ := kind || case when kind in ('Tarea', 'Publicación') then ' enviada' else ' enviado' end
              || ' a la papelera: ' || label;
    elsif status_col <> '' and (rec ->> status_col) is distinct from (old_rec ->> status_col) then
      act  := 'cambio_estado';
      summ := kind || ' "' || label || '" pasó a ' || case rec ->> status_col
                when 'en_revision'   then 'en revisión'
                when 'en_aprobacion' then 'en aprobación'
                when 'sesion_fotos'  then 'sesión de fotos'
                else replace(rec ->> status_col, '_', ' ') end;
    else
      return new;   -- cambios menores no se registran
    end if;
  end if;

  insert into public.activity_log (actor_id, entity_type, entity_id, action, summary, client_id)
  values (auth.uid(), tg_table_name, (rec ->> 'id')::uuid, act, summ, cid);
  return new;
end $$;

create trigger log_activity after insert or update on public.clients
  for each row execute function public.log_activity('brand_name', 'status', 'Cliente', 'self');
create trigger log_activity after insert or update on public.projects
  for each row execute function public.log_activity('name', 'status', 'Proyecto', 'client_id');
create trigger log_activity after insert or update on public.tasks
  for each row execute function public.log_activity('title', 'column', 'Tarea', 'project');
create trigger log_activity after insert or update on public.content_posts
  for each row execute function public.log_activity('caption', 'status', 'Publicación', 'client_id');
create trigger log_activity after insert or update on public.events
  for each row execute function public.log_activity('title', '', 'Evento', 'client_id');
create trigger log_activity after insert or update on public.invoices
  for each row execute function public.log_activity('number', 'status', 'Cobro', 'client_id');
create trigger log_activity after insert or update on public.quotes
  for each row execute function public.log_activity('number', 'status', 'Presupuesto', 'client_id');

-- =====================================================================
-- RLS: activado en las 34 tablas
-- =====================================================================
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------------- Usuarios y configuración ----------------
create policy "perfil propio o staff ve perfiles" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_staff());
create policy "editar perfil propio" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "admin edita perfiles" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin borra perfiles" on public.profiles
  for delete to authenticated using (public.is_admin());

create policy "admin ve configuracion" on public.settings
  for select to authenticated using (public.is_admin());
create policy "admin edita configuracion" on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "staff ve tipo de cambio" on public.exchange_rates
  for select to authenticated using (public.is_staff());
create policy "admin gestiona tipo de cambio" on public.exchange_rates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "staff ve actividad" on public.activity_log
  for select to authenticated using (
    public.is_admin()
    or (public.is_staff() and entity_type not in ('invoices', 'quotes', 'expenses', 'recurring_fees'))
  );

create policy "notificaciones propias" on public.notifications
  for select to authenticated using (user_id = auth.uid());
create policy "marcar notificaciones propias" on public.notifications
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "borrar notificaciones propias" on public.notifications
  for delete to authenticated using (user_id = auth.uid());
create policy "staff crea notificaciones" on public.notifications
  for insert to authenticated with check (public.is_staff());

-- ---------------- Clientes ----------------
create policy "staff ve clientes" on public.clients
  for select to authenticated using (public.is_staff() or id = public.current_client_id());
create policy "staff crea clientes" on public.clients
  for insert to authenticated with check (public.is_staff());
create policy "staff edita clientes" on public.clients
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "admin borra clientes" on public.clients
  for delete to authenticated using (public.is_admin());

create policy "staff gestiona servicios" on public.client_services
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "cliente ve sus servicios" on public.client_services
  for select to authenticated using (client_id = public.current_client_id());

create policy "staff gestiona brand kit" on public.client_assets
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "cliente ve su brand kit" on public.client_assets
  for select to authenticated using (client_id = public.current_client_id());

create policy "staff gestiona notas" on public.client_notes
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------------- Proyectos y tareas ----------------
create policy "staff gestiona plantillas" on public.project_templates
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff gestiona tareas de plantilla" on public.template_tasks
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

create policy "staff ve proyectos" on public.projects
  for select to authenticated using (public.is_staff());
create policy "staff crea proyectos" on public.projects
  for insert to authenticated with check (public.is_staff());
create policy "staff edita proyectos" on public.projects
  for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "admin borra proyectos" on public.projects
  for delete to authenticated using (public.is_admin());

create policy "staff gestiona tareas" on public.tasks
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff gestiona checklist" on public.task_checklist_items
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff gestiona comentarios" on public.task_comments
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff gestiona adjuntos" on public.task_attachments
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------------- Cuentas sociales y métricas ----------------
-- Las escrituras de métricas y tokens las hacen solo las Edge Functions (service role).
create policy "staff ve cuentas" on public.social_accounts
  for select to authenticated using (public.is_staff() or client_id = public.current_client_id());
create policy "admin gestiona cuentas" on public.social_accounts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "staff ve metricas de cuenta" on public.ig_metrics_daily
  for select to authenticated using (
    public.is_staff()
    or exists (select 1 from public.social_accounts s
               where s.id = social_account_id and s.client_id = public.current_client_id())
  );
create policy "staff ve metricas de posts" on public.ig_post_metrics
  for select to authenticated using (
    public.is_staff()
    or exists (select 1 from public.social_accounts s
               where s.id = social_account_id and s.client_id = public.current_client_id())
  );

-- ---------------- Contenidos ----------------
create policy "staff gestiona publicaciones" on public.content_posts
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "cliente ve sus publicaciones" on public.content_posts
  for select to authenticated using (
    client_id = public.current_client_id()
    and status in ('en_aprobacion', 'aprobado', 'programado', 'publicado')
    and deleted_at is null
  );

create policy "staff gestiona archivos de publicaciones" on public.content_media
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "cliente ve archivos de sus publicaciones" on public.content_media
  for select to authenticated using (
    exists (select 1 from public.content_posts p
            where p.id = post_id and p.client_id = public.current_client_id()
              and p.status in ('en_aprobacion', 'aprobado', 'programado', 'publicado'))
  );

-- El cliente sin login aprueba a través de una Edge Function (Fase 5).
create policy "staff gestiona aprobaciones" on public.approvals
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- ---------------- Agenda ----------------
create policy "staff gestiona eventos" on public.events
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "cada uno ve su conexion de calendario" on public.calendar_connections
  for select to authenticated using (user_id = auth.uid());
create policy "cada uno borra su conexion de calendario" on public.calendar_connections
  for delete to authenticated using (user_id = auth.uid());

-- ---------------- Finanzas: solo admin ----------------
create policy "admin gestiona fees" on public.recurring_fees
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin gestiona presupuestos" on public.quotes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin gestiona items de presupuesto" on public.quote_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin gestiona cobros" on public.invoices
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin gestiona items de cobro" on public.invoice_items
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin gestiona gastos" on public.expenses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------- Mensajes ----------------
create policy "staff gestiona conversaciones" on public.conversations
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff gestiona mensajes" on public.messages
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff gestiona respuestas rapidas" on public.quick_replies
  for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff ve plantillas de whatsapp" on public.whatsapp_templates
  for select to authenticated using (public.is_staff());
create policy "admin gestiona plantillas de whatsapp" on public.whatsapp_templates
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- =====================================================================
-- Vistas: ocultan montos al equipo (RLS filtra filas, no columnas)
-- security_invoker = true → la vista respeta el RLS de quien consulta
-- =====================================================================
create view public.clients_v with (security_invoker = true) as
  select id, name, brand_name, industry, email, whatsapp, instagram_handle,
         case when public.is_admin() then monthly_fee end as monthly_fee,
         currency, start_date, status, color_tag, created_by, created_at, updated_at, deleted_at
  from public.clients;

create view public.projects_v with (security_invoker = true) as
  select id, client_id, name, type, start_date, due_date,
         case when public.is_admin() then budget end as budget,
         currency, status, template_id, created_by, created_at, updated_at, deleted_at
  from public.projects;

-- Datos del estudio que puede ver todo el equipo (sin RUT ni razón social).
create view public.settings_public as
  select studio_name, logo_path, default_currency, theme_default
  from public.settings;

-- =====================================================================
-- Funciones para el frontend
-- =====================================================================

-- Fecha de "hoy" en Montevideo
create or replace function public.today_mvd()
returns date language sql stable as $$
  select (now() at time zone 'America/Montevideo')::date
$$;

-- Resumen del dashboard en una sola llamada. Corre con los permisos de
-- quien la llama (security invoker), así el equipo no recibe finanzas.
create or replace function public.dashboard_summary()
returns jsonb
language plpgsql stable security invoker set search_path = public as $$
declare
  d          date := public.today_mvd();
  day_start  timestamptz := (d::timestamp at time zone 'America/Montevideo');
  day_end    timestamptz := ((d + 1)::timestamp at time zone 'America/Montevideo');
  month_start date := date_trunc('month', d)::date;
  result     jsonb;
begin
  select jsonb_build_object(
    'today', d,
    'is_admin', public.is_admin(),
    'meetings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'title', e.title, 'type', e.type, 'starts_at', e.starts_at,
        'ends_at', e.ends_at, 'location', e.location, 'meet_url', e.meet_url,
        'client_name', c.brand_name) order by e.starts_at)
      from public.events e left join public.clients c on c.id = e.client_id
      where e.deleted_at is null and e.starts_at >= day_start and e.starts_at < day_end
    ), '[]'::jsonb),
    'posts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'caption', p.caption, 'format', p.format, 'status', p.status,
        'scheduled_at', p.scheduled_at, 'client_name', c.brand_name, 'color_tag', c.color_tag)
        order by p.scheduled_at)
      from public.content_posts p join public.clients c on c.id = p.client_id
      where p.deleted_at is null and p.scheduled_at >= day_start and p.scheduled_at < day_end
    ), '[]'::jsonb),
    'tasks', coalesce((
      select jsonb_agg(x.j order by x.due_date, x.prio desc) from (
        select t.due_date, array_position(enum_range(null::public.task_priority), t.priority) as prio,
          jsonb_build_object('id', t.id, 'title', t.title, 'due_date', t.due_date,
            'priority', t.priority, 'column', t."column", 'project_name', pr.name,
            'client_name', c.brand_name, 'assignee_name', pf.full_name,
            'overdue', t.due_date < d) as j
        from public.tasks t
        join public.projects pr on pr.id = t.project_id
        join public.clients c on c.id = pr.client_id
        left join public.profiles pf on pf.id = t.assignee_id
        where t.deleted_at is null and t."column" not in ('aprobado', 'entregado')
          and t.due_date is not null and t.due_date <= d + 2
        limit 12
      ) x
    ), '[]'::jsonb),
    'unread', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', cv.id, 'channel', cv.channel, 'contact_name', coalesce(c.brand_name, cv.contact_name, cv.external_contact_id),
        'preview', cv.last_message_preview, 'unread_count', cv.unread_count,
        'last_message_at', cv.last_message_at, 'is_new_contact', cv.client_id is null)
        order by cv.last_message_at desc)
      from public.conversations cv left join public.clients c on c.id = cv.client_id
      where cv.status <> 'cerrada' and cv.unread_count > 0
    ), '[]'::jsonb),
    'kpis', jsonb_build_object(
      'active_projects', (select count(*) from public.projects
                          where status = 'activo' and deleted_at is null),
      'active_clients',  (select count(*) from public.clients
                          where status = 'activo' and deleted_at is null),
      'billed_month_uyu', case when public.is_admin() then (
          select coalesce(sum(total * fx_rate), 0) from public.invoices
          where deleted_at is null and status <> 'anulado'
            and issue_date >= month_start and issue_date <= d) end,
      'pending_uyu', case when public.is_admin() then (
          select coalesce(sum(total * fx_rate), 0) from public.invoices
          where deleted_at is null and status in ('pendiente', 'vencido')) end,
      'pending_count', case when public.is_admin() then (
          select count(*) from public.invoices
          where deleted_at is null and status in ('pendiente', 'vencido')) end,
      'overdue_count', case when public.is_admin() then (
          select count(*) from public.invoices
          where deleted_at is null and status = 'vencido') end,
      'followers', (
          select sum(m.followers) from public.social_accounts s
          join lateral (select followers from public.ig_metrics_daily
                        where social_account_id = s.id order by date desc limit 1) m on true
          where s.client_id is null and s.platform = 'instagram'),
      'followers_30d_ago', (
          select sum(m.followers) from public.social_accounts s
          join lateral (select followers from public.ig_metrics_daily
                        where social_account_id = s.id and date <= d - 30
                        order by date desc limit 1) m on true
          where s.client_id is null and s.platform = 'instagram')
    ),
    'account_alerts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'username', s.username, 'platform', s.platform, 'status', s.status,
        'client_name', c.brand_name, 'token_expires_at', s.token_expires_at))
      from public.social_accounts s left join public.clients c on c.id = s.client_id
      where s.status <> 'conectada'
    ), '[]'::jsonb),
    'activity', coalesce((
      select jsonb_agg(x.j order by x.created_at desc) from (
        select a.created_at, jsonb_build_object(
          'id', a.id, 'summary', a.summary, 'action', a.action, 'entity_type', a.entity_type,
          'entity_id', a.entity_id, 'created_at', a.created_at,
          'actor_name', pf.full_name, 'client_name', c.brand_name) as j
        from public.activity_log a
        left join public.profiles pf on pf.id = a.actor_id
        left join public.clients c on c.id = a.client_id
        order by a.created_at desc
        limit 15
      ) x
    ), '[]'::jsonb)
  ) into result;
  return result;
end $$;

-- Búsqueda global (Ctrl/Cmd + K). Respeta RLS.
create or replace function public.global_search(q text)
returns table (kind text, id uuid, title text, subtitle text, link text)
language sql stable security invoker set search_path = public as $$
  with term as (select '%' || replace(replace(trim(q), '%', ''), '_', '\_') || '%' as t)
  (select 'cliente', c.id, c.brand_name, coalesce(c.name, '') || coalesce(' · ' || c.industry, ''),
          '/clientes/' || c.id
   from public.clients c, term
   where c.deleted_at is null and (c.brand_name ilike term.t or c.name ilike term.t
         or c.instagram_handle ilike term.t or c.email ilike term.t)
   order by c.brand_name limit 6)
  union all
  (select 'proyecto', p.id, p.name, c.brand_name, '/proyectos/' || p.id
   from public.projects p join public.clients c on c.id = p.client_id, term
   where p.deleted_at is null and (p.name ilike term.t or c.brand_name ilike term.t)
   order by p.created_at desc limit 6)
  union all
  (select 'publicacion', p.id, left(coalesce(nullif(p.caption, ''), '(sin texto)'), 80), c.brand_name,
          '/contenidos?post=' || p.id
   from public.content_posts p join public.clients c on c.id = p.client_id, term
   where p.deleted_at is null and (p.caption ilike term.t or p.hashtags ilike term.t)
   order by p.scheduled_at desc nulls last limit 6)
$$;

-- Marcar todas mis notificaciones como leídas
create or replace function public.mark_all_notifications_read()
returns void language sql security invoker set search_path = public as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null
$$;

-- Tipo de cambio vigente para una fecha (el último cargado hasta ese día)
create or replace function public.fx_rate_for(p_date date default public.today_mvd())
returns numeric language sql stable security invoker set search_path = public as $$
  select usd_to_uyu from public.exchange_rates where date <= p_date order by date desc limit 1
$$;

-- ---------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------
revoke execute on function public.dashboard_summary() from anon, public;
revoke execute on function public.global_search(text) from anon, public;
revoke execute on function public.mark_all_notifications_read() from anon, public;
grant execute on function public.dashboard_summary() to authenticated;
grant execute on function public.global_search(text) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
grant execute on function public.fx_rate_for(date) to authenticated;
grant select on public.clients_v, public.projects_v, public.settings_public to authenticated;
revoke all on public.clients_v, public.projects_v, public.settings_public from anon;

-- ---------------------------------------------------------------------
-- Realtime: notificaciones y mensajes en vivo
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications, public.messages, public.conversations;
  end if;
end $$;

-- >>> supabase/migrations/20261120000003_storage.sql
-- =====================================================================
-- AM Creators Hub — Buckets privados de Storage y sus permisos
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('brand-kits',  'brand-kits',  false, 52428800),    -- 50 MB
  ('content',     'content',     false, 524288000),   -- 500 MB (reels)
  ('attachments', 'attachments', false, 104857600),   -- 100 MB
  ('documents',   'documents',   false, 20971520),    -- 20 MB (PDFs de finanzas y reportes)
  ('avatars',     'avatars',     false, 5242880)      -- 5 MB
on conflict (id) do nothing;

-- Equipo y admin: brand kits, contenido y adjuntos
create policy "staff lee archivos de trabajo" on storage.objects
  for select to authenticated
  using (bucket_id in ('brand-kits', 'content', 'attachments', 'avatars') and public.is_staff());
create policy "staff sube archivos de trabajo" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('brand-kits', 'content', 'attachments', 'avatars') and public.is_staff());
create policy "staff edita archivos de trabajo" on storage.objects
  for update to authenticated
  using (bucket_id in ('brand-kits', 'content', 'attachments', 'avatars') and public.is_staff());
create policy "staff borra archivos de trabajo" on storage.objects
  for delete to authenticated
  using (bucket_id in ('brand-kits', 'content', 'attachments', 'avatars') and public.is_staff());

-- Documentos (presupuestos, recibos, reportes): solo admin
create policy "admin gestiona documentos" on storage.objects
  for all to authenticated
  using (bucket_id = 'documents' and public.is_admin())
  with check (bucket_id = 'documents' and public.is_admin());

-- Cliente (portal): lee solo los archivos de su carpeta, ruta <client_id>/...
create policy "cliente lee su brand kit" on storage.objects
  for select to authenticated
  using (bucket_id in ('brand-kits', 'content')
         and (storage.foldername(name))[1] = public.current_client_id()::text);

-- Cualquier usuario puede ver avatares del equipo
create policy "usuarios ven avatares" on storage.objects
  for select to authenticated using (bucket_id = 'avatars');

-- >>> supabase/migrations/20261121000001_fase2.sql
-- =====================================================================
-- AM Creators Hub — Fase 2: clientes, proyectos y tareas
-- Vistas con contadores, proyecto desde plantilla y aviso de asignación.
-- No crea tablas nuevas: siguen siendo 34.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Vistas (security_invoker: respetan el RLS de quien consulta;
-- se apoyan en clients_v / projects_v para ocultar montos al equipo)
-- ---------------------------------------------------------------------
create view public.clients_overview with (security_invoker = true) as
  select c.*,
         coalesce((select array_agg(distinct s.service order by s.service)
                   from public.client_services s
                   where s.client_id = c.id and s.is_active), '{}') as services,
         (select count(*) from public.projects p
          where p.client_id = c.id and p.status = 'activo' and p.deleted_at is null) as active_projects
  from public.clients_v c;

create view public.projects_overview with (security_invoker = true) as
  select p.*,
         c.brand_name as client_name,
         c.color_tag  as client_color,
         (select count(*) from public.tasks t where t.project_id = p.id and t.deleted_at is null) as tasks_total,
         (select count(*) from public.tasks t where t.project_id = p.id and t.deleted_at is null
            and t."column" in ('aprobado', 'entregado')) as tasks_done
  from public.projects_v p
  join public.clients c on c.id = p.client_id;

create view public.tasks_overview with (security_invoker = true) as
  select t.*,
         p.name        as project_name,
         p.client_id,
         c.brand_name  as client_name,
         c.color_tag   as client_color,
         pf.full_name  as assignee_name,
         (select count(*) from public.task_checklist_items i where i.task_id = t.id) as checklist_total,
         (select count(*) from public.task_checklist_items i where i.task_id = t.id and i.is_done) as checklist_done,
         (select count(*) from public.task_comments m where m.task_id = t.id) as comments_count,
         (select count(*) from public.task_attachments a where a.task_id = t.id) as attachments_count
  from public.tasks t
  join public.projects p on p.id = t.project_id
  join public.clients c on c.id = p.client_id
  left join public.profiles pf on pf.id = t.assignee_id
  where p.deleted_at is null;      -- las tareas de proyectos en la papelera no se listan

grant select on public.clients_overview, public.projects_overview, public.tasks_overview to authenticated;
revoke all on public.clients_overview, public.projects_overview, public.tasks_overview from anon;

-- ---------------------------------------------------------------------
-- Crear un proyecto desde una plantilla: copia las tareas con fechas
-- relativas al inicio y sus checklists. Respeta RLS (security invoker).
-- ---------------------------------------------------------------------
create or replace function public.create_project_from_template(
  p_client_id   uuid,
  p_template_id uuid,
  p_name        text,
  p_start_date  date,
  p_due_date    date default null,
  p_budget      numeric default null,
  p_currency    public.currency_code default 'UYU',
  p_status      public.project_status default 'activo'
) returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  v_type    public.service_type;
  v_project uuid;
  v_task    uuid;
  tt        record;
  item      text;
  i         int;
begin
  select project_type into v_type from public.project_templates where id = p_template_id;
  if v_type is null then
    raise exception 'La plantilla no existe o no tenés acceso.';
  end if;

  insert into public.projects (client_id, name, type, start_date, due_date, budget, currency, status, template_id)
  values (p_client_id, p_name, v_type, p_start_date, p_due_date,
          coalesce(p_budget, (select default_budget from public.project_templates where id = p_template_id)),
          p_currency, p_status, p_template_id)
  returning id into v_project;

  for tt in select * from public.template_tasks where template_id = p_template_id order by position, day_offset loop
    insert into public.tasks (project_id, title, description, due_date, priority, "column", position)
    values (v_project, tt.title, tt.description,
            case when p_start_date is null then null else p_start_date + tt.day_offset end,
            tt.default_priority, 'por_hacer', tt.position)
    returning id into v_task;

    i := 0;
    foreach item in array tt.checklist loop
      i := i + 1;
      insert into public.task_checklist_items (task_id, label, position) values (v_task, item, i);
    end loop;
  end loop;

  return v_project;
end $$;

revoke execute on function public.create_project_from_template(uuid, uuid, text, date, date, numeric, public.currency_code, public.project_status) from anon, public;
grant execute on function public.create_project_from_template(uuid, uuid, text, date, date, numeric, public.currency_code, public.project_status) to authenticated;

-- ---------------------------------------------------------------------
-- Aviso dentro de la app cuando te asignan una tarea
-- ---------------------------------------------------------------------
create or replace function public.notify_task_assignee()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  actor text;
begin
  if new.assignee_id is null or new.assignee_id = auth.uid() then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.assignee_id is not distinct from old.assignee_id then
    return new;
  end if;
  select coalesce(nullif(split_part(full_name, ' ', 1), ''), 'Alguien') into actor
  from public.profiles where id = auth.uid();
  insert into public.notifications (user_id, type, title, body, link)
  values (new.assignee_id, 'tarea',
          coalesce(actor, 'Alguien') || ' te asignó una tarea',
          new.title,
          '/proyectos/' || new.project_id || '?tarea=' || new.id);
  return new;
end $$;

create trigger notify_task_assignee after insert or update of assignee_id on public.tasks
  for each row execute function public.notify_task_assignee();

-- Aviso al responsable cuando alguien comenta su tarea
create or replace function public.notify_task_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t record;
  actor text;
begin
  select id, title, project_id, assignee_id into t from public.tasks where id = new.task_id;
  if t.assignee_id is null or t.assignee_id = new.author_id then
    return new;
  end if;
  select coalesce(nullif(split_part(full_name, ' ', 1), ''), 'Alguien') into actor
  from public.profiles where id = new.author_id;
  insert into public.notifications (user_id, type, title, body, link)
  values (t.assignee_id, 'comentario', coalesce(actor, 'Alguien') || ' comentó en "' || t.title || '"',
          left(new.body, 140), '/proyectos/' || t.project_id || '?tarea=' || t.id);
  return new;
end $$;

create trigger notify_task_comment after insert on public.task_comments
  for each row execute function public.notify_task_comment();

-- author_id / uploaded_by automáticos
create or replace function public.set_author()
returns trigger language plpgsql as $$
begin
  if tg_table_name in ('task_comments', 'client_notes') and new.author_id is null then
    new.author_id := auth.uid();
  elsif tg_table_name = 'task_attachments' and new.uploaded_by is null then
    new.uploaded_by := auth.uid();
  end if;
  return new;
end $$;

create trigger set_author before insert on public.task_comments    for each row execute function public.set_author();
create trigger set_author before insert on public.client_notes     for each row execute function public.set_author();
create trigger set_author before insert on public.task_attachments for each row execute function public.set_author();

-- Solo el autor (o un admin) edita o borra su comentario
drop policy "staff gestiona comentarios" on public.task_comments;
create policy "staff ve comentarios" on public.task_comments
  for select to authenticated using (public.is_staff());
create policy "staff comenta" on public.task_comments
  for insert to authenticated with check (public.is_staff() and author_id = auth.uid());
create policy "autor edita su comentario" on public.task_comments
  for update to authenticated using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());
create policy "autor borra su comentario" on public.task_comments
  for delete to authenticated using (author_id = auth.uid() or public.is_admin());

create index if not exists tasks_column_position_idx on public.tasks ("column", position) where deleted_at is null;
