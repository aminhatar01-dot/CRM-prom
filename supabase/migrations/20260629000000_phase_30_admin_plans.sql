-- Phase 30: Admin Panel, SaaS Plans and Commercial Management
-- Creates: platform_users (super_admin), extends plans, extends subscriptions, admin_audit_log
-- Note: plans and organization_subscriptions tables exist from FASE 26 — this migration extends them.

-- ─── platform_users (super_admin table) ──────────────────────────────────────
-- Separate from organization_members — platform-level role

create table public.platform_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'super_admin'
    check (role in ('super_admin', 'support')),
  is_active boolean not null default true,
  notes text not null default '',
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger platform_users_set_updated_at
before update on public.platform_users
for each row execute function public.touch_updated_at();

alter table public.platform_users enable row level security;

-- No SELECT for authenticated — service_role only
-- Super admins can only be managed server-side
create policy "Service manage platform_users"
on public.platform_users for all
using (true)
with check (true);

grant all on public.platform_users to service_role;
-- authenticated: no direct access

comment on table public.platform_users is
  'Platform-level users (super_admin, support). NOT tenant-scoped. No SELECT for authenticated.';

-- ─── is_super_admin() SECURITY DEFINER helper ────────────────────────────────

create or replace function public.is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.platform_users
    where user_id = auth.uid()
      and role = 'super_admin'
      and is_active = true
  );
$$;

grant execute on function public.is_super_admin() to authenticated;

-- ─── Extend plans table ───────────────────────────────────────────────────────
-- Add missing columns for full SaaS plan configuration

alter table public.plans
  add column if not exists slug text unique check (char_length(slug) between 1 and 80),
  add column if not exists max_automations integer check (max_automations is null or max_automations > 0),
  add column if not exists max_integrations integer check (max_integrations is null or max_integrations > 0),
  add column if not exists max_storage_mb integer check (max_storage_mb is null or max_storage_mb > 0),
  add column if not exists price_usd_monthly numeric(10, 2) not null default 0 check (price_usd_monthly >= 0),
  add column if not exists is_public boolean not null default false,
  add column if not exists sort_order integer not null default 0;

-- Update existing plans with slugs and sort order
update public.plans set slug = 'free',    sort_order = 0, is_public = true,  price_usd_monthly = 0     where name = 'Piloto'  and slug is null;
update public.plans set slug = 'starter', sort_order = 1, is_public = true,  price_usd_monthly = 29.00 where name = 'Starter' and slug is null;
update public.plans set slug = 'pro',     sort_order = 2, is_public = true,  price_usd_monthly = 79.00 where name = 'Pro'     and slug is null;

-- Insert missing plans
insert into public.plans (name, slug, description, monthly_credits, max_members, max_documents, max_assistants, max_automations, max_integrations, max_storage_mb, price_usd_monthly, is_public, sort_order, features)
values
  ('Business',    'business',   'Plan empresarial con capacidad extendida.',    100000, 50,  2000, 50, 100, 20, 10240, 199.00, true,  3, '{"priority_support": true}'::jsonb),
  ('Enterprise',  'enterprise', 'Plan enterprise sin límites operativos.',      500000, null, null, null, null, null, null, 499.00, false, 4, '{"sla": true, "custom_branding": true, "dedicated_support": true}'::jsonb),
  ('Demo',        'demo',       'Plan demo para pruebas internas del equipo.',  999999, null, null, null, null, null, null, 0,      false, 99, '{"bypass_limits": true, "is_internal": true}'::jsonb)
on conflict (slug) do nothing;

-- ─── Extend organization_subscriptions ───────────────────────────────────────

alter table public.organization_subscriptions
  add column if not exists past_due_since timestamptz,
  add column if not exists commercial_status text not null default 'prospect'
    check (commercial_status in ('prospect', 'pilot', 'active', 'past_due', 'suspended', 'churned')),
  add column if not exists origin text not null default 'organic'
    check (origin in ('organic', 'referral', 'outbound', 'demo', 'internal')),
  add column if not exists assigned_to uuid references auth.users(id) on delete set null,
  add column if not exists internal_notes text not null default '' check (char_length(internal_notes) <= 5000),
  add column if not exists onboarding_completed_at timestamptz;

-- ─── admin_audit_log ─────────────────────────────────────────────────────────

create table public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  performed_by uuid not null references auth.users(id) on delete cascade,
  action text not null check (char_length(action) between 1 and 200),
  entity_type text not null check (char_length(entity_type) between 1 and 80),
  entity_id uuid,
  organization_id uuid references public.organizations(id) on delete set null,
  before_state jsonb,
  after_state jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index admin_audit_log_performed_by_idx on public.admin_audit_log(performed_by);
