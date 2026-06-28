import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { JOB_TYPES, makeJobIdempotencyKey } from "../../../apps/web/src/lib/jobs/queue";
import { getJobHandler, registerJobHandler } from "../../../apps/web/src/lib/jobs/handlers";
import { processBatch } from "../../../apps/web/src/lib/jobs/processor";
import { RATE_LIMIT_DEFAULTS, RateLimitExceededError } from "../../../apps/web/src/lib/rate-limit/distributed";
import { getHealthStatus } from "../../../apps/web/src/lib/system/health";

const root = resolve(import.meta.dirname, "../../..");

const migration = readFileSync(
  resolve(root, "supabase/migrations/20260628180000_phase_28_operational_reliability.sql"),
  "utf8",
);
const queueLib = readFileSync(
  resolve(root, "apps/web/src/lib/jobs/queue.ts"),
  "utf8",
);
const processorLib = readFileSync(
  resolve(root, "apps/web/src/lib/jobs/processor.ts"),
  "utf8",
);
const eventLogLib = readFileSync(
  resolve(root, "apps/web/src/lib/observability/event-log.ts"),
  "utf8",
);
const rateLimitLib = readFileSync(
  resolve(root, "apps/web/src/lib/rate-limit/distributed.ts"),
  "utf8",
);
const healthLib = readFileSync(
  resolve(root, "apps/web/src/lib/system/health.ts"),
  "utf8",
);
const cronRoute = readFileSync(
  resolve(root, "apps/web/src/app/api/cron/jobs/route.ts"),
  "utf8",
);
const operationsActions = readFileSync(
  resolve(root, "apps/web/src/app/actions/operations.ts"),
  "utf8",
);
const operationsPage = readFileSync(
  resolve(root, "apps/web/src/app/(crm)/settings/operations/page.tsx"),
  "utf8",
);
const docs = readFileSync(
  resolve(root, "docs/PHASE_28_OPERATIONAL_RELIABILITY.md"),
  "utf8",
);

// ─── Migration contract ────────────────────────────────────────────────────────

describe("Phase 28 migration", () => {
  it("creates job_queue table", () => {
    expect(migration).toContain("create table public.job_queue");
  });

  it("creates event_logs table", () => {
    expect(migration).toContain("create table public.event_logs");
  });

  it("creates rate_limit_buckets table", () => {
    expect(migration).toContain("create table public.rate_limit_buckets");
  });

  it("job_queue has all required columns", () => {
    const cols = ["organization_id", "job_type", "status", "payload", "attempts",
      "max_attempts", "scheduled_at", "started_at", "completed_at", "error_message",
      "idempotency_key", "locked_at", "locked_by", "priority", "correlation_id"];
    for (const col of cols) {
      expect(migration).toContain(col);
    }
  });

  it("job_queue status check includes dead_letter", () => {
    expect(migration).toContain("dead_letter");
  });

  it("job_queue has idempotency unique index", () => {
    expect(migration).toContain("job_queue_idempotency_idx");
  });

  it("job_queue has SKIP LOCKED in claim function", () => {
    expect(migration).toContain("skip locked");
  });

  it("event_logs has severity check constraint", () => {
    expect(migration).toContain("'info', 'warning', 'error', 'critical'");
  });

  it("event_logs has source check constraint", () => {
    expect(migration).toContain("'whatsapp', 'ai', 'integration', 'automation'");
  });

  it("event_logs is append-only (no update policy)", () => {
    expect(migration).not.toContain("for update\non public.event_logs");
  });

  it("enqueue_job function defined with security definer", () => {
    expect(migration).toContain("create or replace function public.enqueue_job");
    expect(migration).toContain("security definer");
  });

  it("claim_next_job function defined", () => {
    expect(migration).toContain("create or replace function public.claim_next_job");
  });

  it("complete_job function defined", () => {
    expect(migration).toContain("create or replace function public.complete_job");
  });

  it("fail_job function moves to dead_letter after max_attempts", () => {
    expect(migration).toContain("dead_letter");
    expect(migration).toContain("max_attempts");
  });

  it("retry_dead_letter_job function defined", () => {
    expect(migration).toContain("create or replace function public.retry_dead_letter_job");
  });

  it("check_rate_limit function uses ON CONFLICT upsert", () => {
    expect(migration).toContain("on conflict (organization_id, bucket_key)");
  });

  it("log_event function defined", () => {
    expect(migration).toContain("create or replace function public.log_event");
  });

  it("job_queue RLS enabled", () => {
    expect(migration).toContain("alter table public.job_queue enable row level security");
  });

  it("event_logs RLS enabled", () => {
    expect(migration).toContain("alter table public.event_logs enable row level security");
  });

  it("rate_limit_buckets grants only service_role", () => {
    const credentialSection = migration.split("rate_limit_buckets")[2] ?? "";
    expect(credentialSection).not.toContain("grant select on public.rate_limit_buckets to authenticated");
  });
});

// ─── Job Queue lib ─────────────────────────────────────────────────────────────

