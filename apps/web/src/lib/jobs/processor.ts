import type { SupabaseClient } from "@supabase/supabase-js";
import { logEvent } from "../observability/event-log";
import type { JobRow } from "./queue";
import { getJobHandler } from "./handlers";

export type ProcessorResult = {
  jobId: string;
  jobType: string;
  status: "completed" | "failed" | "dead_letter" | "no_handler";
  durationMs: number;
  error?: string;
};

const BACKOFF_SECONDS: Record<number, number> = {
  1: 60,
  2: 300,
  3: 900,
};

function backoffSeconds(attempt: number): number {
  return BACKOFF_SECONDS[attempt] ?? 1800;
}

export async function processNextJob(
  supabase: SupabaseClient,
  workerId: string,
  jobTypes?: string[],
): Promise<ProcessorResult | null> {
  const { data: jobs, error: claimError } = await supabase.rpc("claim_next_job", {
    p_worker_id:             workerId,
    p_job_types:             jobTypes ?? null,
    p_lock_timeout_minutes:  5,
  });

  if (claimError || !jobs || (jobs as unknown[]).length === 0) return null;

  const job = (jobs as JobRow[])[0]!;
  const start = Date.now();

  const handler = getJobHandler(job.job_type);
  if (!handler) {
    await supabase.rpc("fail_job", {
      p_job_id:                    job.id,
      p_error_message:             `No handler registered for job type: ${job.job_type}`,
      p_reschedule_delay_seconds:  0,
    });
    return {
      jobId:      job.id,
      jobType:    job.job_type,
      status:     "no_handler",
      durationMs: Date.now() - start,
      error:      `No handler for ${job.job_type}`,
    };
  }

  try {
    const result = await handler(job);

    if (result.success) {
      await supabase.rpc("complete_job", {
        p_job_id:  job.id,
        p_result:  result.result ?? null,
      });

      await logEvent(supabase, {
        eventType:      "job_completed",
        source:         "job",
        severity:       "info",
        message:        `Job ${job.job_type} completed`,
        organizationId: job.organization_id ?? undefined,
        entityType:     "job_queue",
        entityId:       job.id,
        metadata:       { job_type: job.job_type, attempts: job.attempts, duration_ms: Date.now() - start },
      });

      return {
        jobId:      job.id,
        jobType:    job.job_type,
        status:     "completed",
        durationMs: Date.now() - start,
      };
    }

    throw new Error(result.error ?? "Handler returned failure");
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message.slice(0, 500) : "Unknown error";
    const delay = backoffSeconds(job.attempts);

    const { data: nextStatus } = await supabase.rpc("fail_job", {
      p_job_id:                    job.id,
      p_error_message:             errorMsg,
      p_reschedule_delay_seconds:  delay,
    });

    await logEvent(supabase, {
      eventType:      "job_failed",
      source:         "job",
      severity:       nextStatus === "dead_letter" ? "error" : "warning",
      message:        `Job ${job.job_type} failed (attempt ${job.attempts}): ${errorMsg}`,
      organizationId: job.organization_id ?? undefined,
      entityType:     "job_queue",
      entityId:       job.id,
      metadata:       { job_type: job.job_type, attempts: job.attempts, next_status: nextStatus },
    });

    return {
      jobId:      job.id,
      jobType:    job.job_type,
      status:     (nextStatus as string) === "dead_letter" ? "dead_letter" : "failed",
      durationMs: Date.now() - start,
      error:      errorMsg,
    };
  }
}

export async function processBatch(
  supabase: SupabaseClient,
  options: { maxJobs?: number; jobTypes?: string[] } = {},
): Promise<ProcessorResult[]> {
  const workerId = `worker-${crypto.randomUUID()}`;
  const maxJobs = options.maxJobs ?? 10;
  const results: ProcessorResult[] = [];

  for (let i = 0; i < maxJobs; i++) {
    const result = await processNextJob(supabase, workerId, options.jobTypes);
    if (!result) break;
    results.push(result);
  }

  return results;
}
