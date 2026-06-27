alter table public.knowledge_documents
  drop constraint if exists knowledge_documents_source_type_check;

alter table public.knowledge_documents
  add constraint knowledge_documents_source_type_check
  check (source_type in ('manual', 'csv', 'xlsx', 'pdf', 'docx', 'txt', 'google_sheets', 'url'));

create table public.knowledge_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  source_type text not null check (source_type in ('csv', 'xlsx', 'pdf', 'docx', 'txt', 'google_sheets', 'url')),
  name text not null check (char_length(name) between 2 and 160),
  source_url text,
  original_file_name text,
  storage_path text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes between 1 and 10485760),
  column_mapping jsonb not null default '{}'::jsonb check (jsonb_typeof(column_mapping) = 'object'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  status text not null default 'pending' check (status in ('pending', 'processing', 'indexed', 'error')),
  error_message text,
  document_count integer not null default 0 check (document_count >= 0),
  chunk_count integer not null default 0 check (chunk_count >= 0),
  last_imported_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.knowledge_documents
  add column if not exists import_id uuid references public.knowledge_imports(id) on delete set null,
  add column if not exists source_url text,
  add column if not exists source_metadata jsonb not null default '{}'::jsonb;

create index knowledge_imports_org_status_idx
  on public.knowledge_imports(organization_id, status, updated_at desc)
  where archived_at is null;
create index knowledge_documents_import_idx
  on public.knowledge_documents(organization_id, import_id)
  where import_id is not null;

create trigger knowledge_imports_set_updated_at
before update on public.knowledge_imports
for each row execute function public.touch_updated_at();

create or replace function public.validate_knowledge_document_import_tenant()
returns trigger
language plpgsql
as $$
begin
  if new.import_id is not null and not exists (
    select 1 from public.knowledge_imports
    where id = new.import_id and organization_id = new.organization_id
  ) then
    raise exception 'import_id must belong to the same organization';
  end if;
  return new;
end;
$$;

create trigger validate_knowledge_document_import_tenant
before insert or update on public.knowledge_documents
for each row execute function public.validate_knowledge_document_import_tenant();

alter table public.knowledge_imports enable row level security;

create policy "Tenant read knowledge imports"
on public.knowledge_imports for select
using (public.is_org_member(organization_id));

create policy "Tenant manage knowledge imports"
on public.knowledge_imports for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

grant select, insert, update, delete on table public.knowledge_imports to authenticated;
grant all on table public.knowledge_imports to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'knowledge-imports',
  'knowledge-imports',
  false,
  10485760,
  array[
    'text/csv', 'text/plain',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

update public.ai_assistants
set agent_config = agent_config || jsonb_build_object(
  'primary_intent', coalesce(nullif(agent_config->>'primary_intent', ''), 'general'),
  'topics', coalesce(agent_config->'topics', '[]'::jsonb),
  'excluded_topics', coalesce(agent_config->'excluded_topics', '[]'::jsonb),
  'knowledge_categories', coalesce(agent_config->'knowledge_categories', '[]'::jsonb),
  'routing_priority', coalesce(agent_config->'routing_priority', '50'::jsonb),
  'is_default', coalesce(agent_config->'is_default', 'false'::jsonb)
);