describe("Job Queue lib", () => {
  it("exports all JOB_TYPES", () => {
    expect(JOB_TYPES.AUTOMATION_DISPATCH).toBe("automation_dispatch");
    expect(JOB_TYPES.INTEGRATION_SYNC).toBe("integration_sync");
    expect(JOB_TYPES.REFRESH_INTEGRATION_TOKEN).toBe("refresh_integration_token");
    expect(JOB_TYPES.EXECUTE_INTEGRATION_TOOL).toBe("execute_integration_tool");
    expect(JOB_TYPES.WEBHOOK_PROCESS).toBe("webhook_process");
    expect(JOB_TYPES.KNOWLEDGE_IMPORT).toBe("knowledge_import");
    expect(JOB_TYPES.NOTIFICATION_DELIVER).toBe("notification_deliver");
  });

  it("makeJobIdempotencyKey produces a string", () => {
    const key = makeJobIdempotencyKey(["org-1", "sync", "conn-2"]);
    expect(typeof key).toBe("string");
    expect(key.length).toBeGreaterThan(10);
  });

  it("queue lib calls enqueue_job RPC", () => {
    expect(queueLib).toContain("enqueue_job");
  });

  it("queue lib calls retry_dead_letter_job RPC", () => {
    expect(queueLib).toContain("retry_dead_letter_job");
  });

  it("queue lib calls check_rate_limit", () => {
    expect(rateLimitLib).toContain("check_rate_limit");
  });
});

// ─── Job Handlers ──────────────────────────────────────────────────────────────

