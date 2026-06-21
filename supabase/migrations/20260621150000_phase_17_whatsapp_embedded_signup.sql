alter table public.whatsapp_channel_settings
  add column if not exists connection_method text not null default 'manual'
    check (connection_method in ('manual', 'embedded_signup')),
  add column if not exists meta_business_id text,
  add column if not exists verified_name text,
  add column if not exists quality_rating text,
  add column if not exists token_status text not null default 'missing'
    check (token_status in ('active', 'expiring', 'expired', 'revoked', 'missing', 'refresh_failed')),
  add column if not exists token_expires_at timestamptz,
  add column if not exists token_last_validated_at timestamptz,
  add column if not exists connected_by uuid references auth.users(id) on delete set null,
  add column if not exists connected_at timestamptz;

create table public.whatsapp_channel_credentials (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  channel_setting_id uuid not null references public.whatsapp_channel_settings(id) on delete cascade,
  access_token_ciphertext text not null,
  token_type text not null default 'business',
  scopes jsonb not null default '[]'::jsonb,
  token_expires_at timestamptz,
  last_refreshed_at timestamptz,
  last_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (channel_setting_id)
);

create trigger touch_whatsapp_channel_credentials_updated_at
  before update on public.whatsapp_channel_credentials
  for each row execute function public.touch_updated_at();

alter table public.whatsapp_channel_credentials enable row level security;

revoke all on public.whatsapp_channel_credentials from anon, authenticated;
grant all on public.whatsapp_channel_credentials to service_role;

create or replace function public.validate_whatsapp_channel_credentials_tenant()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.whatsapp_channel_settings
    where id = new.channel_setting_id
      and organization_id = new.organization_id
  ) then
    raise exception 'channel_setting_id must belong to the same organization';
  end if;

  return new;
end;
$$;

create trigger validate_whatsapp_channel_credentials_tenant
  before insert or update on public.whatsapp_channel_credentials
  for each row execute function public.validate_whatsapp_channel_credentials_tenant();

create index if not exists whatsapp_credentials_org_idx
  on public.whatsapp_channel_credentials(organization_id);

create index if not exists whatsapp_settings_token_status_idx
  on public.whatsapp_channel_settings(organization_id, token_status, token_expires_at);
