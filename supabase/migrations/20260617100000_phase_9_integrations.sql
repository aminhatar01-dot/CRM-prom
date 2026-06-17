create table public.integrations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  description text,
  kind text not null check (kind in ('custom_connect', 'google_sheets')),
  active boolean not null default false,
  credentials_ref text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.integration_tools (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid not null references public.integrations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  description text,
  type text not null check (type in ('custom_connect', 'google_sheets')),
  method text check (method in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  url text,
  headers_schema jsonb not null default '{}'::jsonb,
  body_schema jsonb not null default '{}'::jsonb,
  response_schema jsonb not null default '{}'::jsonb,
  active boolean not null default false,
  timeout_ms integer not null default 8000 check (timeout_ms between 1000 and 30000),
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.integration_tool_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid references public.integrations(id) on delete set null,
  tool_id uuid references public.integration_tools(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'running', 'success', 'failed')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error_message text,
  duration_ms integer,
  executed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.google_sheets_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid not null references public.integrations(id) on delete cascade,
  spreadsheet_url text not null,
  sheet_name text,
  api_key_ref text,
  active boolean not null default false,
  last_test_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, integration_id)
);

create table public.integration_secrets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid references public.integrations(id) on delete cascade,
  name text not null,
  credentials_ref text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, credentials_ref)
);

create trigger touch_integrations_updated_at before update on public.integrations for each row execute function public.touch_updated_at();
create trigger touch_integration_tools_updated_at before update on public.integration_tools for each row execute function public.touch_updated_at();
create trigger touch_integration_tool_runs_updated_at before update on public.integration_tool_runs for each row execute function public.touch_updated_at();
create trigger touch_google_sheets_connections_updated_at before update on public.google_sheets_connections for each row execute function public.touch_updated_at();
create trigger touch_integration_secrets_updated_at before update on public.integration_secrets for each row execute function public.touch_updated_at();

alter table public.integrations enable row level security;
alter table public.integration_tools enable row level security;
alter table public.integration_tool_runs enable row level security;
alter table public.google_sheets_connections enable row level security;
alter table public.integration_secrets enable row level security;

create policy "Tenant read integrations" on public.integrations for select using (public.is_org_member(organization_id));
create policy "Tenant manage integrations" on public.integrations for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy "Tenant read integration tools" on public.integration_tools for select using (public.is_org_member(organization_id));
create policy "Tenant manage integration tools" on public.integration_tools for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy "Tenant read integration tool runs" on public.integration_tool_runs for select using (public.is_org_member(organization_id));
create policy "Tenant insert integration tool runs" on public.integration_tool_runs for insert with check (public.is_org_member(organization_id));
create policy "Tenant update integration tool runs" on public.integration_tool_runs for update using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

create policy "Tenant read google sheets connections" on public.google_sheets_connections for select using (public.is_org_member(organization_id));
create policy "Tenant manage google sheets connections" on public.google_sheets_connections for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy "Tenant read integration secret refs" on public.integration_secrets for select using (public.is_org_admin(organization_id));
create policy "Tenant manage integration secret refs" on public.integration_secrets for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create or replace function public.enforce_integration_tenant_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  referenced_org uuid;
begin
  if tg_table_name in ('integration_tools', 'google_sheets_connections', 'integration_secrets') and new.integration_id is not null then
    select organization_id into referenced_org from public.integrations where id = new.integration_id;
    if referenced_org is null or referenced_org <> new.organization_id then
      raise exception 'Cross-tenant integration reference rejected';
    end if;
  end if;

  if tg_table_name = 'integration_tool_runs' then
    if new.integration_id is not null then
      select organization_id into referenced_org from public.integrations where id = new.integration_id;
      if referenced_org is null or referenced_org <> new.organization_id then
        raise exception 'Cross-tenant integration run rejected';
      end if;
    end if;

    if new.tool_id is not null then
      select organization_id into referenced_org from public.integration_tools where id = new.tool_id;
      if referenced_org is null or referenced_org <> new.organization_id then
        raise exception 'Cross-tenant tool run rejected';
      end if;
    end if;

    if new.executed_by is not null and not exists (
      select 1 from public.organization_members
      where organization_id = new.organization_id and user_id = new.executed_by
    ) then
      raise exception 'Tool run executor must belong to organization';
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_integration_tools_tenant_integrity
before insert or update on public.integration_tools
for each row execute function public.enforce_integration_tenant_integrity();

create trigger enforce_integration_tool_runs_tenant_integrity
before insert or update on public.integration_tool_runs
for each row execute function public.enforce_integration_tenant_integrity();

create trigger enforce_google_sheets_connections_tenant_integrity
before insert or update on public.google_sheets_connections
for each row execute function public.enforce_integration_tenant_integrity();

create trigger enforce_integration_secrets_tenant_integrity
before insert or update on public.integration_secrets
for each row execute function public.enforce_integration_tenant_integrity();

create index integrations_org_kind_idx on public.integrations(organization_id, kind, active);
create index integration_tools_org_active_idx on public.integration_tools(organization_id, active);
create index integration_tools_integration_idx on public.integration_tools(integration_id);
create index integration_tool_runs_org_created_idx on public.integration_tool_runs(organization_id, created_at desc);
create index google_sheets_connections_org_idx on public.google_sheets_connections(organization_id, active);

alter publication supabase_realtime add table public.integration_tool_runs;
