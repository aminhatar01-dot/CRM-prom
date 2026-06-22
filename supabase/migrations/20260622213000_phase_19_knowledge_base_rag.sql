create extension if not exists vector with schema extensions;

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 160),
  content text not null check (char_length(content) between 20 and 100000),
  category text not null default 'general' check (char_length(category) between 2 and 80),
  active boolean not null default true,
  source_type text not null default 'manual'
    check (source_type in ('manual', 'pdf', 'docx', 'txt')),
  source_file_name text,
  storage_path text,
  indexing_status text not null default 'pending'
    check (indexing_status in ('pending', 'indexing', 'indexed', 'failed')),
  indexing_error text,
  content_hash text,
  chunk_count integer not null default 0 check (chunk_count >= 0),
  embedding_model text,
  indexed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (char_length(content) between 1 and 8000),
  token_estimate integer not null default 0 check (token_estimate >= 0),
  metadata jsonb not null default '{}'::jsonb,
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index knowledge_documents_org_status_idx
  on public.knowledge_documents(organization_id, active, indexing_status, updated_at desc)
  where archived_at is null;

create index knowledge_chunks_org_document_idx
  on public.knowledge_chunks(organization_id, document_id, chunk_index);

create index knowledge_chunks_embedding_idx
  on public.knowledge_chunks using hnsw (embedding extensions.vector_cosine_ops);

create trigger knowledge_documents_set_updated_at
before update on public.knowledge_documents
for each row execute function public.touch_updated_at();

create trigger knowledge_chunks_set_updated_at
before update on public.knowledge_chunks
for each row execute function public.touch_updated_at();

create or replace function public.validate_knowledge_chunk_tenant()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.knowledge_documents
    where id = new.document_id
      and organization_id = new.organization_id
  ) then
    raise exception 'document_id must belong to the same organization';
  end if;
  return new;
end;
$$;

create trigger validate_knowledge_chunks_tenant
before insert or update on public.knowledge_chunks
for each row execute function public.validate_knowledge_chunk_tenant();

alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;

create policy "Tenant read knowledge documents"
on public.knowledge_documents for select
using (public.is_org_member(organization_id));

create policy "Tenant manage knowledge documents"
on public.knowledge_documents for all
using (public.is_org_admin(organization_id))
with check (public.is_org_admin(organization_id));

create policy "Service role manages knowledge chunks"
on public.knowledge_chunks for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

revoke all on table public.knowledge_chunks from anon, authenticated;
grant select, insert, update, delete on table public.knowledge_documents to authenticated;
grant all on table public.knowledge_documents to service_role;
grant all on table public.knowledge_chunks to service_role;

create or replace function public.match_knowledge_chunks(
  p_organization_id uuid,
  p_query_embedding extensions.vector(1536),
  p_match_count integer default 5,
  p_min_similarity double precision default 0.35
)
returns table (
  chunk_id uuid,
  document_id uuid,
  title text,
  category text,
  content text,
  similarity double precision
)
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'server-side knowledge search required';
  end if;

  return query
  select
    chunk.id,
    document.id,
    document.title,
    document.category,
    chunk.content,
    (1 - (chunk.embedding <=> p_query_embedding))::double precision as similarity
  from public.knowledge_chunks as chunk
  join public.knowledge_documents as document
    on document.id = chunk.document_id
   and document.organization_id = chunk.organization_id
  where chunk.organization_id = p_organization_id
    and document.active = true
    and document.archived_at is null
    and document.indexing_status = 'indexed'
    and (1 - (chunk.embedding <=> p_query_embedding)) >= p_min_similarity
  order by chunk.embedding <=> p_query_embedding
  limit greatest(1, least(p_match_count, 10));
end;
$$;

revoke all on function public.match_knowledge_chunks(uuid, extensions.vector, integer, double precision)
  from public, anon, authenticated;
grant execute on function public.match_knowledge_chunks(uuid, extensions.vector, integer, double precision)
  to service_role;