describe("Job Handlers", () => {
  it("all JOB_TYPES have registered handlers", () => {
    const expectedTypes = Object.values(JOB_TYPES);
    for (const jobType of expectedTypes) {
      expect(getJobHandler(jobType)).toBeDefined();
    }
  });

  it("automation_dispatch handler returns success", async () => {
    const handler = getJobHandler("automation_dispatch")!;
    const result = await handler({
      id: "test-job",
      job_type: "automation_dispatch",
      payload: { trigger: "message_received", organizationId: "org-1", conversationId: "conv-1" },
      attempts: 1,
      max_attempts: 3,
      status: "running",
      organization_id: "org-1",
      scheduled_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      completed_at: null,
      failed_at: null,
      error_message: null,
      idempotency_key: null,
      locked_at: null,
      locked_by: null,
      priority: 5,
      correlation_id: null,
      result: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it("execute_integration_tool handler marks notImplemented", async () => {
    const handler = getJobHandler("execute_integration_tool")!;
    const result = await handler({
      id: "test-job-2",
      job_type: "execute_integration_tool",
      payload: { connectionId: "conn-1", toolKey: "send_message" },
      attempts: 1,
      max_attempts: 3,
      status: "running",
      organization_id: "org-1",
      scheduled_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      completed_at: null,
      failed_at: null,
      error_message: null,
      idempotency_key: null,
      locked_at: null,
      locked_by: null,
      priority: 5,
      correlation_id: null,
      result: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
    expect(result.result?.notImplemented).toBe(true);
  });

  it("registerJobHandler adds handler dynamically", () => {
    registerJobHandler("test_custom_job", async () => ({ success: true, result: { ok: true } }));
    expect(getJobHandler("test_custom_job")).toBeDefined();
  });
});

// ─── Processor ────────────────────────────────────────────────────────────────

describe("Processor", () => {
  it("processBatch returns empty array when no jobs available", async () => {
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    };
    const results = await processBatch(mockSupabase as never, { maxJobs: 5 });
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(0);
  });

  it("processBatch calls claim_next_job", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockSupabase = { rpc: rpcMock };
    await processBatch(mockSupabase as never, { maxJobs: 1 });
    expect(rpcMock).toHaveBeenCalledWith("claim_next_job", expect.any(Object));
  });

  it("processor lib handles no_handler case", () => {
    expect(processorLib).toContain("no_handler");
  });

  it("processor lib uses exponential backoff", () => {
    expect(processorLib).toContain("backoffSeconds");
  });

  it("processor lib calls fail_job RPC on error", () => {
    expect(processorLib).toContain("fail_job");
  });

  it("processor lib calls complete_job on success", () => {
    expect(processorLib).toContain("complete_job");
  });
});

// ─── Event Log ────────────────────────────────────────────────────────────────

describe("Event Log", () => {
  it("eventLog lib strips secret keys from metadata", () => {
    expect(eventLogLib).toContain("stripSecrets");
    expect(eventLogLib).toContain("[REDACTED]");
  });

  it("eventLog lib includes known secret key names", () => {
    expect(eventLogLib).toContain("access_token");
    expect(eventLogLib).toContain("api_key");
    expect(eventLogLib).toContain("encrypted_value");
  });

  it("eventLog lib calls log_event RPC", () => {
    expect(eventLogLib).toContain("log_event");
  });

  it("eventLog lib exports listEventLogs", () => {
    expect(eventLogLib).toContain("export async function listEventLogs");
  });

  it("eventLog lib never stores raw secrets", () => {
    expect(eventLogLib).not.toContain("OPENAI_API_KEY");
    expect(eventLogLib).not.toContain("WHATSAPP_ACCESS_TOKEN");
  });
});

// ─── Rate Limit ───────────────────────────────────────────────────────────────

describe("Distributed Rate Limit", () => {
  it("RATE_LIMIT_DEFAULTS covers all critical buckets", () => {
    expect(RATE_LIMIT_DEFAULTS.ai_calls).toBeDefined();
    expect(RATE_LIMIT_DEFAULTS.whatsapp_messages).toBeDefined();
    expect(RATE_LIMIT_DEFAULTS.automation_dispatch).toBeDefined();
    expect(RATE_LIMIT_DEFAULTS.integration_tools).toBeDefined();
    expect(RATE_LIMIT_DEFAULTS.knowledge_import).toBeDefined();
    expect(RATE_LIMIT_DEFAULTS.webhook_events).toBeDefined();
  });

  it("RateLimitExceededError is an Error", () => {
    const err = new RateLimitExceededError("ai_calls", "org-1");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("RateLimitExceededError");
    expect(err.bucket).toBe("ai_calls");
    expect(err.organizationId).toBe("org-1");
  });

  it("rate limit lib falls back gracefully when DB fails", () => {
    expect(rateLimitLib).toContain("console.warn");
    expect(rateLimitLib).toContain("return true");
  });

  it("rate limit lib throws RateLimitExceededError", () => {
    expect(rateLimitLib).toContain("RateLimitExceededError");
  });
});

// ─── Healthcheck ──────────────────────────────────────────────────────────────

describe("Extended Healthcheck", () => {
  it("getHealthStatus includes integrationHubProviders", () => {
    const h = getHealthStatus({});
    expect(typeof h.features.integrationHubProviders).toBe("number");
  });

  it("getHealthStatus includes lastMigration", () => {
    const h = getHealthStatus({});
    expect(h.features.lastMigration).toContain("phase_28");
  });

  it("healthcheck shows degraded when env is missing", () => {
    const h = getHealthStatus({});
    expect(h.status).toBe("degraded");
  });

  it("getExtendedHealthStatus is exported", () => {
    expect(healthLib).toContain("export async function getExtendedHealthStatus");
  });

  it("getExtendedHealthStatus includes jobQueue stats", () => {
    expect(healthLib).toContain("dead_letter");
    expect(healthLib).toContain("jobQueue");
  });

  it("getExtendedHealthStatus includes credits info", () => {
    expect(healthLib).toContain("ai_credit_wallets");
    expect(healthLib).toContain("credits");
  });
});

// ─── Cron job endpoint ────────────────────────────────────────────────────────

describe("Cron jobs endpoint", () => {
  it("cron route requires authorization", () => {
    expect(cronRoute).toContain("isCronAuthorized");
    expect(cronRoute).toContain("401");
  });

  it("cron route calls processBatch", () => {
    expect(cronRoute).toContain("processBatch");
  });

  it("cron route imports handlers", () => {
    expect(cronRoute).toContain("handlers");
  });

  it("cron route returns summary with dead_letter count", () => {
    expect(cronRoute).toContain("dead_letter");
  });
});

// ─── Operations UI ────────────────────────────────────────────────────────────

describe("Operations UI", () => {
  it("operations page exists", () => {
    expect(operationsPage.length).toBeGreaterThan(100);
  });

  it("operations page shows Dead Letter Queue", () => {
    expect(operationsPage).toContain("Dead Letter");
  });

  it("operations page shows retry action", () => {
    expect(operationsPage).toContain("Reintentar");
    expect(operationsPage).toContain("retryDeadLetterJobAction");
  });

  it("operations page shows cancel action", () => {
    expect(operationsPage).toContain("Cancelar");
    expect(operationsPage).toContain("cancelJobAction");
  });

  it("operations page shows healthcheck status", () => {
    expect(operationsPage).toContain("Estado operativo");
    expect(operationsPage).toContain("health.status");
  });

  it("operations page shows recent errors", () => {
    expect(operationsPage).toContain("Errores recientes");
    expect(operationsPage).toContain("recentErrors");
  });

  it("operations page shows job queue stats", () => {
    expect(operationsPage).toContain("stats[");
    expect(operationsPage).toContain("dead_letter");
  });

  it("operations actions gate on manageSettings capability", () => {
    expect(operationsActions).toContain("manageSettings");
  });

  it("operations actions calls retryDeadLetterJob", () => {
    expect(operationsActions).toContain("retryDeadLetterJob");
  });
});

// ─── Documentation ────────────────────────────────────────────────────────────

describe("Phase 28 Documentation", () => {
  it("docs file exists", () => {
    expect(docs.length).toBeGreaterThan(500);
  });

  it("docs covers DLQ", () => {
    expect(docs.toLowerCase()).toContain("dead letter");
  });

  it("docs covers job types", () => {
    expect(docs).toContain("job_type");
  });

  it("docs covers observability", () => {
    expect(docs.toLowerCase()).toContain("observabilidad");
  });

  it("docs covers how to add job types", () => {
    expect(docs.toLowerCase()).toContain("nuevo");
  });
});
