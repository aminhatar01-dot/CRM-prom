drop trigger if exists validate_phase18_automation_runs_tenant on public.automation_runs;
drop trigger if exists validate_phase18_automation_drafts_tenant on public.automation_drafts;
drop trigger if exists validate_phase18_automation_logs_tenant on public.automation_execution_logs;
drop function if exists public.validate_phase18_automation_tenant();

create or replace function public.validate_phase18_automation_run_tenant()
returns trigger
language plpgsql
as $$
begin
  if new.rule_id is not null and not exists (
    select 1 from public.automation_rules
    where id = new.rule_id and organization_id = new.organization_id
  ) then raise exception 'rule_id must belong to the same organization'; end if;
  if new.conversation_id is not null and not exists (
    select 1 from public.conversations
    where id = new.conversation_id and organization_id = new.organization_id
  ) then raise exception 'conversation_id must belong to the same organization'; end if;
  if new.lead_id is not null and not exists (
    select 1 from public.leads
    where id = new.lead_id and organization_id = new.organization_id
  ) then raise exception 'lead_id must belong to the same organization'; end if;
  if new.contact_id is not null and not exists (
    select 1 from public.contacts
    where id = new.contact_id and organization_id = new.organization_id
  ) then raise exception 'contact_id must belong to the same organization'; end if;
  if new.message_id is not null and not exists (
    select 1 from public.messages
    where id = new.message_id and organization_id = new.organization_id
  ) then raise exception 'message_id must belong to the same organization'; end if;
  return new;
end;
$$;

create or replace function public.validate_phase18_automation_draft_tenant()
returns trigger
language plpgsql
as $$
begin
  if new.rule_id is not null and not exists (
    select 1 from public.automation_rules
    where id = new.rule_id and organization_id = new.organization_id
  ) then raise exception 'rule_id must belong to the same organization'; end if;
  if not exists (
    select 1 from public.conversations
    where id = new.conversation_id and organization_id = new.organization_id
  ) then raise exception 'conversation_id must belong to the same organization'; end if;
  if new.run_id is not null and not exists (
    select 1 from public.automation_runs
    where id = new.run_id and organization_id = new.organization_id
  ) then raise exception 'run_id must belong to the same organization'; end if;
  if new.message_id is not null and not exists (
    select 1 from public.messages
    where id = new.message_id and organization_id = new.organization_id
  ) then raise exception 'message_id must belong to the same organization'; end if;
  if new.sent_message_id is not null and not exists (
    select 1 from public.messages
    where id = new.sent_message_id and organization_id = new.organization_id
  ) then raise exception 'sent_message_id must belong to the same organization'; end if;
  return new;
end;
$$;

create or replace function public.validate_phase18_automation_log_tenant()
returns trigger
language plpgsql
as $$
begin
  if new.rule_id is not null and not exists (
    select 1 from public.automation_rules
    where id = new.rule_id and organization_id = new.organization_id
  ) then raise exception 'rule_id must belong to the same organization'; end if;
  if not exists (
    select 1 from public.automation_runs
    where id = new.run_id and organization_id = new.organization_id
  ) then raise exception 'run_id must belong to the same organization'; end if;
  return new;
end;
$$;

create trigger validate_phase18_automation_runs_tenant
before insert or update on public.automation_runs
for each row execute function public.validate_phase18_automation_run_tenant();

create trigger validate_phase18_automation_drafts_tenant
before insert or update on public.automation_drafts
for each row execute function public.validate_phase18_automation_draft_tenant();

create trigger validate_phase18_automation_logs_tenant
before insert or update on public.automation_execution_logs
for each row execute function public.validate_phase18_automation_log_tenant();
