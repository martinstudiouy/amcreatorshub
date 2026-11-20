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
