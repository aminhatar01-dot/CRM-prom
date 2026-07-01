-- Phase 36: Self-Service Checkout, Credit Purchase, Plan Upgrade Requests
-- Extends billing_checkout_sessions, adds credit_packages, plan_upgrade_requests
-- Adds billing_create_checkout_session and billing_complete_checkout functions

-- ─── Extend plans with annual pricing ────────────────────────────────────────

alter table public.plans
  add column if not exists price_usd_annual numeric(10,2) not null default 0
    check (price_usd_annual >= 0);

update public.plans set price_usd_annual = price_usd_monthly * 10 where price_usd_annual = 0 and price_usd_monthly > 0;

-- ─── Extend billing_checkout_sessions ─────────────────────────────────────────

alter table public.billing_checkout_sessions
  add column if not exists session_type text not null default 'plan_upgrade'
    check (session_type in ('plan_upgrade', 'credit_purchase')),
  add column if not exists credits_amount integer not null default 0,
  add column if not exists invoice_id uuid references public.billing_invoices(id) on delete set null;

-- ─── credit_packages ─────────────────────────────────────────────────────────

create table if not exists public.credit_packages (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  credits     integer not null check (credits > 0),
  price_cents integer not null check (price_cents > 0),
  currency    text not null default 'USD' check (char_length(currency) = 3),
  enabled     boolean not null default true,
  sort_order  integer not null default 0,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

-- Seed standard packages (idempotent)
insert into public.credit_packages (name, credits, price_cents, currency, sort_order)
values
  ('Paquete Basico',   10000,   999, 'USD', 1),
  ('Paquete Pro',      50000,  3999, 'USD', 2),
  ('Paquete Business',100000,  6999, 'USD', 3)
on conflict do nothing;

alter table public.credit_packages enable row level security;

create policy "Anyone can read enabled credit_packages"
  on public.credit_packages for select
  using (enabled = true);

grant select on public.credit_packages to authenticated;
grant all    on public.credit_packages to service_role;

-- ─── plan_upgrade_requests ────────────────────────────────────────────────────

create table if not exists public.plan_upgrade_requests (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  requested_by        uuid not null references auth.users(id) on delete set null,
  current_plan_id     uuid references public.plans(id) on delete set null,
  target_plan_id      uuid not null references public.plans(id) on delete cascade,
  billing_cycle       text not null default 'monthly'
                        check (billing_cycle in ('monthly', 'annual')),
  status              text not null default 'pending'
                        check (status in ('pending', 'approved', 'rejected', 'checkout_pending', 'completed')),
  checkout_session_id uuid references public.billing_checkout_sessions(id) on delete set null,
  notes               text not null default '',
  approved_by         uuid references auth.users(id) on delete set null,
  approved_at         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger plan_upgrade_requests_set_updated_at
  before update on public.plan_upgrade_requests
  for each row execute function public.touch_updated_at();

create index plan_upgrade_requests_org_idx    on public.plan_upgrade_requests(organization_id);
create index plan_upgrade_requests_status_idx on public.plan_upgrade_requests(status);

alter table public.plan_upgrade_requests enable row level security;

create policy "Org read plan_upgrade_requests"
  on public.plan_upgrade_requests for select
  using (is_org_member(organization_id));

create policy "Org insert plan_upgrade_requests"
  on public.plan_upgrade_requests for insert
  with check (is_org_member(organization_id) and requested_by = auth.uid());

grant select, insert on public.plan_upgrade_requests to authenticated;
grant all             on public.plan_upgrade_requests to service_role;

-- ─── billing_create_checkout_session ─────────────────────────────────────────

create or replace function public.billing_create_checkout_session(
  p_organization_id uuid,
  p_session_type    text,
  p_plan_id         uuid    default null,
  p_credits_amount  integer default 0,
  p_amount_cents    integer default 0,
  p_currency        text    default 'USD',
  p_provider        text    default 'manual',
  p_success_url     text    default null,
  p_cancel_url      text    default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_id  uuid;
  v_invoice_id  uuid;
  v_description text;
begin
  -- Ensure billing customer exists
  perform public.billing_get_or_create_customer(p_organization_id, p_provider);

  -- Create invoice for this checkout if amount provided
  if p_amount_cents > 0 then
    v_description := case p_session_type
      when 'credit_purchase' then 'Compra de creditos: ' || p_credits_amount || ' creditos'
      else 'Cambio de plan'
    end;

    v_invoice_id := public.billing_create_invoice(
      p_organization_id,
      p_amount_cents,
      v_description,
      p_currency
    );
  end if;

  insert into public.billing_checkout_sessions(
    organization_id, provider, session_type, plan_id,
    credits_amount, status, success_url, cancel_url,
    invoice_id, expires_at
  ) values (
    p_organization_id, p_provider, p_session_type, p_plan_id,
    p_credits_amount, 'pending', p_success_url, p_cancel_url,
    v_invoice_id, now() + interval '24 hours'
  )
  returning id into v_session_id;

  return v_session_id;
end;
$$;

grant execute on function public.billing_create_checkout_session(uuid, text, uuid, integer, integer, text, text, text, text) to service_role;

-- ─── billing_complete_checkout ────────────────────────────────────────────────

create or replace function public.billing_complete_checkout(
  p_session_id      uuid,
  p_admin_user_id   uuid,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session  public.billing_checkout_sessions%rowtype;
  v_credits  integer;
  v_plan_slug text;
begin
  select * into v_session
  from public.billing_checkout_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception 'Checkout session % not found', p_session_id;
  end if;

  if v_session.status = 'completed' then
    return jsonb_build_object('success', true, 'idempotent', true, 'credits_granted', 0);
  end if;

  -- Mark session completed
  update public.billing_checkout_sessions
  set status = 'completed', completed_at = now(), updated_at = now()
  where id = p_session_id;

  -- Mark invoice paid if exists
  if v_session.invoice_id is not null then
    perform public.billing_mark_invoice_paid(
      v_session.invoice_id,
      p_admin_user_id,
      'checkout',
      'Completado via checkout session ' || p_session_id::text,
      coalesce(p_idempotency_key, 'checkout-' || p_session_id::text)
    );
  end if;

  -- Grant credits if credit purchase
  v_credits := 0;
  if v_session.session_type = 'credit_purchase' and v_session.credits_amount > 0 then
    perform public.admin_load_credits(
      v_session.organization_id,
      v_session.credits_amount,
      'Compra de creditos via checkout ' || p_session_id::text,
      p_admin_user_id
    );
    v_credits := v_session.credits_amount;
  end if;

  -- Activate plan if plan upgrade
  if v_session.session_type = 'plan_upgrade' and v_session.plan_id is not null then
    select slug into v_plan_slug from public.plans where id = v_session.plan_id;
    if v_plan_slug is not null then
      perform public.admin_set_subscription(v_session.organization_id, v_plan_slug, 'active');
    end if;
  end if;

  return jsonb_build_object('success', true, 'credits_granted', v_credits);
end;
$$;

grant execute on function public.billing_complete_checkout(uuid, uuid, text) to service_role;

-- ─── billing_approve_upgrade_request ─────────────────────────────────────────

create or replace function public.billing_approve_upgrade_request(
  p_request_id    uuid,
  p_admin_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req   public.plan_upgrade_requests%rowtype;
  v_slug  text;
begin
  select * into v_req
  from public.plan_upgrade_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Upgrade request % not found', p_request_id;
  end if;

  if v_req.status not in ('pending', 'checkout_pending') then
    raise exception 'Cannot approve request in status %', v_req.status;
  end if;

  select slug into v_slug from public.plans where id = v_req.target_plan_id;
  if v_slug is null then
    raise exception 'Target plan not found';
  end if;

  -- Apply plan change
  perform public.admin_set_subscription(v_req.organization_id, v_slug, 'active');

  -- Mark approved
  update public.plan_upgrade_requests
  set status = 'approved', approved_by = p_admin_user_id, approved_at = now(), updated_at = now()
  where id = p_request_id;

  perform public.log_admin_action(
    'approve_upgrade_request',
    'plan_upgrade_requests',
    v_req.organization_id,
    jsonb_build_object('request_id', p_request_id, 'plan_slug', v_slug)
  );
end;
$$;

grant execute on function public.billing_approve_upgrade_request(uuid, uuid) to service_role;
