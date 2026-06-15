create type public.whatsapp_event_direction as enum ('inbound', 'outbound', 'status', 'error');

create table public.whatsapp_channel_settings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phone_number_id text not null,
  business_account_id text,
  display_phone_number text,
  webhook_verify_token_hint text,
  enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, phone_number_id)
);

create table public.whatsapp_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  direction public.whatsapp_event_direction not null,
  event_type text not null,
  whatsapp_message_id text,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  phone_number_id text,
  contact_wa_id text,
  payload jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations
  add column if not exists external_contact_id text;

alter table public.messages
  add column if not exists external_message_id text,
  add column if not exists media_id text,
  add column if not exists media_mime_type text,
  add column if not exists media_filename text,
  add column if not exists media_url text,
  add column if not exists location_latitude numeric(10, 7),
  add column if not exists location_longitude numeric(10, 7);

create trigger touch_whatsapp_channel_settings_updated_at
  before update on public.whatsapp_channel_settings
  for each row execute function public.touch_updated_at();

create trigger touch_whatsapp_events_updated_at
  before update on public.whatsapp_events
  for each row execute function public.touch_updated_at();

alter table public.whatsapp_channel_settings enable row level security;
alter table public.whatsapp_events enable row level security;

create policy "Tenant read whatsapp settings" on public.whatsapp_channel_settings
  for select using (public.is_org_member(organization_id));

create policy "Tenant manage whatsapp settings" on public.whatsapp_channel_settings
  for all using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create policy "Tenant read whatsapp events" on public.whatsapp_events
  for select using (public.is_org_member(organization_id));

create policy "Tenant insert whatsapp events" on public.whatsapp_events
  for insert with check (public.is_org_member(organization_id));

create index whatsapp_settings_org_idx on public.whatsapp_channel_settings(organization_id);
create index whatsapp_events_org_idx on public.whatsapp_events(organization_id, created_at desc);
create index whatsapp_events_message_idx on public.whatsapp_events(whatsapp_message_id);
create index conversations_external_contact_idx on public.conversations(organization_id, channel, external_contact_id);
create index messages_external_message_idx on public.messages(organization_id, external_message_id);

alter publication supabase_realtime add table public.whatsapp_events;
