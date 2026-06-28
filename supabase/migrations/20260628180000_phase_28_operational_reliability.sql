-- Phase 28: Operational Reliability
-- Creates: job_queue, event_logs, rate_limit_buckets
-- Functions: enqueue_job, claim_next_job, complete_job, fail_job, retry_dead_letter_job, check_rate_limit, log_event

-- ─── job_queue ────────────────────────────────────────────────────────────────

create table public.job_queue (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  job_type text not null check (char_length(job_type) between 1 and 120),
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'failed', 'dead_letter', 'cancelled')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  scheduled_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  failed_at timestamptz,
  error_message text check (char_length(error_message) <= 5000),
  idempotency_key text check (char_length(idempotency_key) <= 200),
  locked_at timestamptz,
  locked_by text check (char_length(locked_by) <= 200),
  priority integer not null default 5 check (priority between 1 and 10),
  correlation_id uuid,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index job_queue_idempotency_idx
  on public.job_queue (organization_id, job_type, idempotency_key)
  where idempotency_key is not null and status not in ('completed', 'cancelled');

create index job_queue_pending_idx
  on public.job_queue (status, scheduled_at, priority desc)
  where status = 'pending';

create index job_queue_org_idx
  on public.job_queue (organization_id, status, created_at desc)
  where organization_id is not null;

create index job_queue_stale_lock_idx
  on public.job_queue (locked_at)
  where status = 'running' and locked_at is not null;

create trigger job_queue_set_updated_at
before update on public.job_queue
for each row execute function public.touch_updated_at();

alter table public.job_queue enable row level security;

create policy "Tenant read own jobs"
on public.job_queue for select
using (organization_id is null or public.is_org_member(organization_id));

create policy "Service manage jobs"
on public.job_queue for all
using (true)
with check (true);

grant select on public.job_queue to authenticated;
grant all on public.job_queue to service_role;

comment on table public.job_queue is
  'Multi-tenant async job queue with retry, DLQ and idempotency. Workers claim via claim_next_job().';

-- ─── event_logs (unified observability) ──────────────────────────────────────

create table public.event_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  correlation_id uuid,
  event_type text not null check (char_length(event_type) between 1 and 120),
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'error', 'critical')),
  source text not null default 'system'
    check (source in ('whatsapp', 'ai', 'integration', 'automation', 'knowledge', 'quote', 'billing', 'job', 'system', 'webhook', 'auth')),
  message text not null default '' check (char_length(message) <= 5000),
  entity_type text check (char_length(entity_type) <= 80),
  entity_id uuid,
  job_id uuid references public.job_queue(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index event_logs_org_created_idx
  on public.event_logs (organization_id, created_at desc)
  where organization_id is not null;

create index event_logs_severity_idx
  on public.event_logs (severity, created_at desc)
  where severity in ('error', 'critical');

create index event_logs_correlation_idx
  on public.event_logs (correlation_id)
  where correlation_id is not null;

create index event_logs_source_idx
  on public.event_logs (source, created_at desc);

alter table public.event_logs enable row level security;

create policy "Tenant read own event logs"
on public.event_logs for select
using (organization_id is null or public.is_org_member(organization_id));

create policy "Service insert event logs"
on public.event_logs for insert
with check (true);

grant select on public.event_logs to authenticated;
grant insert, select on public.event_logs to service_role;

comment on table public.event_logs is
  'Unified append-only observability log. Never updated. Pruning policy should be applied after 90 days.';

-- ─── rate_limit_buckets (distributed rate limiting) ───────────────────────────

create table public.rate_limit_buckets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bucket_key text not null check (char_length(bucket_key) between 1 and 120),
  count integer not null default 0 check (count >= 0),
  reset_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (organization_id, bucket_key)
);

create index rate_limit_buckets_org_idx on public.rate_limit_buckets (organization_id, bucket_key);

alter table public.rate_limit_buckets enable row level security;

create policy "Service manage rate limits"
on public.rate_limit_buckets for all
using (true)
with check (true);

grant all on public.rate_limit_buckets to service_role;

comment on table public.rate_limit_buckets is
  'Distributed rate limit counters per org per bucket. Use check_rate_limit() for atomic check+increment.';

-- ─── enqueue_job ─────────────────────────────────────────────────────────────

