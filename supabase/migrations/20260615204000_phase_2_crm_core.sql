create type public.conversation_status as enum ('abierta', 'pendiente', 'cerrada');
create type public.conversation_ai_status as enum ('active', 'paused', 'human');
create type public.message_status as enum ('pending', 'sent', 'delivered', 'read', 'failed');

alter table public.contacts
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists company text,
  add column if not exists notes text,
  add column if not exists converted_from_lead_id uuid references public.leads(id) on delete set null;

alter table public.leads
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists company text,
  add column if not exists notes text;

alter table public.conversations
  add column if not exists status public.conversation_status not null default 'abierta',
  add column if not exists ai_status public.conversation_ai_status not null default 'human';

alter table public.messages
  add column if not exists channel public.conversation_channel not null default 'manual',
  add column if not exists status public.message_status not null default 'sent',
  add column if not exists updated_at timestamptz not null default now();

update public.leads
set
  first_name = coalesce(first_name, title),
  status = case
    when status::text = 'new' then 'nuevo'::public.lead_status
    when status::text = 'qualified' then 'interesado'::public.lead_status
    when status::text = 'won' then 'ganado'::public.lead_status
    when status::text = 'lost' then 'perdido'::public.lead_status
    else status
  end;

update public.contacts
set first_name = coalesce(first_name, full_name, 'Contacto sin nombre');

alter table public.leads
  alter column first_name set not null,
  alter column status set default 'nuevo';

alter table public.contacts
  alter column first_name set not null;

create trigger touch_messages_updated_at before update on public.messages for each row execute function public.touch_updated_at();

create or replace function public.sync_conversation_last_message()
returns trigger
language plpgsql
as $$
begin
  update public.conversations
  set last_message_at = new.created_at,
      updated_at = now()
  where id = new.conversation_id
    and organization_id = new.organization_id;

  return new;
end;
$$;

create trigger sync_conversation_last_message_after_insert
  after insert on public.messages
  for each row execute function public.sync_conversation_last_message();

create or replace function public.enforce_crm_tenant_integrity()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'leads' and new.contact_id is not null then
    if not exists (
      select 1 from public.contacts
      where id = new.contact_id
        and organization_id = new.organization_id
    ) then
      raise exception 'contact_id must belong to the same organization';
    end if;
  end if;

  if tg_table_name = 'conversations' then
    if new.lead_id is not null and not exists (
      select 1 from public.leads
      where id = new.lead_id
        and organization_id = new.organization_id
    ) then
      raise exception 'lead_id must belong to the same organization';
    end if;

    if new.contact_id is not null and not exists (
      select 1 from public.contacts
      where id = new.contact_id
        and organization_id = new.organization_id
    ) then
      raise exception 'contact_id must belong to the same organization';
    end if;
  end if;

  if tg_table_name = 'messages' and not exists (
    select 1 from public.conversations
    where id = new.conversation_id
      and organization_id = new.organization_id
  ) then
    raise exception 'conversation_id must belong to the same organization';
  end if;

  if tg_table_name = 'lead_tags' then
    if not exists (
      select 1 from public.leads
      where id = new.lead_id
        and organization_id = new.organization_id
    ) then
      raise exception 'lead_id must belong to the same organization';
    end if;

    if not exists (
      select 1 from public.tags
      where id = new.tag_id
        and organization_id = new.organization_id
    ) then
      raise exception 'tag_id must belong to the same organization';
    end if;
  end if;

  if new.owner_id is not null and not exists (
    select 1 from public.organization_members
    where organization_id = new.organization_id
      and user_id = new.owner_id
  ) then
    raise exception 'owner_id must belong to the same organization';
  end if;

  return new;
end;
$$;

create trigger enforce_leads_tenant_integrity
  before insert or update on public.leads
  for each row execute function public.enforce_crm_tenant_integrity();

create trigger enforce_conversations_tenant_integrity
  before insert or update on public.conversations
  for each row execute function public.enforce_crm_tenant_integrity();

create trigger enforce_messages_tenant_integrity
  before insert or update on public.messages
  for each row execute function public.enforce_crm_tenant_integrity();

create trigger enforce_lead_tags_tenant_integrity
  before insert or update on public.lead_tags
  for each row execute function public.enforce_crm_tenant_integrity();

create index if not exists leads_search_idx on public.leads using gin (
  to_tsvector(
    'simple',
    coalesce(first_name, '') || ' ' ||
    coalesce(last_name, '') || ' ' ||
    coalesce(email, '') || ' ' ||
    coalesce(phone, '') || ' ' ||
    coalesce(company, '')
  )
);
create index if not exists leads_status_idx on public.leads(organization_id, status);
create index if not exists contacts_search_idx on public.contacts using gin (
  to_tsvector(
    'simple',
    coalesce(first_name, '') || ' ' ||
    coalesce(last_name, '') || ' ' ||
    coalesce(email, '') || ' ' ||
    coalesce(phone, '') || ' ' ||
    coalesce(company, '')
  )
);
create index if not exists conversations_status_idx on public.conversations(organization_id, status);
create index if not exists conversations_channel_idx on public.conversations(organization_id, channel);
create index if not exists conversations_last_message_at_idx on public.conversations(organization_id, last_message_at desc nulls last);

alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.leads;
