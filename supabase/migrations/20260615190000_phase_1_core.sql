create extension if not exists "pgcrypto";

create type public.organization_role as enum ('owner', 'admin', 'member');
create type public.lead_status as enum ('new', 'qualified', 'won', 'lost');
create type public.conversation_channel as enum ('whatsapp', 'webchat');
create type public.message_direction as enum ('inbound', 'outbound');
create type public.message_sender_type as enum ('contact', 'user', 'assistant', 'system');
create type public.automation_trigger_type as enum ('new_lead', 'new_tag', 'inactivity');
create type public.automation_action_type as enum ('send_message', 'add_tag', 'create_task', 'pause_ai');
create type public.external_tool_kind as enum ('google_sheets', 'http_custom');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.pipelines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  pipeline_id uuid not null references public.pipelines(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  owner_id uuid references auth.users(id) on delete set null,
  full_name text,
  email text,
  phone text,
  location text,
  custom_variables jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null,
  pipeline_id uuid references public.pipelines(id) on delete set null,
  stage_id uuid references public.pipeline_stages(id) on delete set null,
  title text not null check (char_length(title) between 2 and 160),
  status public.lead_status not null default 'new',
  budget numeric(12, 2),
  interest text,
  source text,
  ai_variables jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null,
  channel public.conversation_channel not null,
  external_thread_id text,
  ai_paused boolean not null default false,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  direction public.message_direction not null,
  sender_type public.message_sender_type not null,
  sender_user_id uuid references auth.users(id) on delete set null,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  color text not null default '#0f766e',
  is_ai_generated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.lead_tags (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (lead_id, tag_id)
);

create table public.ai_assistants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  prompt text not null,
  rules jsonb not null default '[]'::jsonb,
  goals jsonb not null default '[]'::jsonb,
  tone text not null default 'professional',
  fallback_message text not null default 'Un asesor del equipo va a ayudarte en breve.',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  trigger_type public.automation_trigger_type not null,
  config jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.automation_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rule_id uuid not null references public.automation_rules(id) on delete cascade,
  action_type public.automation_action_type not null,
  config jsonb not null default '{}'::jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.external_tools (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  kind public.external_tool_kind not null,
  config jsonb not null default '{}'::jsonb,
  secret_ref text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.current_user_org_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id
  from public.organization_members
  where user_id = auth.uid();
$$;

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.can_create_first_owner(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select not exists (
    select 1
    from public.organization_members
    where organization_id = org_id
  );
$$;

create trigger touch_organizations_updated_at before update on public.organizations for each row execute function public.touch_updated_at();
create trigger touch_pipelines_updated_at before update on public.pipelines for each row execute function public.touch_updated_at();
create trigger touch_pipeline_stages_updated_at before update on public.pipeline_stages for each row execute function public.touch_updated_at();
create trigger touch_contacts_updated_at before update on public.contacts for each row execute function public.touch_updated_at();
create trigger touch_leads_updated_at before update on public.leads for each row execute function public.touch_updated_at();
create trigger touch_conversations_updated_at before update on public.conversations for each row execute function public.touch_updated_at();
create trigger touch_tags_updated_at before update on public.tags for each row execute function public.touch_updated_at();
create trigger touch_ai_assistants_updated_at before update on public.ai_assistants for each row execute function public.touch_updated_at();
create trigger touch_automation_rules_updated_at before update on public.automation_rules for each row execute function public.touch_updated_at();
create trigger touch_external_tools_updated_at before update on public.external_tools for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.pipelines enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.contacts enable row level security;
alter table public.leads enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.tags enable row level security;
alter table public.lead_tags enable row level security;
alter table public.ai_assistants enable row level security;
alter table public.automation_rules enable row level security;
alter table public.automation_actions enable row level security;
alter table public.external_tools enable row level security;
alter table public.audit_logs enable row level security;

create policy "Users can read their profile" on public.profiles for select using (id = auth.uid());
create policy "Users can update their profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "Authenticated users can create organizations" on public.organizations for insert with check (auth.uid() is not null);
create policy "Members can read organizations" on public.organizations for select using (public.is_org_member(id));
create policy "Admins can update organizations" on public.organizations for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));

create policy "Members can read memberships" on public.organization_members for select using (public.is_org_member(organization_id));
create policy "Create first owner membership" on public.organization_members for insert with check (
  user_id = auth.uid()
  and role = 'owner'
  and public.can_create_first_owner(organization_id)
);
create policy "Admins can manage memberships" on public.organization_members for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));

create policy "Tenant read pipelines" on public.pipelines for select using (public.is_org_member(organization_id));
create policy "Tenant write pipelines" on public.pipelines for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy "Tenant read pipeline stages" on public.pipeline_stages for select using (public.is_org_member(organization_id));
create policy "Tenant write pipeline stages" on public.pipeline_stages for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy "Tenant read contacts" on public.contacts for select using (public.is_org_member(organization_id));
create policy "Tenant write contacts" on public.contacts for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "Tenant read leads" on public.leads for select using (public.is_org_member(organization_id));
create policy "Tenant write leads" on public.leads for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "Tenant read conversations" on public.conversations for select using (public.is_org_member(organization_id));
create policy "Tenant write conversations" on public.conversations for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "Tenant read messages" on public.messages for select using (public.is_org_member(organization_id));
create policy "Tenant write messages" on public.messages for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "Tenant read tags" on public.tags for select using (public.is_org_member(organization_id));
create policy "Tenant write tags" on public.tags for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "Tenant read lead tags" on public.lead_tags for select using (public.is_org_member(organization_id));
create policy "Tenant write lead tags" on public.lead_tags for all using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "Tenant read assistants" on public.ai_assistants for select using (public.is_org_member(organization_id));
create policy "Tenant write assistants" on public.ai_assistants for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy "Tenant read automation rules" on public.automation_rules for select using (public.is_org_member(organization_id));
create policy "Tenant write automation rules" on public.automation_rules for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy "Tenant read automation actions" on public.automation_actions for select using (public.is_org_member(organization_id));
create policy "Tenant write automation actions" on public.automation_actions for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy "Tenant read external tools" on public.external_tools for select using (public.is_org_member(organization_id));
create policy "Tenant write external tools" on public.external_tools for all using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy "Tenant read audit logs" on public.audit_logs for select using (public.is_org_member(organization_id));
create policy "Tenant write audit logs" on public.audit_logs for insert with check (public.is_org_member(organization_id));

create index organization_members_user_id_idx on public.organization_members(user_id);
create index organization_members_organization_id_idx on public.organization_members(organization_id);
create index contacts_organization_id_idx on public.contacts(organization_id);
create index leads_organization_id_idx on public.leads(organization_id);
create index conversations_organization_id_idx on public.conversations(organization_id);
create index messages_organization_id_idx on public.messages(organization_id);
create index messages_conversation_id_idx on public.messages(conversation_id);
create index tags_organization_id_idx on public.tags(organization_id);
create index audit_logs_organization_id_idx on public.audit_logs(organization_id);

insert into storage.buckets (id, name, public)
values ('crm-pro-ai-assets', 'crm-pro-ai-assets', false)
on conflict (id) do nothing;
