-- Phase 27: Integration Hub
-- Creates: integration_providers, integration_connections, integration_credentials,
--          integration_connection_logs, integration_hub_tools
-- Seed: all known providers (Google, Meta, MercadoLibre, Tiendanube, Shopify, TikTok, WooCommerce)
-- RLS: credentials are server-side ONLY (no select for authenticated role)

-- ─── integration_providers (provider catalog) ──────────────────────────────────

create table public.integration_providers (
  key text primary key check (char_length(key) between 1 and 80),
  name text not null check (char_length(name) between 1 and 120),
  category text not null check (category in ('messaging', 'ecommerce', 'productivity', 'advertising', 'social', 'storage', 'other')),
  auth_type text not null check (auth_type in ('oauth2', 'api_key', 'token', 'webhook', 'none')),
  description text not null default '',
  icon_emoji text not null default '🔌',
  features text[] not null default '{}'::text[],
  docs_url text check (docs_url is null or char_length(docs_url) <= 500),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.integration_providers enable row level security;

create policy "Providers public read"
on public.integration_providers for select
using (active = true);

grant select on public.integration_providers to authenticated;
grant all on public.integration_providers to service_role;

comment on table public.integration_providers is
  'Catalog of all known integration providers. Maintained by the platform, not per-tenant.';

-- seed all known providers
insert into public.integration_providers (key, name, category, auth_type, description, icon_emoji, features, docs_url) values
  ('whatsapp',        'WhatsApp Business',   'messaging',     'token',  'Mensajeria directa por WhatsApp Business Cloud API.',    '💬', '{messaging,inbound,outbound,webhooks}',    'https://developers.facebook.com/docs/whatsapp'),
  ('instagram',       'Instagram Business',  'social',        'oauth2', 'Mensajes directos e interaccion con publicaciones.',      '📸', '{messaging,comments,media}',               'https://developers.facebook.com/docs/instagram-api'),
  ('facebook',        'Facebook Pages',      'social',        'oauth2', 'Publicaciones, comentarios y mensajes de Paginas.',       '📘', '{pages,messaging,comments}',               'https://developers.facebook.com/docs/pages'),
  ('messenger',       'Facebook Messenger',  'messaging',     'oauth2', 'Mensajeria via Messenger de Facebook.',                   '💬', '{messaging,buttons,quick_replies}',        'https://developers.facebook.com/docs/messenger-platform'),
  ('tiktok',          'TikTok Business',     'social',        'oauth2', 'Comentarios, videos y mensajes de TikTok Business.',      '🎵', '{videos,comments,messaging}',              'https://developers.tiktok.com'),
  ('mercadolibre',    'Mercado Libre',        'ecommerce',     'oauth2', 'Publicaciones, preguntas, ordenes y stock.',              '🛒', '{listings,questions,orders,stock}',        'https://developers.mercadolibre.com'),
  ('tiendanube',      'Tiendanube',           'ecommerce',     'oauth2', 'Productos, pedidos y clientes de Tiendanube.',            '🏪', '{products,orders,customers}',              'https://tiendanube.github.io/api-documentation'),
  ('shopify',         'Shopify',              'ecommerce',     'oauth2', 'Productos, pedidos y clientes de Shopify.',               '🛍️', '{products,orders,customers,inventory}',   'https://shopify.dev/api'),
  ('woocommerce',     'WooCommerce',          'ecommerce',     'api_key','Productos, pedidos y clientes via REST API.',             '🛒', '{products,orders,customers}',              'https://woocommerce.github.io/woocommerce-rest-api-docs'),
  ('gmail',           'Gmail',                'productivity',  'oauth2', 'Leer, enviar y gestionar correos de Gmail.',               '📧', '{read,send,labels,threads}',               'https://developers.google.com/gmail/api'),
  ('google_calendar', 'Google Calendar',      'productivity',  'oauth2', 'Crear y consultar eventos del calendario.',               '📅', '{events,availability,create,update}',      'https://developers.google.com/calendar'),
  ('google_sheets',   'Google Sheets',        'productivity',  'oauth2', 'Leer y escribir filas en hojas de calculo.',              '📊', '{read,write,search,append}',               'https://developers.google.com/sheets/api'),
  ('google_drive',    'Google Drive',         'storage',       'oauth2', 'Listar, subir y compartir archivos en Drive.',            '💾', '{files,upload,share,search}',              'https://developers.google.com/drive/api'),
  ('meta_ads',        'Meta Ads',             'advertising',   'oauth2', 'Leer campanas, grupos de anuncios y metricas.',           '📢', '{campaigns,ad_sets,metrics,insights}',     'https://developers.facebook.com/docs/marketing-api'),
  ('google_ads',      'Google Ads',           'advertising',   'oauth2', 'Leer campanas, grupos de anuncios y metricas.',           '📣', '{campaigns,ad_groups,metrics,reports}',    'https://developers.google.com/google-ads/api');

-- ─── integration_connections ──────────────────────────────────────────────────

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_key text not null references public.integration_providers(key) on delete restrict,
  display_name text not null check (char_length(display_name) between 1 and 120),
  status text not null default 'disconnected'
    check (status in ('connected', 'disconnected', 'expired', 'requires_auth', 'error')),
  external_account_id text check (char_length(external_account_id) <= 200),
  external_account_name text check (char_length(external_account_name) <= 200),
  scopes text[] not null default '{}'::text[],
  expires_at timestamptz,
  last_refreshed_at timestamptz,
  last_sync_at timestamptz,
  last_health_check_at timestamptz,
  last_error text check (char_length(last_error) <= 2000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index integration_connections_org_idx on public.integration_connections (organization_id, provider_key);
create index integration_connections_status_idx on public.integration_connections (organization_id, status);

create trigger integration_connections_set_updated_at
before update on public.integration_connections
for each row execute function public.touch_updated_at();

alter table public.integration_connections enable row level security;

create policy "Tenant read connections"
on public.integration_connections for select
using (public.is_org_member(organization_id));

create policy "Tenant admin manage connections"
on public.integration_connections for insert
with check (public.is_org_admin(organization_id));

create policy "Tenant admin update connections"
on public.integration_connections for update
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "Tenant admin delete connections"
on public.integration_connections for delete
using (public.is_org_admin(organization_id));

grant select on public.integration_connections to authenticated;
grant all on public.integration_connections to service_role;

comment on table public.integration_connections is
  'One row per organization per connected account. An org can have multiple connections to the same provider.';

-- ─── integration_credentials (NEVER readable by authenticated role) ────────────

create table public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  credential_type text not null
    check (credential_type in ('access_token', 'refresh_token', 'api_key', 'webhook_secret', 'client_id', 'client_secret', 'other')),
  encrypted_value text not null check (char_length(encrypted_value) > 0),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger integration_credentials_set_updated_at
before update on public.integration_credentials
for each row execute function public.touch_updated_at();

alter table public.integration_credentials enable row level security;

-- INTENTIONALLY no select policy for 'authenticated' — credentials only readable via service_role
create policy "Service manage credentials"
on public.integration_credentials for all
using (true)
with check (true);

grant all on public.integration_credentials to service_role;
-- authenticated role gets NO grants on this table

comment on table public.integration_credentials is
  'Encrypted credentials (access_token, refresh_token, api_key) for each connection. Never readable by the authenticated role. All access via service_role server-side only.';

-- ─── integration_connection_logs ──────────────────────────────────────────────

create table public.integration_connection_logs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  event_type text not null
    check (event_type in ('connected', 'disconnected', 'refreshed', 'expired', 'error', 'health_check', 'health_ok', 'synced', 'tool_executed', 'credential_stored', 'credential_rotated')),
  message text not null default '' check (char_length(message) <= 2000),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index integration_connection_logs_conn_idx on public.integration_connection_logs (connection_id, created_at desc);
create index integration_connection_logs_org_idx on public.integration_connection_logs (organization_id, created_at desc);

alter table public.integration_connection_logs enable row level security;

create policy "Tenant read connection logs"
on public.integration_connection_logs for select
using (public.is_org_member(organization_id));

create policy "Service insert logs"
on public.integration_connection_logs for insert
with check (true);

grant select on public.integration_connection_logs to authenticated;
grant all on public.integration_connection_logs to service_role;

comment on table public.integration_connection_logs is
  'Append-only audit log of connection lifecycle events (connect, disconnect, refresh, errors, health checks).';

-- ─── integration_hub_tools ────────────────────────────────────────────────────

create table public.integration_hub_tools (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider_key text not null references public.integration_providers(key) on delete cascade,
  tool_key text not null check (char_length(tool_key) between 1 and 120),
  name text not null check (char_length(name) between 1 and 160),
  description text not null default '' check (char_length(description) <= 1000),
  input_schema jsonb not null default '{}'::jsonb check (jsonb_typeof(input_schema) = 'object'),
  output_schema jsonb not null default '{}'::jsonb check (jsonb_typeof(output_schema) = 'object'),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, tool_key)
);

create index integration_hub_tools_conn_idx on public.integration_hub_tools (connection_id);
create index integration_hub_tools_org_idx on public.integration_hub_tools (organization_id, provider_key);

create trigger integration_hub_tools_set_updated_at
before update on public.integration_hub_tools
for each row execute function public.touch_updated_at();

alter table public.integration_hub_tools enable row level security;

create policy "Tenant read hub tools"
on public.integration_hub_tools for select
using (public.is_org_member(organization_id));

create policy "Tenant admin manage hub tools"
on public.integration_hub_tools for insert
with check (public.is_org_admin(organization_id));

create policy "Tenant admin update hub tools"
on public.integration_hub_tools for update
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "Tenant admin delete hub tools"
on public.integration_hub_tools for delete
using (public.is_org_admin(organization_id));

grant select on public.integration_hub_tools to authenticated;
grant all on public.integration_hub_tools to service_role;

comment on table public.integration_hub_tools is
  'AI-callable tools for each connection. Populated when a connection is created/activated.';

-- ─── function: disconnect_integration_connection ─────────────────────────────

create or replace function public.disconnect_integration_connection(
  p_connection_id uuid,
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- verify ownership
  if not exists (
    select 1 from public.integration_connections
    where id = p_connection_id and organization_id = p_organization_id
  ) then
    raise exception 'Connection not found or access denied.';
  end if;

  -- delete credentials (server-side cleanup)
  delete from public.integration_credentials
  where connection_id = p_connection_id;

  -- update status
  update public.integration_connections
  set status = 'disconnected',
      last_error = null,
      updated_at = now()
  where id = p_connection_id;

  -- log the event
  insert into public.integration_connection_logs
    (connection_id, organization_id, event_type, message)
  values
    (p_connection_id, p_organization_id, 'disconnected', 'Connection disconnected and credentials removed.');
end;
$$;

grant execute on function public.disconnect_integration_connection(uuid, uuid) to service_role;

comment on function public.disconnect_integration_connection is
  'Atomically disconnects a connection: removes credentials, sets status=disconnected, logs the event.';
