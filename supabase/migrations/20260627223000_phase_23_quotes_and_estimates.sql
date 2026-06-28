alter type public.automation_action_type add value if not exists 'create_quote';
alter type public.automation_action_type add value if not exists 'send_quote_draft';
alter type public.automation_action_type add value if not exists 'mark_quote_sent';
alter type public.automation_action_type add value if not exists 'notify_quote_accepted';

create sequence if not exists public.quote_number_seq;

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_number text not null default ('COT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.quote_number_seq')::text, 6, '0')),
  lead_id uuid references public.leads(id) on delete set null,
  contact_id uuid references public.contacts(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  customer_name text not null check (char_length(customer_name) between 2 and 160),
  customer_phone text,
  status text not null default 'draft'
    check (status in ('draft', 'pending_approval', 'sent', 'accepted', 'rejected', 'expired', 'cancelled')),
  currency text not null default 'ARS' check (currency ~ '^[A-Z]{3}$'),
  subtotal numeric(15,2) not null default 0 check (subtotal >= 0),
  discount_total numeric(15,2) not null default 0 check (discount_total >= 0),
  tax_total numeric(15,2) not null default 0 check (tax_total >= 0),
  total numeric(15,2) not null default 0 check (total >= 0),
  expires_at timestamptz,
  internal_notes text,
  commercial_terms text,
  public_token text not null unique default encode(gen_random_bytes(32), 'hex'),
  sent_at timestamptz,
  accepted_at timestamptz,
  rejected_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, quote_number)
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  position integer not null default 1 check (position > 0),
  name text not null check (char_length(name) between 1 and 200),
  description text,
  sku text,
  product_code text,
  quantity numeric(12,3) not null check (quantity > 0),
  unit_price numeric(15,2) not null check (unit_price >= 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  discount_amount numeric(15,2) not null default 0 check (discount_amount >= 0),
  stock text,
  availability text,
  source_document_id uuid references public.knowledge_documents(id) on delete set null,
  source_title text,
  source_metadata jsonb not null default '{}'::jsonb,
  line_total numeric(15,2) generated always as (greatest(0, round((quantity * unit_price) - discount_amount, 2))) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_id, position)
);

create table public.quote_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 2 and 80),
  actor_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index quotes_org_status_idx on public.quotes(organization_id, status, created_at desc)
  where archived_at is null;
create index quotes_conversation_idx on public.quotes(organization_id, conversation_id, created_at desc)
  where archived_at is null;
create index quote_items_quote_idx on public.quote_items(organization_id, quote_id, position);
create index quote_events_quote_idx on public.quote_events(organization_id, quote_id, created_at desc);

create trigger quotes_set_updated_at before update on public.quotes
for each row execute function public.touch_updated_at();
create trigger quote_items_set_updated_at before update on public.quote_items
for each row execute function public.touch_updated_at();

create or replace function public.calculate_quote_header_total()
returns trigger language plpgsql as $$
begin
  new.total := greatest(0, round(new.subtotal - new.discount_total + new.tax_total, 2));
  return new;
end;
$$;

create trigger calculate_quote_header_total
before insert or update of subtotal, discount_total, tax_total on public.quotes
for each row execute function public.calculate_quote_header_total();

create or replace function public.validate_quote_tenant()
returns trigger language plpgsql as $$
begin
  if new.lead_id is not null and not exists (
    select 1 from public.leads where id = new.lead_id and organization_id = new.organization_id
  ) then raise exception 'lead_id must belong to the same organization'; end if;
  if new.contact_id is not null and not exists (
    select 1 from public.contacts where id = new.contact_id and organization_id = new.organization_id
  ) then raise exception 'contact_id must belong to the same organization'; end if;
  if new.conversation_id is not null and not exists (
    select 1 from public.conversations where id = new.conversation_id and organization_id = new.organization_id
  ) then raise exception 'conversation_id must belong to the same organization'; end if;
  return new;
end;
$$;

create or replace function public.validate_quote_item_tenant()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.quotes where id = new.quote_id and organization_id = new.organization_id) then
    raise exception 'quote_id must belong to the same organization';
  end if;
  if new.source_document_id is not null and not exists (
    select 1 from public.knowledge_documents where id = new.source_document_id and organization_id = new.organization_id
  ) then raise exception 'source_document_id must belong to the same organization'; end if;
  return new;
end;
$$;

create or replace function public.validate_quote_event_tenant()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.quotes where id = new.quote_id and organization_id = new.organization_id) then
    raise exception 'quote_id must belong to the same organization';
  end if;
  return new;
end;
$$;

create trigger validate_quotes_tenant before insert or update on public.quotes
for each row execute function public.validate_quote_tenant();
create trigger validate_quote_items_tenant before insert or update on public.quote_items
for each row execute function public.validate_quote_item_tenant();
create trigger validate_quote_events_tenant before insert or update on public.quote_events
for each row execute function public.validate_quote_event_tenant();

create or replace function public.recalculate_quote_totals()
returns trigger language plpgsql as $$
declare target_quote_id uuid;
begin
  target_quote_id := coalesce(new.quote_id, old.quote_id);
  update public.quotes q set
    subtotal = coalesce(t.subtotal, 0),
    discount_total = coalesce(t.discount_total, 0),
    total = greatest(0, coalesce(t.subtotal, 0) - coalesce(t.discount_total, 0) + q.tax_total)
  from (
    select quote_id, round(sum(quantity * unit_price), 2) subtotal, round(sum(discount_amount), 2) discount_total
    from public.quote_items where quote_id = target_quote_id group by quote_id
  ) t where q.id = target_quote_id;
  if not found then
    update public.quotes set subtotal = 0, discount_total = 0, total = tax_total where id = target_quote_id;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger recalculate_quote_after_item
after insert or update or delete on public.quote_items
for each row execute function public.recalculate_quote_totals();

alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.quote_events enable row level security;

create policy "Tenant read quotes" on public.quotes for select using (public.is_org_member(organization_id));
create policy "Tenant create quotes" on public.quotes for insert with check (public.is_org_member(organization_id));
create policy "Tenant update quotes" on public.quotes for update using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "Tenant delete quotes" on public.quotes for delete using (public.is_org_admin(organization_id));
create policy "Tenant manage quote items" on public.quote_items for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "Tenant read quote events" on public.quote_events for select using (public.is_org_member(organization_id));
create policy "Tenant create quote events" on public.quote_events for insert with check (public.is_org_member(organization_id));

grant select, insert, update, delete on public.quotes, public.quote_items to authenticated;
grant select, insert on public.quote_events to authenticated;
grant all on public.quotes, public.quote_items, public.quote_events to service_role;
grant usage, select on sequence public.quote_number_seq to authenticated, service_role;
