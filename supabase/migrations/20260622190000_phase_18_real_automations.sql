alter type public.automation_trigger_type add value if not exists 'conversation_created';
alter type public.automation_trigger_type add value if not exists 'lead_status_changed';

alter type public.automation_action_type add value if not exists 'extract_variable';
alter type public.automation_action_type add value if not exists 'change_lead_status';
alter type public.automation_action_type add value if not exists 'create_activity';
alter type public.automation_action_type add value if not exists 'generate_ai_draft';

alter table public.automation_rules
  add column if not exists auto_send boolean not null default false,
  add column if not exists auto_reply_limit integer not null default 1
    check (auto_reply_limit between 1 and 10),
  add column if not exists auto_reply_window_minutes integer not null default 1440
    check (auto_reply_window_minutes between 1 and 1440);

alter table public.automation_runs
  add column if not exists idempotency_key text,
  add column if not exists conversation_id uuid references public.conversations(id) on delete set null,
  add column if not exists lead_id uuid references public.leads(id) on delete set null,
  add column if not exists contact_id uuid references public.contacts(id) on delete set null,
  add column if not exists message_id uuid references public.messages(id) on delete set null,
  add column if not exists initiated_by uuid references auth.users(id) on delete set null;

create unique index if not exists automation_runs_org_idempotency_idx
  on public.automation_runs(organization_id, idempotency_key)
  where idempotency_key is not null;

create table public.automation_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid references public.automation_rules(id) on delete set null,
  run_id uuid references public.automation_runs(id) on delete set null,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  message_id uuid references public.messages(id) on delete set null,
  assistant_id uuid references public.ai_assistants(id) on delete set null,
  body text not null check (char_length(body) between 1 and 4096),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'discarded', 'sent', 'failed', 'blocked')),
  auto_send_requested boolean not null default false,
  model text,
  mode text,
  token_usage jsonb not null default '{}'::jsonb,
  error_message text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  sent_message_id uuid references public.messages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.automation_execution_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid references public.automation_rules(id) on delete set null,
  run_id uuid not null references public.automation_runs(id) on delete cascade,
  action_type text,
  status text not null check (status in ('started', 'completed', 'skipped', 'failed', 'blocked')),
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error_message text,
  model text,
  token_usage jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index automation_drafts_conversation_idx
  on public.automation_drafts(organization_id, conversation_id, status, created_at desc);
create index automation_execution_logs_run_idx
  on public.automation_execution_logs(organization_id, run_id, created_at);
create index automation_runs_context_idx
  on public.automation_runs(organization_id, conversation_id, lead_id, created_at desc);

create trigger automation_drafts_set_updated_at
before update on public.automation_drafts
for each row execute function public.touch_updated_at();

alter table public.automation_drafts enable row level security;
alter table public.automation_execution_logs enable row level security;

create policy "automation drafts readable by org members"
on public.automation_drafts for select
using (public.is_org_member(organization_id));

create policy "automation drafts writable by org members"
on public.automation_drafts for all
using (public.is_org_member(organization_id))
with check (public.is_org_member(organization_id));

create policy "automation execution logs readable by org members"
on public.automation_execution_logs for select
using (public.is_org_member(organization_id));

create policy "automation execution logs writable by org admins"
on public.automation_execution_logs for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create or replace function public.validate_phase18_automation_tenant()
returns trigger
language plpgsql
as $$
begin
  if new.rule_id is not null and not exists (
    select 1 from public.automation_rules
    where id = new.rule_id and organization_id = new.organization_id
  ) then
    raise exception 'rule_id must belong to the same organization';
  end if;

  if tg_table_name = 'automation_runs' then
    if new.conversation_id is not null and not exists (
      select 1 from public.conversations
      where id = new.conversation_id and organization_id = new.organization_id
    ) then raise exception 'conversation_id must belong to the same organization'; end if;
    if new.lead_id is not null and not exists (
      select 1 from public.leads where id = new.lead_id and organization_id = new.organization_id
    ) then raise exception 'lead_id must belong to the same organization'; end if;
    if new.contact_id is not null and not exists (
      select 1 from public.contacts where id = new.contact_id and organization_id = new.organization_id
    ) then raise exception 'contact_id must belong to the same organization'; end if;
    if new.message_id is not null and not exists (
      select 1 from public.messages where id = new.message_id and organization_id = new.organization_id
    ) then raise exception 'message_id must belong to the same organization'; end if;
  end if;

  if tg_table_name = 'automation_drafts' then
    if not exists (
      select 1 from public.conversations
      where id = new.conversation_id and organization_id = new.organization_id
    ) then raise exception 'conversation_id must belong to the same organization'; end if;
    if new.run_id is not null and not exists (
      select 1 from public.automation_runs
      where id = new.run_id and organization_id = new.organization_id
    ) then raise exception 'run_id must belong to the same organization'; end if;
  end if;

  if tg_table_name = 'automation_execution_logs' and not exists (
    select 1 from public.automation_runs
    where id = new.run_id and organization_id = new.organization_id
  ) then raise exception 'run_id must belong to the same organization'; end if;

  return new;
end;
$$;

create trigger validate_phase18_automation_runs_tenant
before insert or update on public.automation_runs
for each row execute function public.validate_phase18_automation_tenant();

create trigger validate_phase18_automation_drafts_tenant
before insert or update on public.automation_drafts
for each row execute function public.validate_phase18_automation_tenant();

create trigger validate_phase18_automation_logs_tenant
before insert or update on public.automation_execution_logs
for each row execute function public.validate_phase18_automation_tenant();

alter publication supabase_realtime add table public.automation_drafts;
alter publication supabase_realtime add table public.automation_execution_logs;
