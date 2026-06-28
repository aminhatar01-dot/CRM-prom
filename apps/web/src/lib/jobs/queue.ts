import type { SupabaseClient } from "@supabase/supabase-js";

export type JobStatus = "pending" | "running" | "completed" | "failed" | "dead_letter" | "cancelled";

export const JOB_TYPES = {
  AUTOMATION_DISPATCH:        "automation_dispatch",
  INTEGRATION_SYNC:           "integration_sync",
  REFRESH_INTEGRATION_TOKEN:  "refresh_integration_token",
  EXECUTE_INTEGRATION_TOOL:   "execute_integration_tool",
  WEBHOOK_PROCESS:            "webhook_process",
  KNOWLEDGE_IMPORT:           "knowledge_import",
  QUOTE_GENERATE:             "quote_generate",
  NOTIFICATION_DELIVER:       "notification_deliver",
  SCHEDULED_TASK:             "scheduled_task",
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES];

export type JobRow = {
  id: string;
  organization_id: string | null;
  job_type: string;
  status: JobStatus;
  payload: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  error_message: string | null;
  idempotency_key: string | null;
  locked_at: string | null;
  locked_by: string | null;
  priority: number;
  correlation_id: string | null;
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type EnqueueParams = {
  jobType: JobType | string;
  payload?: Record<string, unknown>;
  organizationId?: string | null;
  scheduledAt?: Date;
  idempotencyKey?: string;
  maxAttempts?: number;
  priority?: number;
  correlationId?: string;
};

export async function enqueueJob(
  supabase: SupabaseClient,
  params: EnqueueParams,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("enqueue_job", {
    p_job_type:        params.jobType,
    p_payload:         params.payload ?? {},
    p_organization_id: params.organizationId ?? null,
    p_scheduled_at:    (params.scheduledAt ?? new Date()).toISOString(),
    p_idempotency_key: params.idempotencyKey ?? null,
    p_max_attempts:    params.maxAttempts ?? 3,
    p_priority:        params.priority ?? 5,
    p_correlation_id:  params.correlationId ?? null,
  });
  if (error) throw error;
  return data as string | null;
}

export async function getJobQueueStats(supabase: SupabaseClient, organizationId?: string) {
  let query = supabase
    .from("job_queue")
    .select("status", { count: "exact", head: false });

  if (organizationId) query = query.eq("organization_id", organizationId);

  const { data } = await query;
  const rows = (data ?? []) as { status: string }[];

  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
  }
  return {
    pending:     counts["pending"]     ?? 0,
    running:     counts["running"]     ?? 0,
    completed:   counts["completed"]   ?? 0,
    failed:      counts["failed"]      ?? 0,
    dead_letter: counts["dead_letter"] ?? 0,
    cancelled:   counts["cancelled"]   ?? 0,
  };
}

export async function listDeadLetterJobs(
  supabase: SupabaseClient,
  organizationId?: string,
  limit = 50,
): Promise<JobRow[]> {
  let query = supabase
    .from("job_queue")
    .select("*")
    .eq("status", "dead_letter")
    .order("failed_at", { ascending: false })
    .limit(limit);

  if (organizationId) query = query.eq("organization_id", organizationId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as JobRow[];
}

export async function retryDeadLetterJob(
  supabase: SupabaseClient,
  jobId: string,
  organizationId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("retry_dead_letter_job", {
    p_job_id:         jobId,
    p_organization_id: organizationId,
  });
  if (error) throw error;
  return data === true;
}

export async function cancelJob(
  supabase: SupabaseClient,
  jobId: string,
  organizationId: string,
): Promise<boolean> {
  const { error, count } = await supabase
    .from("job_queue")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("organization_id", organizationId)
    .in("status", ["pending", "dead_letter"]);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export function makeJobIdempotencyKey(parts: string[]): string {
  return [crypto.randomUUID(), ...parts].join(":");
}
