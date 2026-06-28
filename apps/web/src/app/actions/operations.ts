"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { createAdminClient } from "@/lib/supabase/admin";
import { roleCapabilities } from "@/lib/permissions/roles";
import { getJobQueueStats, listDeadLetterJobs, retryDeadLetterJob, cancelJob } from "@/lib/jobs/queue";
import { listEventLogs, type EventSeverity, type EventSource } from "@/lib/observability/event-log";
import { getExtendedHealthStatus } from "@/lib/system/health";

export async function getOperationsDashboard() {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const capabilities = roleCapabilities(organization.role);
  if (!capabilities.manageSettings) redirect("/dashboard");

  const adminSupabase = createAdminClient();

  const [stats, dlJobs, recentErrors, health] = await Promise.all([
    getJobQueueStats(adminSupabase, organization.id),
    listDeadLetterJobs(adminSupabase, organization.id, 20),
    listEventLogs(adminSupabase, {
      organizationId: organization.id,
      severity:       "error" as EventSeverity,
      limit:          20,
    }),
    getExtendedHealthStatus(adminSupabase),
  ]);

  return { stats, dlJobs, recentErrors, health, organizationId: organization.id, role: organization.role };
}

export async function getSystemEventLogs(opts?: {
  severity?: EventSeverity;
  source?: EventSource;
}) {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const capabilities = roleCapabilities(organization.role);
  if (!capabilities.manageSettings) redirect("/dashboard");

  const adminSupabase = createAdminClient();
  const logs = await listEventLogs(adminSupabase, {
    organizationId: organization.id,
    severity:       opts?.severity,
    source:         opts?.source,
    limit:          100,
  });

  return { logs, organizationId: organization.id, role: organization.role };
}

export async function retryDeadLetterJobAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const capabilities = roleCapabilities(organization.role);
  if (!capabilities.manageSettings) redirect("/dashboard");

  const adminSupabase = createAdminClient();
  const jobId = formData.get("job_id") as string;
  if (!jobId) redirect("/settings/operations?error=missing-job");

  try {
    const retried = await retryDeadLetterJob(adminSupabase, jobId, organization.id);
    if (!retried) redirect("/settings/operations?error=retry-failed");
  } catch {
    redirect("/settings/operations?error=retry-failed");
  }

  redirect("/settings/operations?retried=1");
}

export async function cancelJobAction(formData: FormData) {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const capabilities = roleCapabilities(organization.role);
  if (!capabilities.manageSettings) redirect("/dashboard");

  const adminSupabase = createAdminClient();
  const jobId = formData.get("job_id") as string;
  if (!jobId) redirect("/settings/operations?error=missing-job");

  try {
    await cancelJob(adminSupabase, jobId, organization.id);
  } catch {
    redirect("/settings/operations?error=cancel-failed");
  }

  redirect("/settings/operations?cancelled=1");
}
