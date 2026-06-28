-- Phase 29: Google Workspace OAuth
-- Creates: oauth_states (CSRF nonce store)
-- Adds SECURITY DEFINER functions: store_hub_credential, get_hub_credential, delete_hub_credentials, claim_oauth_state
-- Note: integration_credentials table already exists from FASE 27

-- ─── oauth_states (temporary CSRF nonces) ────────────────────────────────────

create table public.oauth_states (
  id uuid primary key default gen_random_uuid(),
  nonce text not null unique check (char_length(nonce) between 32 and 200),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.integration_connections(id) on delete cascade,
  provider_key text not null check (char_length(provider_key) between 1 and 80),
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null default (now() + interval '10 minutes'),
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index oauth_states_nonce_idx on public.oauth_states (nonce) where used_at is null;
create index oauth_states_expires_idx on public.oauth_states (expires_at) where used_at is null;

alter table public.oauth_states enable row level security;

create policy "Service manage oauth states"
on public.oauth_states for all
using (true)
with check (true);

grant all on public.oauth_states to service_role;

comment on table public.oauth_states is
  'Temporary CSRF state nonces for OAuth flows. Consumed on callback, auto-expired after 10 min.';

-- ─── claim_oauth_state ────────────────────────────────────────────────────────

create or replace function public.claim_oauth_state(
  p_nonce text,
  p_organization_id uuid
)
returns table (
  connection_id uuid,
  provider_key  text,
  user_id       uuid
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.oauth_states
  set used_at = now()
  where
    nonce           = p_nonce
    and organization_id = p_organization_id
    and used_at     is null
    and expires_at  > now()
  returning oauth_states.connection_id, oauth_states.provider_key, oauth_states.user_id;
end;
$$;

grant execute on function public.claim_oauth_state(text, uuid) to service_role;

-- ─── store_hub_credential ────────────────────────────────────────────────────

create or replace function public.store_hub_credential(
  p_connection_id   uuid,
  p_organization_id uuid,
  p_credential_type text,
  p_encrypted_value text,
  p_expires_at      timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- verify the connection belongs to the organization
  if not exists (
    select 1 from public.integration_connections
    where id = p_connection_id and organization_id = p_organization_id
  ) then
    raise exception 'Connection % not found or does not belong to organization %', p_connection_id, p_organization_id;
  end if;

  insert into public.integration_credentials
    (connection_id, organization_id, credential_type, encrypted_value, expires_at)
  values
    (p_connection_id, p_organization_id, p_credential_type, p_encrypted_value, p_expires_at)
  on conflict (connection_id, credential_type)
  do update set
    encrypted_value = excluded.encrypted_value,
    expires_at      = excluded.expires_at;
end;
$$;

grant execute on function public.store_hub_credential(uuid, uuid, text, text, timestamptz) to service_role;

-- ─── get_hub_credential ──────────────────────────────────────────────────────

create or replace function public.get_hub_credential(
  p_connection_id   uuid,
  p_organization_id uuid,
  p_credential_type text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_value text;
begin
  select encrypted_value into v_value
  from public.integration_credentials
  where
    connection_id   = p_connection_id
    and organization_id = p_organization_id
    and credential_type = p_credential_type
  limit 1;

  return v_value;
end;
$$;

grant execute on function public.get_hub_credential(uuid, uuid, text) to service_role;

-- ─── delete_hub_credentials ──────────────────────────────────────────────────

create or replace function public.delete_hub_credentials(
  p_connection_id   uuid,
  p_organization_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.integration_credentials
  where connection_id = p_connection_id
    and organization_id = p_organization_id;
end;
$$;

grant execute on function public.delete_hub_credentials(uuid, uuid) to service_role;

-- ─── integration_credentials unique constraint (if not exists) ───────────────
-- FASE 27 created the table but may not have the constraint for UPSERT in store_hub_credential

do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'integration_credentials'
      and constraint_name = 'integration_credentials_connection_id_credential_type_key'
  ) then
    alter table public.integration_credentials
      add constraint integration_credentials_connection_id_credential_type_key
      unique (connection_id, credential_type);
  end if;
end;
$$;

-- ─── Cleanup expired oauth_states (cron-safe) ─────────────────────────────────

create or replace function public.cleanup_expired_oauth_states()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  delete from public.oauth_states
  where expires_at < now() - interval '1 hour'
  returning 1 into v_count;
  return coalesce(v_count, 0);
end;
$$;

grant execute on function public.cleanup_expired_oauth_states() to service_role;
