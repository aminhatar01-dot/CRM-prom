alter table public.ai_assistants
  add column if not exists description text,
  add column if not exists objective text,
  add column if not exists active boolean not null default true,
  add column if not exists channel_id text,
  add column if not exists auto_reply_enabled boolean not null default false;

update public.ai_assistants
set active = enabled
where active is distinct from enabled;

create table public.ai_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assistant_id uuid references public.ai_assistants(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  provider text not null default 'openai',
  model text,
  mode text not null default 'demo',
  input jsonb not null default '{}'::jsonb,
  output text,
  status text not null default 'success',
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ai_assistant_tests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assistant_id uuid not null references public.ai_assistants(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  input text not null,
  output text,
  status text not null default 'success',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger touch_ai_logs_updated_at
  before update on public.ai_logs
  for each row execute function public.touch_updated_at();

create trigger touch_ai_assistant_tests_updated_at
  before update on public.ai_assistant_tests
  for each row execute function public.touch_updated_at();

alter table public.ai_logs enable row level security;
alter table public.ai_assistant_tests enable row level security;

create policy "Tenant read ai logs" on public.ai_logs
  for select using (public.is_org_member(organization_id));

create policy "Tenant insert ai logs" on public.ai_logs
  for insert with check (public.is_org_member(organization_id));

create policy "Tenant read assistant tests" on public.ai_assistant_tests
  for select using (public.is_org_member(organization_id));

create policy "Tenant insert assistant tests" on public.ai_assistant_tests
  for insert with check (public.is_org_member(organization_id));

create policy "Tenant update assistant tests" on public.ai_assistant_tests
  for update using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create index ai_assistants_org_active_idx on public.ai_assistants(organization_id, active);
create index ai_logs_org_created_idx on public.ai_logs(organization_id, created_at desc);
create index ai_logs_conversation_idx on public.ai_logs(organization_id, conversation_id, created_at desc);
create index ai_assistant_tests_org_created_idx on public.ai_assistant_tests(organization_id, created_at desc);

alter publication supabase_realtime add table public.ai_logs;
