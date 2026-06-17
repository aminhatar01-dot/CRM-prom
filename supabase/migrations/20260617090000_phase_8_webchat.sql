create table public.webchat_widgets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  public_token text not null unique default ('wchat_' || replace(gen_random_uuid()::text, '-', '')),
  primary_color text not null default '#0f766e',
  initial_message text not null default 'Hola, somos CRM PRO AI. Como podemos ayudarte?',
  position text not null default 'bottom-right' check (position in ('bottom-right', 'bottom-left')),
  active boolean not null default false,
  allowed_domains text[] not null default array['localhost', '127.0.0.1'],
  assistant_id uuid references public.ai_assistants(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.conversations
  add column if not exists webchat_widget_id uuid references public.webchat_widgets(id) on delete set null;

create trigger touch_webchat_widgets_updated_at
  before update on public.webchat_widgets
  for each row execute function public.touch_updated_at();

alter table public.webchat_widgets enable row level security;

create policy "Tenant read webchat widgets" on public.webchat_widgets
  for select using (public.is_org_member(organization_id));

create policy "Tenant manage webchat widgets" on public.webchat_widgets
  for all using (public.is_org_admin(organization_id))
  with check (public.is_org_admin(organization_id));

create or replace function public.enforce_webchat_tenant_integrity()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'webchat_widgets' and new.assistant_id is not null and not exists (
    select 1 from public.ai_assistants
    where id = new.assistant_id
      and organization_id = new.organization_id
  ) then
    raise exception 'assistant_id must belong to the same organization';
  end if;

  if tg_table_name = 'conversations' and new.webchat_widget_id is not null and not exists (
    select 1 from public.webchat_widgets
    where id = new.webchat_widget_id
      and organization_id = new.organization_id
  ) then
    raise exception 'webchat_widget_id must belong to the same organization';
  end if;

  return new;
end;
$$;

create trigger enforce_webchat_widgets_tenant_integrity
  before insert or update on public.webchat_widgets
  for each row execute function public.enforce_webchat_tenant_integrity();

create trigger enforce_conversations_webchat_tenant_integrity
  before insert or update on public.conversations
  for each row execute function public.enforce_webchat_tenant_integrity();

create index webchat_widgets_org_idx on public.webchat_widgets(organization_id);
create index webchat_widgets_public_token_idx on public.webchat_widgets(public_token);
create index conversations_webchat_widget_idx on public.conversations(organization_id, webchat_widget_id);

alter publication supabase_realtime add table public.webchat_widgets;
