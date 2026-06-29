-- Phase 31: Billing Foundation — Facturación SaaS inicial
-- Creates: billing_customers, billing_subscriptions, billing_invoices,
--          billing_payments, billing_checkout_sessions, billing_webhook_events
-- Providers: manual, mercado_pago, stripe
-- All tables tenant-scoped (organization_id), strict RLS.

-- ─── billing_customers ───────────────────────────────────────────────────────
-- One record per org per provider

create table public.billing_customers (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null unique references public.organizations(id) on delete cascade,
  provider         text not null default 'manual'
                     check (provider in ('manual', 'mercado_pago', 'stripe')),
  external_id      text,               -- provider customer ID (MP payer_id / Stripe customer_id)
  email            text,               -- billing email
  name             text,               -- billing name
  metadata         jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index billing_customers_org_provider_idx
  on public.billing_customers(organization_id);

create trigger billing_customers_set_updated_at
before update on public.billing_customers
for each row execute function public.touch_updated_at();

alter table public.billing_customers enable row level security;

-- Org members can read their own billing customer
create policy "Org read billing_customers"
  on public.billing_customers for select
  using (is_org_member(organization_id));

-- Only service_role can write
grant select on public.billing_customers to authenticated;
grant all    on public.billing_customers to service_role;

-- ─── billing_subscriptions ────────────────────────────────────────────────────
-- Tracks the billing-layer subscription (distinct from organization_subscriptions)

create table public.billing_subscriptions (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null unique references public.organizations(id) on delete cascade,
  billing_customer_id  uuid not null references public.billing_customers(id) on delete cascade,
  plan_id              uuid references public.plans(id) on delete set null,
  provider             text not null default 'manual'
                         check (provider in ('manual', 'mercado_pago', 'stripe')),
  external_id          text,           -- provider subscription ID
  status               text not null default 'trialing'
                         check (status in ('trialing', 'active', 'past_due', 'cancelled', 'suspended', 'unpaid')),
  billing_cycle        text not null default 'monthly'
                         check (billing_cycle in ('monthly', 'annual', 'one_time')),
  current_period_start timestamptz,
  current_period_end   timestamptz,
  trial_end            timestamptz,
  cancel_at_period_end boolean not null default false,
  cancelled_at         timestamptz,
  metadata             jsonb not null default '{}',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger billing_subscriptions_set_updated_at
before update on public.billing_subscriptions
for each row execute function public.touch_updated_at();

create index billing_subscriptions_org_idx on public.billing_subscriptions(organization_id);

alter table public.billing_subscriptions enable row level security;

create policy "Org read billing_subscriptions"
  on public.billing_subscriptions for select
  using (is_org_member(organization_id));

grant select on public.billing_subscriptions to authenticated;
grant all    on public.billing_subscriptions to service_role;

-- ─── billing_invoices ─────────────────────────────────────────────────────────

create table public.billing_invoices (
  id                      uuid primary key default gen_random_uuid(),
  organization_id         uuid not null references public.organizations(id) on delete cascade,
  billing_subscription_id uuid references public.billing_subscriptions(id) on delete set null,
  provider                text not null default 'manual'
                            check (provider in ('manual', 'mercado_pago', 'stripe')),
  external_id             text,         -- provider invoice ID
  number                  text,         -- human-readable invoice number
  status                  text not null default 'draft'
                            check (status in ('draft', 'open', 'paid', 'void', 'uncollectible')),
  amount_cents            integer not null check (amount_cents >= 0),
  currency                text not null default 'USD' check (char_length(currency) = 3),
  description             text not null default '',
  period_start            timestamptz,
  period_end              timestamptz,
  due_date                timestamptz,
  paid_at                 timestamptz,
  credit_note             boolean not null default false,
  line_items              jsonb not null default '[]',
  metadata                jsonb not null default '{}',
  created_by              uuid references auth.users(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger billing_invoices_set_updated_at
before update on public.billing_invoices
for each row execute function public.touch_updated_at();

create index billing_invoices_org_idx     on public.billing_invoices(organization_id);
create index billing_invoices_status_idx  on public.billing_invoices(status);
create index billing_invoices_created_idx on public.billing_invoices(created_at desc);

alter table public.billing_invoices enable row level security;

create policy "Org read billing_invoices"
  on public.billing_invoices for select
  using (is_org_member(organization_id));

grant select on public.billing_invoices to authenticated;
grant all    on public.billing_invoices to service_role;

-- ─── billing_payments ─────────────────────────────────────────────────────────

create table public.billing_payments (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  invoice_id       uuid references public.billing_invoices(id) on delete set null,
  provider         text not null default 'manual'
                     check (provider in ('manual', 'mercado_pago', 'stripe')),
  external_id      text,              -- provider payment/charge ID
  idempotency_key  text unique,       -- prevents duplicate payment processing
  status           text not null default 'pending'
                     check (status in ('pending', 'succeeded', 'failed', 'refunded', 'cancelled')),
  amount_cents     integer not null check (amount_cents > 0),
  currency         text not null default 'USD' check (char_length(currency) = 3),
  method           text not null default 'manual'
                     check (method in ('manual', 'card', 'bank_transfer', 'mercado_pago', 'pix', 'other')),
  credits_granted  integer not null default 0,
  credits_granted_at timestamptz,
  notes            text not null default '',
  metadata         jsonb not null default '{}',
  recorded_by      uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger billing_payments_set_updated_at
before update on public.billing_payments
for each row execute function public.touch_updated_at();

create index billing_payments_org_idx     on public.billing_payments(organization_id);
create index billing_payments_invoice_idx on public.billing_payments(invoice_id);
create index billing_payments_status_idx  on public.billing_payments(status);
create unique index billing_payments_idempotency_idx
  on public.billing_payments(idempotency_key) where idempotency_key is not null;

alter table public.billing_payments enable row level security;

create policy "Org read billing_payments"
  on public.billing_payments for select
  using (is_org_member(organization_id));

grant select on public.billing_payments to authenticated;
grant all    on public.billing_payments to service_role;

-- ─── billing_checkout_sessions ────────────────────────────────────────────────

create table public.billing_checkout_sessions (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  provider         text not null default 'manual'
                     check (provider in ('manual', 'mercado_pago', 'stripe')),
  external_id      text,              -- provider session ID
  plan_id          uuid references public.plans(id) on delete set null,
  status           text not null default 'pending'
                     check (status in ('pending', 'completed', 'expired', 'cancelled')),
  checkout_url     text,              -- provider redirect URL
  success_url      text,
  cancel_url       text,
  expires_at       timestamptz,
  completed_at     timestamptz,
  metadata         jsonb not null default '{}',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger billing_checkout_sessions_set_updated_at
before update on public.billing_checkout_sessions
for each row execute function public.touch_updated_at();

create index billing_checkout_sessions_org_idx on public.billing_checkout_sessions(organization_id);
create index billing_checkout_sessions_status_idx on public.billing_checkout_sessions(status);

alter table public.billing_checkout_sessions enable row level security;

create policy "Org read billing_checkout_sessions"
  on public.billing_checkout_sessions for select
  using (is_org_member(organization_id));

grant select on public.billing_checkout_sessions to authenticated;
grant all    on public.billing_checkout_sessions to service_role;

-- ─── billing_webhook_events ───────────────────────────────────────────────────
-- Raw event store for idempotent webhook processing

create table public.billing_webhook_events (
  id               uuid primary key default gen_random_uuid(),
  provider         text not null check (provider in ('manual', 'mercado_pago', 'stripe')),
  external_id      text,              -- provider event ID (for dedup)
  event_type       text not null,
  organization_id  uuid references public.organizations(id) on delete set null,
  payload          jsonb not null default '{}',
  processed        boolean not null default false,
  processed_at     timestamptz,
  error_message    text,
  created_at       timestamptz not null default now()
);

create index billing_webhook_events_provider_idx     on public.billing_webhook_events(provider);
create index billing_webhook_events_processed_idx    on public.billing_webhook_events(processed);
create index billing_webhook_events_created_idx      on public.billing_webhook_events(created_at desc);
create unique index billing_webhook_events_external_dedup_idx
  on public.billing_webhook_events(provider, external_id)
  where external_id is not null;

alter table public.billing_webhook_events enable row level security;

-- Only service_role can access raw webhook events
create policy "Service manage billing_webhook_events"
  on public.billing_webhook_events for all
  using (true)
  with check (true);

grant all on public.billing_webhook_events to service_role;
-- authenticated: no access to raw webhook data

-- ─── SECURITY DEFINER functions ──────────────────────────────────────────────

-- billing_get_customer_or_create: get or create billing customer for org
create or replace function public.billing_get_or_create_customer(
  p_organization_id uuid,
  p_provider        text default 'manual',
  p_email           text default null,
  p_name            text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer_id uuid;
begin
  select id into v_customer_id
  from public.billing_customers
  where organization_id = p_organization_id;

  if v_customer_id is null then
    insert into public.billing_customers(organization_id, provider, email, name)
    values (p_organization_id, p_provider, p_email, p_name)
    returning id into v_customer_id;
  end if;

  return v_customer_id;
end;
$$;

grant execute on function public.billing_get_or_create_customer(uuid, text, text, text) to service_role;

-- billing_create_invoice: create invoice with auto-generated number
create or replace function public.billing_create_invoice(
  p_organization_id         uuid,
  p_amount_cents            integer,
  p_description             text,
  p_currency                text default 'USD',
  p_period_start            timestamptz default null,
  p_period_end              timestamptz default null,
  p_due_date                timestamptz default null,
  p_billing_subscription_id uuid default null,
  p_line_items              jsonb default '[]',
  p_provider                text default 'manual',
  p_created_by              uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_number     text;
  v_seq        integer;
begin
  -- Generate sequential invoice number per org
  select count(*) + 1 into v_seq
  from public.billing_invoices
  where organization_id = p_organization_id;

  v_number := 'INV-' || to_char(now(), 'YYYYMM') || '-' || lpad(v_seq::text, 4, '0');

  insert into public.billing_invoices(
    organization_id, billing_subscription_id, provider, number, status,
    amount_cents, currency, description, period_start, period_end,
    due_date, line_items, created_by
  ) values (
    p_organization_id, p_billing_subscription_id, p_provider, v_number, 'open',
    p_amount_cents, p_currency, p_description, p_period_start, p_period_end,
    coalesce(p_due_date, now() + interval '30 days'), p_line_items, p_created_by
  )
  returning id into v_invoice_id;

  return v_invoice_id;
end;
$$;

grant execute on function public.billing_create_invoice(uuid, integer, text, text, timestamptz, timestamptz, timestamptz, uuid, jsonb, text, uuid) to service_role;

-- billing_mark_invoice_paid: marks invoice paid, records payment, grants credits
create or replace function public.billing_mark_invoice_paid(
  p_invoice_id     uuid,
  p_admin_user_id  uuid,
  p_payment_method text default 'manual',
  p_notes          text default '',
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice        public.billing_invoices%rowtype;
  v_plan           public.plans%rowtype;
  v_subscription   public.billing_subscriptions%rowtype;
  v_payment_id     uuid;
  v_credits        integer;
  v_already_paid   boolean := false;
begin
  -- Idempotency: check if already processed
  if p_idempotency_key is not null then
    select exists(
      select 1 from public.billing_payments
      where idempotency_key = p_idempotency_key
        and status = 'succeeded'
    ) into v_already_paid;

    if v_already_paid then
      return jsonb_build_object('success', true, 'idempotent', true);
    end if;
  end if;

  -- Lock invoice row to prevent races
  select * into v_invoice
  from public.billing_invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'Invoice % not found', p_invoice_id;
  end if;

  if v_invoice.status = 'paid' then
    return jsonb_build_object('success', true, 'idempotent', true, 'already_paid', true);
  end if;

  if v_invoice.status not in ('open', 'draft') then
    raise exception 'Cannot pay invoice in status %', v_invoice.status;
  end if;

  -- Mark invoice paid
  update public.billing_invoices
  set status = 'paid', paid_at = now(), updated_at = now()
  where id = p_invoice_id;

  -- Record payment
  insert into public.billing_payments(
    organization_id, invoice_id, provider, status,
    amount_cents, currency, method, notes, recorded_by,
    idempotency_key
  ) values (
    v_invoice.organization_id, p_invoice_id, v_invoice.provider, 'succeeded',
    v_invoice.amount_cents, v_invoice.currency, p_payment_method, p_notes,
    p_admin_user_id, p_idempotency_key
  )
  returning id into v_payment_id;

  -- Get plan credits if subscription exists
  v_credits := 0;
  if v_invoice.billing_subscription_id is not null then
    select bs.*, p.monthly_credits into v_subscription, v_credits
    from public.billing_subscriptions bs
    left join public.plans p on p.id = bs.plan_id
    where bs.id = v_invoice.billing_subscription_id;

    v_credits := coalesce(v_credits, 0);

    if v_credits > 0 then
      -- Grant credits via admin_load_credits
      perform public.admin_load_credits(
        v_invoice.organization_id,
        v_credits,
        'Billing: pago de factura ' || coalesce(v_invoice.number, v_invoice.id::text),
        p_admin_user_id
      );

      -- Record credits granted on payment
      update public.billing_payments
      set credits_granted = v_credits, credits_granted_at = now()
      where id = v_payment_id;

      -- Activate subscription
      update public.billing_subscriptions
      set status = 'active',
          current_period_start = now(),
          current_period_end   = case
            when billing_cycle = 'annual'  then now() + interval '1 year'
            when billing_cycle = 'monthly' then now() + interval '1 month'
            else current_period_end
          end,
          updated_at = now()
      where id = v_invoice.billing_subscription_id;
    end if;
  end if;

  -- Log audit
  perform public.log_admin_action(
    'mark_invoice_paid',
    'billing_invoice',
    v_invoice.organization_id,
    jsonb_build_object(
      'invoice_id', p_invoice_id,
      'amount_cents', v_invoice.amount_cents,
      'credits_granted', v_credits,
      'payment_id', v_payment_id
    )
  );

  return jsonb_build_object(
    'success', true,
    'payment_id', v_payment_id,
    'credits_granted', v_credits
  );
end;
$$;

grant execute on function public.billing_mark_invoice_paid(uuid, uuid, text, text, text) to service_role;

-- billing_suspend_org: suspend org subscription and block IA
create or replace function public.billing_suspend_org(
  p_organization_id uuid,
  p_reason          text default 'past_due',
  p_admin_user_id   uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.billing_subscriptions
  set status = 'suspended', updated_at = now()
  where organization_id = p_organization_id;

  update public.organization_subscriptions
  set status = 'suspended',
      commercial_status = case when p_reason = 'past_due' then 'past_due' else 'suspended' end,
      updated_at = now()
  where organization_id = p_organization_id;

  perform public.log_admin_action(
    'suspend_org',
    'billing_subscription',
    p_organization_id,
    jsonb_build_object('reason', p_reason)
  );
end;
$$;

grant execute on function public.billing_suspend_org(uuid, text, uuid) to service_role;

-- billing_reactivate_org: reactivate suspended org
create or replace function public.billing_reactivate_org(
  p_organization_id uuid,
  p_admin_user_id   uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.billing_subscriptions
  set status = 'active', updated_at = now()
  where organization_id = p_organization_id;

  update public.organization_subscriptions
  set status = 'active', commercial_status = 'active', updated_at = now()
  where organization_id = p_organization_id;

  perform public.log_admin_action(
    'reactivate_org',
    'billing_subscription',
    p_organization_id,
    jsonb_build_object('reactivated_at', now())
  );
end;
$$;

grant execute on function public.billing_reactivate_org(uuid, uuid) to service_role;

-- billing_record_webhook: idempotent raw webhook storage
create or replace function public.billing_record_webhook(
  p_provider    text,
  p_external_id text,
  p_event_type  text,
  p_payload     jsonb,
  p_org_id      uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event_id uuid;
  v_exists   boolean;
begin
  -- Dedup by provider + external_id
  if p_external_id is not null then
    select exists(
      select 1 from public.billing_webhook_events
      where provider = p_provider and external_id = p_external_id
    ) into v_exists;

    if v_exists then
      return jsonb_build_object('duplicate', true);
    end if;
  end if;

  insert into public.billing_webhook_events(provider, external_id, event_type, organization_id, payload)
  values (p_provider, p_external_id, p_event_type, p_org_id, p_payload)
  returning id into v_event_id;

  return jsonb_build_object('event_id', v_event_id, 'duplicate', false);
end;
$$;

grant execute on function public.billing_record_webhook(text, text, text, jsonb, uuid) to service_role;
