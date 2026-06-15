alter table public.tags
  add column if not exists description text,
  add column if not exists classification_prompt text,
  add column if not exists active boolean not null default true,
  add column if not exists auto_pause_assistant boolean not null default false,
  add column if not exists notify_team boolean not null default false;

create table public.conversation_smart_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assignment_source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id, tag_id)
);

create table public.smart_tag_classification_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  tag_id uuid references public.tags(id) on delete set null,
  ai_log_id uuid references public.ai_logs(id) on delete set null,
  mode text not null default 'demo',
  matched boolean not null default false,
  confidence numeric(5, 4),
  reason text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger touch_conversation_smart_tags_updated_at
  before update on public.conversation_smart_tags
  for each row execute function public.touch_updated_at();

create trigger touch_smart_tag_classification_logs_updated_at
  before update on public.smart_tag_classification_logs
  for each row execute function public.touch_updated_at();

alter table public.conversation_smart_tags enable row level security;
alter table public.smart_tag_classification_logs enable row level security;

create policy "Tenant read conversation smart tags" on public.conversation_smart_tags
  for select using (public.is_org_member(organization_id));

create policy "Tenant write conversation smart tags" on public.conversation_smart_tags
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "Tenant read smart tag classification logs" on public.smart_tag_classification_logs
  for select using (public.is_org_member(organization_id));

create policy "Tenant insert smart tag classification logs" on public.smart_tag_classification_logs
  for insert with check (public.is_org_member(organization_id));

create or replace function public.enforce_smart_tag_tenant_integrity()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'conversation_smart_tags' then
    if not exists (
      select 1 from public.conversations
      where id = new.conversation_id
        and organization_id = new.organization_id
    ) then
      raise exception 'conversation_id must belong to the same organization';
    end if;

    if not exists (
      select 1 from public.tags
      where id = new.tag_id
        and organization_id = new.organization_id
    ) then
      raise exception 'tag_id must belong to the same organization';
    end if;
  end if;

  if tg_table_name = 'smart_tag_classification_logs' then
    if new.conversation_id is not null and not exists (
      select 1 from public.conversations
      where id = new.conversation_id
        and organization_id = new.organization_id
    ) then
      raise exception 'conversation_id must belong to the same organization';
    end if;

    if new.lead_id is not null and not exists (
      select 1 from public.leads
      where id = new.lead_id
        and organization_id = new.organization_id
    ) then
      raise exception 'lead_id must belong to the same organization';
    end if;

    if new.tag_id is not null and not exists (
      select 1 from public.tags
      where id = new.tag_id
        and organization_id = new.organization_id
    ) then
      raise exception 'tag_id must belong to the same organization';
    end if;
  end if;

  return new;
end;
$$;

create trigger enforce_conversation_smart_tags_tenant_integrity
  before insert or update on public.conversation_smart_tags
  for each row execute function public.enforce_smart_tag_tenant_integrity();

create trigger enforce_smart_tag_classification_logs_tenant_integrity
  before insert or update on public.smart_tag_classification_logs
  for each row execute function public.enforce_smart_tag_tenant_integrity();

create index conversation_smart_tags_org_idx on public.conversation_smart_tags(organization_id);
create index conversation_smart_tags_conversation_idx on public.conversation_smart_tags(organization_id, conversation_id);
create index smart_tag_logs_org_idx on public.smart_tag_classification_logs(organization_id, created_at desc);
create index smart_tag_logs_conversation_idx on public.smart_tag_classification_logs(organization_id, conversation_id, created_at desc);

alter publication supabase_realtime add table public.conversation_smart_tags;
alter publication supabase_realtime add table public.smart_tag_classification_logs;
