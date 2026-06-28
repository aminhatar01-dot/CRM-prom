alter table public.conversations
  add column if not exists assistant_routing_mode text not null default 'auto'
    check (assistant_routing_mode in ('auto', 'manual')),
  add column if not exists forced_assistant_id uuid references public.ai_assistants(id) on delete set null,
  add column if not exists current_assistant_id uuid references public.ai_assistants(id) on delete set null,
  add column if not exists assistant_routing_metadata jsonb not null default '{}'::jsonb;

alter table public.conversations
  drop constraint if exists conversations_assistant_routing_metadata_object,
  add constraint conversations_assistant_routing_metadata_object
    check (jsonb_typeof(assistant_routing_metadata) = 'object');

create index if not exists conversations_current_assistant_idx
  on public.conversations(organization_id, current_assistant_id)
  where archived_at is null;

create or replace function public.validate_conversation_assistant_tenant()
returns trigger language plpgsql as $$
begin
  if new.forced_assistant_id is not null and not exists (
    select 1 from public.ai_assistants
    where id = new.forced_assistant_id and organization_id = new.organization_id and archived_at is null
  ) then raise exception 'forced_assistant_id must belong to the same organization' using errcode = '23514'; end if;
  if new.current_assistant_id is not null and not exists (
    select 1 from public.ai_assistants
    where id = new.current_assistant_id and organization_id = new.organization_id and archived_at is null
  ) then raise exception 'current_assistant_id must belong to the same organization' using errcode = '23514'; end if;
  if new.assistant_routing_mode = 'manual' and new.forced_assistant_id is null then
    raise exception 'manual routing requires forced_assistant_id' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_conversation_assistant_tenant on public.conversations;
create trigger validate_conversation_assistant_tenant
before insert or update of organization_id, assistant_routing_mode, forced_assistant_id, current_assistant_id
on public.conversations for each row execute function public.validate_conversation_assistant_tenant();

update public.ai_assistants
set agent_config = agent_config || jsonb_build_object(
  'can_answer_prices', coalesce(agent_config->'can_answer_prices', 'false'::jsonb),
  'can_create_quotes', coalesce(agent_config->'can_create_quotes', 'false'::jsonb),
  'can_send_quotes', coalesce(agent_config->'can_send_quotes', 'false'::jsonb),
  'quote_requires_human_approval', coalesce(agent_config->'quote_requires_human_approval', 'true'::jsonb),
  'can_auto_send_simple_prices', coalesce(agent_config->'can_auto_send_simple_prices', 'false'::jsonb),
  'can_auto_send_full_quotes', coalesce(agent_config->'can_auto_send_full_quotes', 'false'::jsonb),
  'quote_auto_send_max_amount', coalesce(agent_config->'quote_auto_send_max_amount', 'null'::jsonb),
  'missing_price_behavior', coalesce(agent_config->'missing_price_behavior', '"human"'::jsonb),
  'missing_stock_behavior', coalesce(agent_config->'missing_stock_behavior', '"confirm"'::jsonb),
  'quote_knowledge_categories', coalesce(agent_config->'quote_knowledge_categories', '[]'::jsonb),
  'default_currency', coalesce(agent_config->'default_currency', '"ARS"'::jsonb),
  'default_commercial_terms', coalesce(agent_config->'default_commercial_terms', '""'::jsonb)
);

comment on column public.conversations.assistant_routing_mode is 'auto lets the router select; manual pins forced_assistant_id.';
comment on column public.conversations.assistant_routing_metadata is 'Last tenant-safe assistant routing decision shown in Inbox.';
