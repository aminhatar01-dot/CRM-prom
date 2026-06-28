import type { JobRow } from "./queue";

export type JobHandlerResult = {
  success: boolean;
  result?: Record<string, unknown>;
  error?: string;
};

export type JobHandler = (job: JobRow) => Promise<JobHandlerResult>;

const handlers = new Map<string, JobHandler>();

export function registerJobHandler(jobType: string, handler: JobHandler) {
  handlers.set(jobType, handler);
}

export function getJobHandler(jobType: string): JobHandler | undefined {
  return handlers.get(jobType);
}

// ── Stub handlers (real implementations in FASE 29) ──────────────────────────

registerJobHandler("automation_dispatch", async (job) => {
  const { trigger, conversationId, organizationId } = job.payload as Record<string, string>;
  return {
    success: true,
    result: { handled: "stub", trigger, conversationId, organizationId },
  };
});

registerJobHandler("integration_sync", async (job) => {
  const { connectionId } = job.payload as Record<string, string>;
  return { success: true, result: { handled: "stub", connectionId } };
});

registerJobHandler("refresh_integration_token", async (job) => {
  const { connectionId } = job.payload as Record<string, string>;
  return { success: true, result: { handled: "stub", connectionId } };
});

registerJobHandler("execute_integration_tool", async (job) => {
  const { connectionId, toolKey } = job.payload as Record<string, string>;
  return { success: true, result: { handled: "stub", connectionId, toolKey, notImplemented: true } };
});

registerJobHandler("webhook_process", async (job) => {
  const { source, eventId } = job.payload as Record<string, string>;
  return { success: true, result: { handled: "stub", source, eventId } };
});

registerJobHandler("knowledge_import", async (job) => {
  const { documentId } = job.payload as Record<string, string>;
  return { success: true, result: { handled: "stub", documentId } };
});

registerJobHandler("quote_generate", async (job) => {
  const { contactId } = job.payload as Record<string, string>;
  return { success: true, result: { handled: "stub", contactId } };
});

registerJobHandler("notification_deliver", async (job) => {
  const { channel, recipientId } = job.payload as Record<string, string>;
  return { success: true, result: { handled: "stub", channel, recipientId } };
});

registerJobHandler("scheduled_task", async (job) => {
  const { taskName } = job.payload as Record<string, string>;
  return { success: true, result: { handled: "stub", taskName } };
});
