-- FASE 13: replace polymorphic integrity triggers with table-specific checks.
-- This migration is data-preserving and safe to apply to an existing remote database.

alter table public.leads add column if not exists archived_at timestamptz;
alter table public.contacts add column if not exists archived_at timestamptz;
alter table public.conversations add column if not exists archived_at timestamptz;
alter table public.messages add column if not exists archived_at timestamptz;
alter table public.ai_assistants add column if not exists archived_at timestamptz;
alter table public.tags add column if not exists archived_at timestamptz;
alter table public.variables add column if not exists archived_at timestamptz;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to authenticated;
grant all privileges on all sequences in schema public to service_role;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all privileges on tables to service_role;
alter default privileges in schema public
  grant usage, select on sequences to authenticated;
alter default privileges in schema public
  grant all privileges on sequences to service_role;

create index if not exists leads_org_active_idx on public.leads(organization_id, archived_at, created_at desc);
create index if not exists contacts_org_active_idx on public.contacts(organization_id, archived_at, created_at desc);
create index if not exists conversations_org_active_idx on public.conversations(organization_id, archived_at, last_message_at desc);
create index if not exists messages_conversation_active_idx on public.messages(conversation_id, archived_at, created_at);
create index if not exists ai_assistants_org_archived_idx on public.ai_assistants(organization_id, archived_at);
create index if not exists tags_org_archived_idx on public.tags(organization_id, archived_at);
create index if not exists variables_org_archived_idx on public.variables(organization_id, archived_at);

drop trigger if exists enforce_leads_tenant_integrity on public.leads;
drop trigger if exists enforce_conversations_tenant_integrity on public.conversations;
drop trigger if exists enforce_messages_tenant_integrity on public.messages;
drop trigger if exists enforce_lead_tags_tenant_integrity on public.lead_tags;
drop trigger if exists enforce_conversation_smart_tags_tenant_integrity on public.conversation_smart_tags;
drop trigger if exists enforce_smart_tag_classification_logs_tenant_integrity on public.smart_tag_classification_logs;
drop trigger if exists enforce_lead_variables_tenant_integrity on public.lead_variables;
drop trigger if exists enforce_conversation_variables_tenant_integrity on public.conversation_variables;
drop trigger if exists enforce_variable_extraction_logs_tenant_integrity on public.variable_extraction_logs;
drop trigger if exists automation_actions_tenant_integrity on public.automation_actions;
drop trigger if exists automation_runs_tenant_integrity on public.automation_runs;
drop trigger if exists tasks_tenant_integrity on public.tasks;
drop trigger if exists internal_notifications_tenant_integrity on public.internal_notifications;
drop trigger if exists enforce_webchat_widgets_tenant_integrity on public.webchat_widgets;
drop trigger if exists enforce_conversations_webchat_tenant_integrity on public.conversations;
drop trigger if exists enforce_integration_tools_tenant_integrity on public.integration_tools;
drop trigger if exists enforce_integration_tool_runs_tenant_integrity on public.integration_tool_runs;
drop trigger if exists enforce_google_sheets_connections_tenant_integrity on public.google_sheets_connections;
drop trigger if exists enforce_integration_secrets_tenant_integrity on public.integration_secrets;

drop function if exists public.enforce_crm_tenant_integrity();
drop function if exists public.enforce_smart_tag_tenant_integrity();
drop function if exists public.enforce_variable_tenant_integrity();
drop function if exists public.enforce_automation_tenant_integrity();
drop function if exists public.enforce_webchat_tenant_integrity();
drop function if exists public.enforce_integration_tenant_integrity();