create index admin_audit_log_organization_id_idx on public.admin_audit_log(organization_id);
create index admin_audit_log_created_at_idx on public.admin_audit_log(created_at desc);

alter table public.admin_audit_log enable row level security;

create policy "Service manage admin_audit_log"
on public.admin_audit_log for all
using (true)
with check (true);

grant all on public.admin_audit_log to service_role;

comment on table public.admin_audit_log is
  'Append-only audit log for admin actions. No UPDATE or DELETE — service_role insert only.';

-- ─── log_admin_action() SECURITY DEFINER ─────────────────────────────────────

create or replace function public.log_admin_action(
  p_action         text,
  p_entity_type    text,
  p_entity_id      uuid default null,
  p_organization_id uuid default null,
  p_before_state   jsonb default null,
  p_after_state    jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.admin_audit_log
    (performed_by, action, entity_type, entity_id, organization_id, before_state, after_state)
  values
    (auth.uid(), p_action, p_entity_type, p_entity_id, p_organization_id, p_before_state, p_after_state)
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.log_admin_action(text, text, uuid, uuid, jsonb, jsonb) to service_role;

-- ─── admin_load_credits() SECURITY DEFINER ───────────────────────────────────
-- Loads credits to a wallet with audit log, callable only by service_role

create or replace function public.admin_load_credits(
  p_organization_id uuid,
  p_amount          numeric,
  p_reason          text,
  p_admin_user_id   uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet_id uuid;
begin
  if p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  -- ensure wallet exists
  insert into public.ai_credit_wallets (organization_id, available_credits, lifetime_credits_loaded)
  values (p_organization_id, 0, 0)
  on conflict (organization_id) do nothing;

  -- get wallet id
  select id into v_wallet_id
  from public.ai_credit_wallets
  where organization_id = p_organization_id;

  -- update wallet
  update public.ai_credit_wallets
  set
    available_credits       = available_credits + p_amount,
    lifetime_credits_loaded = lifetime_credits_loaded + p_amount
  where organization_id = p_organization_id;

  -- record in adjustments ledger
  insert into public.credit_adjustments
    (organization_id, wallet_id, amount, reason, adjusted_by)
  values
    (p_organization_id, v_wallet_id, p_amount, p_reason, p_admin_user_id);
end;
$$;

grant execute on function public.admin_load_credits(uuid, numeric, text, uuid) to service_role;

-- ─── admin_set_subscription() SECURITY DEFINER ───────────────────────────────

create or replace function public.admin_set_subscription(
  p_organization_id     uuid,
  p_plan_slug           text,
  p_status              text,
  p_commercial_status   text default null,
  p_trial_ends_at       timestamptz default null,
  p_internal_notes      text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
begin
  select id into v_plan_id from public.plans where slug = p_plan_slug and active = true;
  if v_plan_id is null then
    raise exception 'Plan with slug "%" not found or inactive', p_plan_slug;
  end if;

  insert into public.organization_subscriptions
    (organization_id, plan_id, status, commercial_status, trial_ends_at, internal_notes)
  values
    (p_organization_id, v_plan_id, p_status, coalesce(p_commercial_status, 'active'), p_trial_ends_at, coalesce(p_internal_notes, ''))
  on conflict (organization_id) do update
  set
    plan_id             = excluded.plan_id,
    status              = excluded.status,
    commercial_status   = coalesce(excluded.commercial_status, organization_subscriptions.commercial_status),
    trial_ends_at       = coalesce(excluded.trial_ends_at, organization_subscriptions.trial_ends_at),
    internal_notes      = case when p_internal_notes is not null then excluded.internal_notes else organization_subscriptions.internal_notes end,
    updated_at          = now();
end;
$$;

grant execute on function public.admin_set_subscription(uuid, text, text, text, timestamptz, text) to service_role;

-- ─── get_org_limits() helper for limit enforcement ───────────────────────────

create or replace function public.get_org_plan_limits(p_organization_id uuid)
returns table (
  plan_name       text,
  plan_slug       text,
  max_members     integer,
  max_assistants  integer,
  max_automations integer,
  max_integrations integer,
  max_documents   integer,
  max_conversations integer,
  monthly_credits integer,
  bypass_limits   boolean
)
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce(pl.name, 'Free'),
    coalesce(pl.slug, 'free'),
    pl.max_members,
    pl.max_assistants,
    pl.max_automations,
    pl.max_integrations,
    pl.max_documents,
    pl.max_conversations,
    coalesce(pl.monthly_credits, 0),
    coalesce((pl.features->>'bypass_limits')::boolean, false)
  from public.organization_subscriptions os
  join public.plans pl on pl.id = os.plan_id
  where os.organization_id = p_organization_id
  limit 1;
$$;

grant execute on function public.get_org_plan_limits(uuid) to authenticated, service_role;