create or replace function public.enqueue_job(
  p_job_type text,
  p_payload jsonb default '{}'::jsonb,
  p_organization_id uuid default null,
  p_scheduled_at timestamptz default now(),
  p_idempotency_key text default null,
  p_max_attempts integer default 3,
  p_priority integer default 5,
  p_correlation_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
begin
  insert into public.job_queue (
    organization_id, job_type, payload, scheduled_at,
    idempotency_key, max_attempts, priority, correlation_id
  )
  values (
    p_organization_id, p_job_type, p_payload, p_scheduled_at,
    p_idempotency_key, p_max_attempts, p_priority, p_correlation_id
  )
  on conflict (organization_id, job_type, idempotency_key)
  where idempotency_key is not null and status not in ('completed', 'cancelled')
  do nothing
  returning id into v_job_id;

  return v_job_id; -- null if idempotency conflict (already enqueued)
end;
$$;

grant execute on function public.enqueue_job(text, jsonb, uuid, timestamptz, text, integer, integer, uuid) to service_role;

-- ─── claim_next_job ──────────────────────────────────────────────────────────

create or replace function public.claim_next_job(
  p_worker_id text,
  p_job_types text[] default null,
  p_lock_timeout_minutes integer default 5
)
returns setof public.job_queue
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.job_queue
  set
    status     = 'running',
    started_at = now(),
    locked_at  = now(),
    locked_by  = p_worker_id,
    attempts   = attempts + 1,
    updated_at = now()
  where id = (
    select id from public.job_queue
    where
      status = 'pending'
      and scheduled_at <= now()
      and (p_job_types is null or job_type = any(p_job_types))
    union all
    -- reclaim stale running jobs (lock expired)
    select id from public.job_queue
    where
      status = 'running'
      and locked_at < now() - (p_lock_timeout_minutes || ' minutes')::interval
      and (p_job_types is null or job_type = any(p_job_types))
    order by priority desc, scheduled_at asc
    limit 1
    for update skip locked
  )
  returning *;
end;
$$;

grant execute on function public.claim_next_job(text, text[], integer) to service_role;

-- ─── complete_job ─────────────────────────────────────────────────────────────

create or replace function public.complete_job(
  p_job_id uuid,
  p_result jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.job_queue
  set
    status       = 'completed',
    completed_at = now(),
    locked_at    = null,
    locked_by    = null,
    result       = p_result,
    updated_at   = now()
  where id = p_job_id and status = 'running';
end;
$$;

grant execute on function public.complete_job(uuid, jsonb) to service_role;

-- ─── fail_job ─────────────────────────────────────────────────────────────────

create or replace function public.fail_job(
  p_job_id uuid,
  p_error_message text,
  p_reschedule_delay_seconds integer default 60
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job record;
  v_next_status text;
begin
  select id, attempts, max_attempts
  into v_job
  from public.job_queue
  where id = p_job_id and status = 'running'
  for update;

  if not found then
    return 'not_found';
  end if;

  if v_job.attempts >= v_job.max_attempts then
    v_next_status := 'dead_letter';
  else
    v_next_status := 'pending';
  end if;

  update public.job_queue
  set
    status        = v_next_status,
    error_message = p_error_message,
    failed_at     = now(),
    locked_at     = null,
    locked_by     = null,
    scheduled_at  = case when v_next_status = 'pending'
                    then now() + (p_reschedule_delay_seconds || ' seconds')::interval
                    else scheduled_at end,
    updated_at    = now()
  where id = p_job_id;

  return v_next_status;
end;
$$;

grant execute on function public.fail_job(uuid, text, integer) to service_role;

-- ─── retry_dead_letter_job ────────────────────────────────────────────────────

create or replace function public.retry_dead_letter_job(
  p_job_id uuid,
  p_organization_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.job_queue
  set
    status        = 'pending',
    attempts      = 0,
    error_message = null,
    scheduled_at  = now(),
    locked_at     = null,
    locked_by     = null,
    updated_at    = now()
  where id = p_job_id
    and (organization_id = p_organization_id or organization_id is null)
    and status = 'dead_letter';

  return found;
end;
$$;

grant execute on function public.retry_dead_letter_job(uuid, uuid) to service_role;

-- ─── check_rate_limit ────────────────────────────────────────────────────────

create or replace function public.check_rate_limit(
  p_organization_id uuid,
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer default 60
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_reset_at timestamptz;
begin
  v_reset_at := now() + (p_window_seconds || ' seconds')::interval;

  insert into public.rate_limit_buckets (organization_id, bucket_key, count, reset_at)
  values (p_organization_id, p_bucket_key, 1, v_reset_at)
  on conflict (organization_id, bucket_key) do update
    set count    = case when rate_limit_buckets.reset_at <= now() then 1
                   else rate_limit_buckets.count + 1 end,
        reset_at = case when rate_limit_buckets.reset_at <= now() then v_reset_at
                   else rate_limit_buckets.reset_at end
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

grant execute on function public.check_rate_limit(uuid, text, integer, integer) to service_role;

-- ─── log_event helper ────────────────────────────────────────────────────────

create or replace function public.log_event(
  p_event_type text,
  p_source text default 'system',
  p_severity text default 'info',
  p_message text default '',
  p_organization_id uuid default null,
  p_correlation_id uuid default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_job_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.event_logs (
    organization_id, correlation_id, event_type, severity, source,
    message, entity_type, entity_id, job_id, metadata
  )
  values (
    p_organization_id, p_correlation_id, p_event_type, p_severity, p_source,
    p_message, p_entity_type, p_entity_id, p_job_id, p_metadata
  )
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.log_event(text, text, text, text, uuid, uuid, text, uuid, uuid, jsonb) to service_role;