create or replace function public.assert_org_user(org_id uuid, referenced_user_id uuid, field_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if referenced_user_id is not null and not exists (
    select 1
    from public.organization_members
    where organization_id = org_id
      and user_id = referenced_user_id
  ) then
    raise exception '% must belong to the same organization', field_name
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function public.assert_org_user(uuid, uuid, text) from public;
grant execute on function public.assert_org_user(uuid, uuid, text) to authenticated, service_role;

create or replace function public.validate_contact_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.assert_org_user(new.organization_id, new.owner_id, 'owner_id');

  if new.converted_from_lead_id is not null and not exists (
    select 1 from public.leads
    where id = new.converted_from_lead_id
      and organization_id = new.organization_id
  ) then
    raise exception 'converted_from_lead_id must belong to the same organization'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_lead_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.assert_org_user(new.organization_id, new.owner_id, 'owner_id');

  if new.contact_id is not null and not exists (
    select 1 from public.contacts where id = new.contact_id and organization_id = new.organization_id
  ) then
    raise exception 'contact_id must belong to the same organization' using errcode = '23514';
  end if;

  if new.pipeline_id is not null and not exists (
    select 1 from public.pipelines where id = new.pipeline_id and organization_id = new.organization_id
  ) then
    raise exception 'pipeline_id must belong to the same organization' using errcode = '23514';
  end if;

  if new.stage_id is not null and not exists (
    select 1 from public.pipeline_stages
    where id = new.stage_id
      and organization_id = new.organization_id
      and (new.pipeline_id is null or pipeline_id = new.pipeline_id)
  ) then
    raise exception 'stage_id must belong to the same organization and pipeline' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_conversation_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.assert_org_user(new.organization_id, new.owner_id, 'owner_id');

  if new.lead_id is not null and not exists (
    select 1 from public.leads where id = new.lead_id and organization_id = new.organization_id
  ) then
    raise exception 'lead_id must belong to the same organization' using errcode = '23514';
  end if;

  if new.contact_id is not null and not exists (
    select 1 from public.contacts where id = new.contact_id and organization_id = new.organization_id
  ) then
    raise exception 'contact_id must belong to the same organization' using errcode = '23514';
  end if;

  if new.webchat_widget_id is not null and not exists (
    select 1 from public.webchat_widgets where id = new.webchat_widget_id and organization_id = new.organization_id
  ) then
    raise exception 'webchat_widget_id must belong to the same organization' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_message_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.conversations
    where id = new.conversation_id
      and organization_id = new.organization_id
  ) then
    raise exception 'conversation_id must belong to the same organization' using errcode = '23514';
  end if;

  perform public.assert_org_user(new.organization_id, new.sender_user_id, 'sender_user_id');
  return new;
end;
$$;

create or replace function public.validate_lead_tag_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.leads where id = new.lead_id and organization_id = new.organization_id
  ) then
    raise exception 'lead_id must belong to the same organization' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.tags where id = new.tag_id and organization_id = new.organization_id
  ) then
    raise exception 'tag_id must belong to the same organization' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_conversation_smart_tag_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.conversations where id = new.conversation_id and organization_id = new.organization_id
  ) then
    raise exception 'conversation_id must belong to the same organization' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.tags where id = new.tag_id and organization_id = new.organization_id
  ) then
    raise exception 'tag_id must belong to the same organization' using errcode = '23514';
  end if;

  perform public.assert_org_user(new.organization_id, new.assigned_by, 'assigned_by');
  return new;
end;
$$;

