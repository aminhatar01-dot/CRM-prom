import type { JobRow } from "./queue";
import { getDecryptedCredential, storeCredential } from "../integrations/credentials";
import { refreshGoogleToken, isGoogleProvider } from "@crm-pro-ai/integrations/google/oauth";

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
  const { connectionId, organizationId, providerKey } = job.payload as Record<string, string>;
  if (!connectionId || !organizationId || !providerKey) {
    return { success: false, error: "Missing connectionId, organizationId or providerKey in job payload" };
  }

  if (isGoogleProvider(providerKey)) {
    const clientId     = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return { success: false, error: "GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not configured" };
    }
    const { createAdminClient } = await import("../supabase/admin");
    const adminSupabase  = createAdminClient();
    const refreshToken   = await getDecryptedCredential(adminSupabase, connectionId, organizationId, "refresh_token");
    if (!refreshToken) {
      return { success: false, error: `No refresh token for connection ${connectionId}` };
    }
    const { access_token, expires_in } = await refreshGoogleToken({ refreshToken, clientId, clientSecret });
    const expiresAt = new Date(Date.now() + expires_in * 1000);
    await storeCredential(adminSupabase, connectionId, organizationId, "access_token", access_token, expiresAt);
    await adminSupabase
      .from("integration_connections")
      .update({ status: "connected" })
      .eq("id", connectionId)
      .eq("organization_id", organizationId);
    return { success: true, result: { refreshed: true, providerKey, expiresAt: expiresAt.toISOString() } };
  }

  return { success: true, result: { handled: "stub", connectionId, providerKey } };
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
