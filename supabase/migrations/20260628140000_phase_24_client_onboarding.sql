create table public.organization_onboarding (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  business_name text not null check (char_length(business_name) between 2 and 160),
  industry text not null default '' check (char_length(industry) <= 120),
  business_description text not null default '' check (char_length(business_description) <= 2000),
  country text not null default '' check (char_length(country) <= 100),
  currency text not null default 'ARS' check (currency ~ '^[A-Z]{3}$'),
  business_hours text not null default '' check (char_length(business_hours) <= 1000),
  crm_goal text not null default '' check (char_length(crm_goal) <= 1000),
  use_cases text[] not null default '{}'::text[],
  response_style jsonb not null default '{}'::jsonb check (jsonb_typeof(response_style) = 'object'),
  selected_templates text[] not null default '{}'::text[],
  automation_preferences jsonb not null default '{}'::jsonb check (jsonb_typeof(automation_preferences) = 'object'),
  test_completed boolean not null default false,
  test_result jsonb not null default '{}'::jsonb check (jsonb_typeof(test_result) = 'object'),
  current_step integer not null default 1 check (current_step between 1 and 9),
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organization_onboarding_set_updated_at
before update on public.organization_onboarding
for each row execute function public.touch_updated_at();

alter table public.organization_onboarding enable row level security;

create policy "Tenant read onboarding"
on public.organization_onboarding for select
using (public.is_org_member(organization_id));

create policy "Tenant create onboarding"
on public.organization_onboarding for insert
with check (public.is_org_admin(organization_id));

create policy "Tenant update onboarding"
on public.organization_onboarding for update
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

grant select, insert, update on public.organization_onboarding to authenticated;
grant all on public.organization_onboarding to service_role;

insert into public.organization_onboarding (organization_id, business_name, created_by)
select organizations.id, organizations.name, members.user_id
from public.organizations
join lateral (
  select user_id from public.organization_members
  where organization_id = organizations.id and role = 'owner'
  order by created_at asc limit 1
) members on true
on conflict (organization_id) do nothing;

comment on table public.organization_onboarding is
  'Tenant-private progress and preferences for the Phase 24 guided setup wizard.';

