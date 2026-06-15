create type public.variable_type as enum ('text', 'long_text', 'number', 'price', 'boolean', 'option', 'link');

create table public.variables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  key text not null check (key ~ '^[a-z][a-z0-9_]*$'),
  description text,
  type public.variable_type not null,
  extraction_prompt text not null,
  active boolean not null default true,
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb,
  auto_extract_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, key)
);

create table public.lead_variables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  variable_id uuid not null references public.variables(id) on delete cascade,
  value jsonb not null,
  confidence numeric(5, 4),
  source_message_id uuid references public.messages(id) on delete set null,
  extracted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lead_id, variable_id)
);

create table public.conversation_variables (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  variable_id uuid not null references public.variables(id) on delete cascade,
  value jsonb not null,
  confidence numeric(5, 4),
  source_message_id uuid references public.messages(id) on delete set null,
  extracted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id, variable_id)
);

create table public.variable_extraction_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  variable_id uuid references public.variables(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  source_message_id uuid references public.messages(id) on delete set null,
  mode text not null default 'demo',
  extracted boolean not null default false,
  value jsonb,
  confidence numeric(5, 4),
  reason text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger touch_variables_updated_at before update on public.variables for each row execute function public.touch_updated_at();
create trigger touch_lead_variables_updated_at before update on public.lead_variables for each row execute function public.touch_updated_at();
create trigger touch_conversation_variables_updated_at before update on public.conversation_variables for each row execute function public.touch_updated_at();
create trigger touch_variable_extraction_logs_updated_at before update on public.variable_extraction_logs for each row execute function public.touch_updated_at();

alter table public.variables enable row level security;
alter table public.lead_variables enable row level security;
alter table public.conversation_variables enable row level security;
alter table public.variable_extraction_logs enable row level security;

create policy "Tenant read variables" on public.variables for select using (public.is_org_member(organization_id));
create policy "Tenant manage variables" on public.variables for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy "Tenant read lead variables" on public.lead_variables for select using (public.is_org_member(organization_id));
create policy "Tenant write lead variables" on public.lead_variables for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "Tenant read conversation variables" on public.conversation_variables for select using (public.is_org_member(organization_id));
create policy "Tenant write conversation variables" on public.conversation_variables for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "Tenant read variable extraction logs" on public.variable_extraction_logs for select using (public.is_org_member(organization_id));
create policy "Tenant insert variable extraction logs" on public.variable_extraction_logs for insert with check (public.is_org_member(organization_id));

create or replace function public.enforce_variable_tenant_integrity()
returns trigger
language plpgsql
as $$
begin
  if new.variable_id is not null and not exists (
    select 1 from public.variables
    where id = new.variable_id
      and organization_id = new.organization_id
  ) then
    raise exception 'variable_id must belong to the same organization';
  end if;

  if tg_table_name = 'lead_variables' and not exists (
    select 1 from public.leads
    where id = new.lead_id
      and organization_id = new.organization_id
  ) then
    raise exception 'lead_id must belong to the same organization';
  end if;

  if tg_table_name = 'conversation_variables' and not exists (
    select 1 from public.conversations
    where id = new.conversation_id
      and organization_id = new.organization_id
  ) then
    raise exception 'conversation_id must belong to the same organization';
  end if;

  if tg_table_name = 'variable_extraction_logs' then
    if new.lead_id is not null and not exists (
      select 1 from public.leads
      where id = new.lead_id
        and organization_id = new.organization_id
    ) then
      raise exception 'lead_id must belong to the same organization';
    end if;

    if new.conversation_id is not null and not exists (
      select 1 from public.conversations
      where id = new.conversation_id
        and organization_id = new.organization_id
    ) then
      raise exception 'conversation_id must belong to the same organization';
    end if;

    if new.source_message_id is not null and not exists (
      select 1 from public.messages
      where id = new.source_message_id
        and organization_id = new.organization_id
    ) then
      raise exception 'source_message_id must belong to the same organization';
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_lead_variables_tenant_integrity before insert or update on public.lead_variables for each row execute function public.enforce_variable_tenant_integrity();
create trigger enforce_conversation_variables_tenant_integrity before insert or update on public.conversation_variables for each row execute function public.enforce_variable_tenant_integrity();
create trigger enforce_variable_extraction_logs_tenant_integrity before insert or update on public.variable_extraction_logs for each row execute function public.enforce_variable_tenant_integrity();

create index variables_org_active_idx on public.variables(organization_id, active);
create index lead_variables_org_lead_idx on public.lead_variables(organization_id, lead_id);
create index conversation_variables_org_conversation_idx on public.conversation_variables(organization_id, conversation_id);
create index variable_logs_org_created_idx on public.variable_extraction_logs(organization_id, created_at desc);

alter publication supabase_realtime add table public.lead_variables;
alter publication supabase_realtime add table public.conversation_variables;
alter publication supabase_realtime add table public.variable_extraction_logs;
