-- Phase 26: AI Credits, Ledger and Usage Plans
-- Creates: plans, organization_subscriptions, ai_credit_wallets, ai_usage_ledger, credit_adjustments
-- Includes: RLS policies, atomic deduction function, wallet backfill for existing orgs

-- ─── plans ───────────────────────────────────────────────────────────────────

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  monthly_credits integer not null default 0 check (monthly_credits >= 0),
  max_members integer check (max_members is null or max_members > 0),
  max_documents integer check (max_documents is null or max_documents > 0),
  max_conversations integer check (max_conversations is null or max_conversations > 0),
  max_assistants integer check (max_assistants is null or max_assistants > 0),
  allowed_models text[] not null default '{}'::text[],
  features jsonb not null default '{}'::jsonb check (jsonb_typeof(features) = 'object'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plans_set_updated_at
before update on public.plans
for each row execute function public.touch_updated_at();

alter table public.plans enable row level security;

create policy "Plans public read"
on public.plans for select
using (active = true);

grant select on public.plans to authenticated;
grant all on public.plans to service_role;

comment on table public.plans is
  'Commercial plans defining credit allotment and feature limits per organization.';

-- seed starter plans
insert into public.plans (name, description, monthly_credits, max_members, max_documents, max_assistants, features)
values
  ('Piloto', 'Plan piloto asistido. Carga manual de creditos.', 0, 3, 50, 3, '{"manual_credits": true}'::jsonb),
  ('Starter', 'Plan de inicio con 5000 creditos mensuales.', 5000, 5, 100, 5, '{"manual_credits": true}'::jsonb),
  ('Pro', 'Plan profesional con 20000 creditos mensuales.', 20000, 15, 500, 20, '{"manual_credits": true}'::jsonb);

-- ─── organization_subscriptions ───────────────────────────────────────────────

create table public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  status text not null default 'trial'
    check (status in ('trial', 'active', 'suspended', 'cancelled')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  notes text not null default '' check (char_length(notes) <= 2000),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organization_subscriptions_set_updated_at
before update on public.organization_subscriptions
for each row execute function public.touch_updated_at();

alter table public.organization_subscriptions enable row level security;

create policy "Tenant read subscription"
on public.organization_subscriptions for select
using (public.is_org_member(organization_id));

create policy "Service manage subscription"
on public.organization_subscriptions for all
using (true)
with check (true);

grant select on public.organization_subscriptions to authenticated;
grant all on public.organization_subscriptions to service_role;

comment on table public.organization_subscriptions is
  'One subscription per organization linking to a plan. Managed manually in Phase 26.';

-- ─── ai_credit_wallets ────────────────────────────────────────────────────────

create table public.ai_credit_wallets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  available_credits numeric(14, 2) not null default 0 check (available_credits >= 0),
  lifetime_credits_loaded numeric(14, 2) not null default 0 check (lifetime_credits_loaded >= 0),
  lifetime_credits_used numeric(14, 2) not null default 0 check (lifetime_credits_used >= 0),
  low_balance_threshold numeric(14, 2) not null default 50,
  is_admin_exempt boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger ai_credit_wallets_set_updated_at
before update on public.ai_credit_wallets
for each row execute function public.touch_updated_at();

alter table public.ai_credit_wallets enable row level security;

create policy "Tenant read wallet"
on public.ai_credit_wallets for select
using (public.is_org_member(organization_id));

create policy "Service manage wallet"
on public.ai_credit_wallets for all
using (true)
with check (true);

grant select on public.ai_credit_wallets to authenticated;
grant all on public.ai_credit_wallets to service_role;

comment on table public.ai_credit_wallets is
  'One credit wallet per organization. available_credits decreases on AI use. is_admin_exempt bypasses the credit gate.';

-- ─── ai_usage_ledger ─────────────────────────────────────────────────────────

create table public.ai_usage_ledger (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assistant_id uuid references public.ai_assistants(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  ai_log_id uuid,
  provider text not null default 'openai' check (char_length(provider) <= 50),
  model text not null check (char_length(model) between 1 and 120),
  operation_type text not null default 'reply'
    check (operation_type in ('reply', 'test', 'classification', 'extraction', 'embedding', 'routing', 'other')),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  total_tokens integer not null default 0 check (total_tokens >= 0),
  estimated_cost_usd numeric(10, 6) not null default 0 check (estimated_cost_usd >= 0),
  credits_charged numeric(12, 2) not null default 0 check (credits_charged >= 0),
  mode text not null default 'openai'
    check (mode in ('openai', 'demo', 'policy')),
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create unique index ai_usage_ledger_idempotency_idx
  on public.ai_usage_ledger (idempotency_key)
  where idempotency_key is not null;

create index ai_usage_ledger_org_created_idx
  on public.ai_usage_ledger (organization_id, created_at desc);

create index ai_usage_ledger_assistant_idx
  on public.ai_usage_ledger (assistant_id, created_at desc)
  where assistant_id is not null;

create index ai_usage_ledger_conversation_idx
  on public.ai_usage_ledger (conversation_id, created_at desc)
  where conversation_id is not null;

alter table public.ai_usage_ledger enable row level security;

create policy "Tenant read ledger"
on public.ai_usage_ledger for select
using (public.is_org_member(organization_id));

create policy "Service insert ledger"
on public.ai_usage_ledger for insert
with check (true);

grant select on public.ai_usage_ledger to authenticated;
grant insert, select on public.ai_usage_ledger to service_role;

comment on table public.ai_usage_ledger is
  'Immutable append-only log of every AI operation with token counts and credits charged. Never updated after insert.';

-- ─── credit_adjustments ──────────────────────────────────────────────────────

create table public.credit_adjustments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  amount numeric(12, 2) not null,
  adjustment_type text not null
    check (adjustment_type in ('load', 'refund', 'correction', 'bonus', 'expiry')),
  reason text not null check (char_length(reason) between 1 and 500),
  actor_id uuid references auth.users(id) on delete set null,
  external_reference text check (char_length(external_reference) <= 200),
  created_at timestamptz not null default now()
);

create index credit_adjustments_org_created_idx
  on public.credit_adjustments (organization_id, created_at desc);

alter table public.credit_adjustments enable row level security;

create policy "Tenant read adjustments"
on public.credit_adjustments for select
using (public.is_org_member(organization_id));

create policy "Service manage adjustments"
on public.credit_adjustments for all
using (true)
with check (true);

grant select on public.credit_adjustments to authenticated;
grant all on public.credit_adjustments to service_role;

comment on table public.credit_adjustments is
  'Audit trail of manual credit loads, refunds and corrections applied to organization wallets.';

-- ─── atomic credit deduction function ────────────────────────────────────────

create or replace function public.deduct_ai_credits(
  p_organization_id uuid,
  p_credits numeric,
  p_idempotency_key text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_wallet record;
begin
  -- no-op for zero charges (demo/policy mode)
  if p_credits <= 0 then
    return true;
  end if;

  select id, available_credits, is_admin_exempt
  into v_wallet
  from public.ai_credit_wallets
  where organization_id = p_organization_id
  for update;

  if not found then
    return false;
  end if;

  if v_wallet.is_admin_exempt then
    return true;
  end if;

  if v_wallet.available_credits < p_credits then
    return false;
  end if;

  update public.ai_credit_wallets
  set
    available_credits   = available_credits - p_credits,
    lifetime_credits_used = lifetime_credits_used + p_credits,
    updated_at          = now()
  where id = v_wallet.id;

  return true;
end;
$$;

grant execute on function public.deduct_ai_credits(uuid, numeric, text) to service_role;

-- ─── function to load credits ─────────────────────────────────────────────────

create or replace function public.load_ai_credits(
  p_organization_id uuid,
  p_credits numeric,
  p_reason text,
  p_actor_id uuid default null,
  p_external_reference text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_credits <= 0 then
    raise exception 'Credits amount must be positive.';
  end if;

  insert into public.ai_credit_wallets (organization_id, available_credits, lifetime_credits_loaded)
  values (p_organization_id, p_credits, p_credits)
  on conflict (organization_id) do update
    set available_credits      = ai_credit_wallets.available_credits + p_credits,
        lifetime_credits_loaded = ai_credit_wallets.lifetime_credits_loaded + p_credits,
        updated_at              = now();

  insert into public.credit_adjustments
    (organization_id, amount, adjustment_type, reason, actor_id, external_reference)
  values
    (p_organization_id, p_credits, 'load', p_reason, p_actor_id, p_external_reference);
end;
$$;

grant execute on function public.load_ai_credits(uuid, numeric, text, uuid, text) to service_role;

-- ─── backfill wallets for existing organizations ───────────────────────────────

insert into public.ai_credit_wallets (organization_id)
select id from public.organizations
on conflict (organization_id) do nothing;

insert into public.organization_subscriptions (organization_id, status, notes)
select id, 'trial', 'Creado automaticamente en migracion FASE 26.'
from public.organizations
on conflict (organization_id) do nothing;
