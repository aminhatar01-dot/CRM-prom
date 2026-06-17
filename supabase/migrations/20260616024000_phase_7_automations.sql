create type public.automation_rule_status as enum ('draft', 'active', 'paused', 'archived');
create type public.automation_run_status as enum ('pending', 'running', 'completed', 'failed', 'cancelled');
create type public.task_status as enum ('pending', 'completed', 'cancelled');

alter table public.automation_rules
  add column if not exists description text,
  add column if not exists status public.automation_rule_status not null default 'draft',
  add column if not exists trigger_config jsonb not null default '{}'::jsonb,
  add column if not exists conditions jsonb not null default '{}'::jsonb,
  add column if not exists last_run_at timestamptz;

alter table public.automation_rules
  alter column enabled set default false;

update public.automation_rules
set enabled = false,
    status = 'draft'
where status is null or enabled = true;

alter table public.automation_actions
  add column if not exists enabled boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

create table public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid references public.automation_rules(id) on delete set null,
  trigger_type public.automation_trigger_type not null,
  status public.automation_run_status not null default 'pending',
  context jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error_message text,
  scheduled_for timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  status public.task_status not null default 'pending',
  due_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.internal_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  title text not null,
  body text,
  entity_table text,
  entity_id uuid,
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index automation_rules_org_status_idx on public.automation_rules(organization_id, status);
create index automation_runs_org_status_schedule_idx on public.automation_runs(organization_id, status, scheduled_for);
create index automation_runs_rule_idx on public.automation_runs(rule_id);
create index tasks_org_status_idx on public.tasks(organization_id, status);
create index tasks_lead_idx on public.tasks(lead_id);
create index tasks_conversation_idx on public.tasks(conversation_id);
create index internal_notifications_org_user_idx on public.internal_notifications(organization_id, user_id, read_at);

create trigger automation_actions_set_updated_at
before update on public.automation_actions
for each row execute function public.touch_updated_at();

create trigger automation_runs_set_updated_at
before update on public.automation_runs
for each row execute function public.touch_updated_at();

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function public.touch_updated_at();

create trigger internal_notifications_set_updated_at
before update on public.internal_notifications
for each row execute function public.touch_updated_at();

alter table public.automation_runs enable row level security;
alter table public.tasks enable row level security;
alter table public.internal_notifications enable row level security;

create policy "automation runs readable by org members"
on public.automation_runs for select
using (public.is_org_member(organization_id));

create policy "automation runs writable by org members"
on public.automation_runs for all
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "tasks readable by org members"
on public.tasks for select
using (public.is_org_member(organization_id));

create policy "tasks writable by org members"
on public.tasks for all
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "internal notifications readable by org members"
on public.internal_notifications for select
using (public.is_org_member(organization_id));

create policy "internal notifications writable by org members"
on public.internal_notifications for all
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create or replace function public.enforce_automation_tenant_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  referenced_org uuid;
begin
  if tg_table_name = 'automation_actions' then
    select organization_id into referenced_org from public.automation_rules where id = new.rule_id;
    if referenced_org is null or referenced_org <> new.organization_id then
      raise exception 'Cross-tenant automation action rejected';
    end if;
  end if;

  if tg_table_name = 'automation_runs' and new.rule_id is not null then
    select organization_id into referenced_org from public.automation_rules where id = new.rule_id;
    if referenced_org is null or referenced_org <> new.organization_id then
      raise exception 'Cross-tenant automation run rejected';
    end if;
  end if;

  if tg_table_name = 'tasks' then
    if new.lead_id is not null then
      select organization_id into referenced_org from public.leads where id = new.lead_id;
      if referenced_org is null or referenced_org <> new.organization_id then
        raise exception 'Cross-tenant task lead rejected';
      end if;
    end if;

    if new.conversation_id is not null then
      select organization_id into referenced_org from public.conversations where id = new.conversation_id;
      if referenced_org is null or referenced_org <> new.organization_id then
        raise exception 'Cross-tenant task conversation rejected';
      end if;
    end if;

    if new.owner_id is not null and not exists (
      select 1 from public.organization_members
      where organization_id = new.organization_id and user_id = new.owner_id
    ) then
      raise exception 'Task owner must belong to organization';
    end if;
  end if;

  if tg_table_name = 'internal_notifications' and new.user_id is not null and not exists (
    select 1 from public.organization_members
    where organization_id = new.organization_id and user_id = new.user_id
  ) then
    raise exception 'Notification user must belong to organization';
  end if;

  return new;
end;
$$;

create trigger automation_actions_tenant_integrity
before insert or update on public.automation_actions
for each row execute function public.enforce_automation_tenant_integrity();

create trigger automation_runs_tenant_integrity
before insert or update on public.automation_runs
for each row execute function public.enforce_automation_tenant_integrity();

create trigger tasks_tenant_integrity
before insert or update on public.tasks
for each row execute function public.enforce_automation_tenant_integrity();

create trigger internal_notifications_tenant_integrity
before insert or update on public.internal_notifications
for each row execute function public.enforce_automation_tenant_integrity();

alter publication supabase_realtime add table public.automation_runs;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.internal_notifications;