create or replace function public.validate_smart_tag_log_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.conversation_id is not null and not exists (
    select 1 from public.conversations where id = new.conversation_id and organization_id = new.organization_id
  ) then
    raise exception 'conversation_id must belong to the same organization' using errcode = '23514';
  end if;

  if new.lead_id is not null and not exists (
    select 1 from public.leads where id = new.lead_id and organization_id = new.organization_id
  ) then
    raise exception 'lead_id must belong to the same organization' using errcode = '23514';
  end if;

  if new.tag_id is not null and not exists (
    select 1 from public.tags where id = new.tag_id and organization_id = new.organization_id
  ) then
    raise exception 'tag_id must belong to the same organization' using errcode = '23514';
  end if;

  if new.ai_log_id is not null and not exists (
    select 1 from public.ai_logs where id = new.ai_log_id and organization_id = new.organization_id
  ) then
    raise exception 'ai_log_id must belong to the same organization' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_lead_variable_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.leads where id = new.lead_id and organization_id = new.organization_id
  ) then
    raise exception 'lead_id must belong to the same organization' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.variables where id = new.variable_id and organization_id = new.organization_id
  ) then
    raise exception 'variable_id must belong to the same organization' using errcode = '23514';
  end if;

  if new.source_message_id is not null and not exists (
    select 1 from public.messages where id = new.source_message_id and organization_id = new.organization_id
  ) then
    raise exception 'source_message_id must belong to the same organization' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_conversation_variable_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.conversations where id = new.conversation_id and organization_id = new.organization_id
  ) then
    raise exception 'conversation_id must belong to the same organization' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.variables where id = new.variable_id and organization_id = new.organization_id
  ) then
    raise exception 'variable_id must belong to the same organization' using errcode = '23514';
  end if;

  if new.source_message_id is not null and not exists (
    select 1 from public.messages where id = new.source_message_id and organization_id = new.organization_id
  ) then
    raise exception 'source_message_id must belong to the same organization' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_variable_log_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.variable_id is not null and not exists (
    select 1 from public.variables where id = new.variable_id and organization_id = new.organization_id
  ) then
    raise exception 'variable_id must belong to the same organization' using errcode = '23514';
  end if;

  if new.lead_id is not null and not exists (
    select 1 from public.leads where id = new.lead_id and organization_id = new.organization_id
  ) then
    raise exception 'lead_id must belong to the same organization' using errcode = '23514';
  end if;

  if new.conversation_id is not null and not exists (
    select 1 from public.conversations where id = new.conversation_id and organization_id = new.organization_id
  ) then
    raise exception 'conversation_id must belong to the same organization' using errcode = '23514';
  end if;

  if new.source_message_id is not null and not exists (
    select 1 from public.messages where id = new.source_message_id and organization_id = new.organization_id
  ) then
    raise exception 'source_message_id must belong to the same organization' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_automation_action_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.automation_rules where id = new.rule_id and organization_id = new.organization_id
  ) then
    raise exception 'rule_id must belong to the same organization' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_automation_run_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.rule_id is not null and not exists (
    select 1 from public.automation_rules where id = new.rule_id and organization_id = new.organization_id
  ) then
    raise exception 'rule_id must belong to the same organization' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_task_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.lead_id is not null and not exists (
    select 1 from public.leads where id = new.lead_id and organization_id = new.organization_id
  ) then
    raise exception 'lead_id must belong to the same organization' using errcode = '23514';
  end if;

  if new.conversation_id is not null and not exists (
    select 1 from public.conversations where id = new.conversation_id and organization_id = new.organization_id
  ) then
    raise exception 'conversation_id must belong to the same organization' using errcode = '23514';
  end if;

  perform public.assert_org_user(new.organization_id, new.owner_id, 'owner_id');
  perform public.assert_org_user(new.organization_id, new.created_by, 'created_by');
  return new;
end;
$$;

create or replace function public.validate_internal_notification_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.assert_org_user(new.organization_id, new.user_id, 'user_id');
  return new;
end;
$$;

create or replace function public.validate_webchat_widget_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.assistant_id is not null and not exists (
    select 1 from public.ai_assistants where id = new.assistant_id and organization_id = new.organization_id
  ) then
    raise exception 'assistant_id must belong to the same organization' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_ai_log_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.assistant_id is not null and not exists (
    select 1 from public.ai_assistants where id = new.assistant_id and organization_id = new.organization_id
  ) then
    raise exception 'assistant_id must belong to the same organization' using errcode = '23514';
  end if;
  if new.conversation_id is not null and not exists (
    select 1 from public.conversations where id = new.conversation_id and organization_id = new.organization_id
  ) then
    raise exception 'conversation_id must belong to the same organization' using errcode = '23514';
  end if;
  if new.message_id is not null and not exists (
    select 1 from public.messages where id = new.message_id and organization_id = new.organization_id
  ) then
    raise exception 'message_id must belong to the same organization' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_ai_assistant_test_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.ai_assistants where id = new.assistant_id and organization_id = new.organization_id
  ) then
    raise exception 'assistant_id must belong to the same organization' using errcode = '23514';
  end if;
  if new.conversation_id is not null and not exists (
    select 1 from public.conversations where id = new.conversation_id and organization_id = new.organization_id
  ) then
    raise exception 'conversation_id must belong to the same organization' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_whatsapp_event_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.conversation_id is not null and not exists (
    select 1 from public.conversations where id = new.conversation_id and organization_id = new.organization_id
  ) then
    raise exception 'conversation_id must belong to the same organization' using errcode = '23514';
  end if;
  if new.message_id is not null and not exists (
    select 1 from public.messages where id = new.message_id and organization_id = new.organization_id
  ) then
    raise exception 'message_id must belong to the same organization' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_integration_tool_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.integrations where id = new.integration_id and organization_id = new.organization_id
  ) then
    raise exception 'integration_id must belong to the same organization' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_integration_run_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.integration_id is not null and not exists (
    select 1 from public.integrations where id = new.integration_id and organization_id = new.organization_id
  ) then
    raise exception 'integration_id must belong to the same organization' using errcode = '23514';
  end if;
  if new.tool_id is not null and not exists (
    select 1 from public.integration_tools where id = new.tool_id and organization_id = new.organization_id
  ) then
    raise exception 'tool_id must belong to the same organization' using errcode = '23514';
  end if;
  perform public.assert_org_user(new.organization_id, new.executed_by, 'executed_by');
  return new;
end;
$$;

create or replace function public.validate_google_sheets_connection_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.integrations where id = new.integration_id and organization_id = new.organization_id
  ) then
    raise exception 'integration_id must belong to the same organization' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.validate_integration_secret_tenant()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.integration_id is not null and not exists (
    select 1 from public.integrations where id = new.integration_id and organization_id = new.organization_id
  ) then
    raise exception 'integration_id must belong to the same organization' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger validate_contacts_tenant before insert or update on public.contacts
for each row execute function public.validate_contact_tenant();
create trigger validate_leads_tenant before insert or update on public.leads
for each row execute function public.validate_lead_tenant();
create trigger validate_conversations_tenant before insert or update on public.conversations
for each row execute function public.validate_conversation_tenant();
create trigger validate_messages_tenant before insert or update on public.messages
for each row execute function public.validate_message_tenant();
create trigger validate_lead_tags_tenant before insert or update on public.lead_tags
for each row execute function public.validate_lead_tag_tenant();
create trigger validate_conversation_smart_tags_tenant before insert or update on public.conversation_smart_tags
for each row execute function public.validate_conversation_smart_tag_tenant();
create trigger validate_smart_tag_logs_tenant before insert or update on public.smart_tag_classification_logs
for each row execute function public.validate_smart_tag_log_tenant();
create trigger validate_lead_variables_tenant before insert or update on public.lead_variables
for each row execute function public.validate_lead_variable_tenant();
create trigger validate_conversation_variables_tenant before insert or update on public.conversation_variables
for each row execute function public.validate_conversation_variable_tenant();
create trigger validate_variable_logs_tenant before insert or update on public.variable_extraction_logs
for each row execute function public.validate_variable_log_tenant();
create trigger validate_automation_actions_tenant before insert or update on public.automation_actions
for each row execute function public.validate_automation_action_tenant();
create trigger validate_automation_runs_tenant before insert or update on public.automation_runs
for each row execute function public.validate_automation_run_tenant();
create trigger validate_tasks_tenant before insert or update on public.tasks
for each row execute function public.validate_task_tenant();
create trigger validate_internal_notifications_tenant before insert or update on public.internal_notifications
for each row execute function public.validate_internal_notification_tenant();
create trigger validate_webchat_widgets_tenant before insert or update on public.webchat_widgets
for each row execute function public.validate_webchat_widget_tenant();
create trigger validate_ai_logs_tenant before insert or update on public.ai_logs
for each row execute function public.validate_ai_log_tenant();
create trigger validate_ai_assistant_tests_tenant before insert or update on public.ai_assistant_tests
for each row execute function public.validate_ai_assistant_test_tenant();
create trigger validate_whatsapp_events_tenant before insert or update on public.whatsapp_events
for each row execute function public.validate_whatsapp_event_tenant();
create trigger validate_integration_tools_tenant before insert or update on public.integration_tools
for each row execute function public.validate_integration_tool_tenant();
create trigger validate_integration_runs_tenant before insert or update on public.integration_tool_runs
for each row execute function public.validate_integration_run_tenant();
create trigger validate_google_sheets_connections_tenant before insert or update on public.google_sheets_connections
for each row execute function public.validate_google_sheets_connection_tenant();
create trigger validate_integration_secrets_tenant before insert or update on public.integration_secrets
for each row execute function public.validate_integration_secret_tenant();
