import type { SupabaseClient } from "@supabase/supabase-js";

export type EventSeverity = "info" | "warning" | "error" | "critical";
export type EventSource =
  | "whatsapp"
  | "ai"
  | "integration"
  | "automation"
  | "knowledge"
  | "quote"
  | "billing"
  | "job"
  | "system"
  | "webhook"
  | "auth";

export type LogEventParams = {
  eventType:      string;
  source:         EventSource;
  severity?:      EventSeverity;
  message?:       string;
  organizationId?: string;
  correlationId?: string;
  entityType?:    string;
  entityId?:      string;
  jobId?:         string;
  metadata?:      Record<string, unknown>;
};

export type EventLogRow = {
  id: string;
  organization_id: string | null;
  correlation_id: string | null;
  event_type: string;
  severity: EventSeverity;
  source: EventSource;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  job_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function logEvent(
  supabase: SupabaseClient,
  params: LogEventParams,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("log_event", {
    p_event_type:     params.eventType,
    p_source:         params.source,
    p_severity:       params.severity ?? "info",
    p_message:        params.message ?? "",
    p_organization_id: params.organizationId ?? null,
    p_correlation_id:  params.correlationId ?? null,
    p_entity_type:     params.entityType ?? null,
    p_entity_id:       params.entityId ?? null,
    p_job_id:          params.jobId ?? null,
    p_metadata:        stripSecrets(params.metadata ?? {}),
  });
  if (error) {
    console.error("[event-log] Failed to log event:", error.message);
    return null;
  }
  return data as string;
}

export async function listEventLogs(
  supabase: SupabaseClient,
  opts: {
    organizationId?: string;
    severity?: EventSeverity;
    source?: EventSource;
    limit?: number;
  } = {},
): Promise<EventLogRow[]> {
  let query = supabase
    .from("event_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 100);

  if (opts.organizationId) query = query.eq("organization_id", opts.organizationId);
  if (opts.severity)       query = query.eq("severity", opts.severity);
  if (opts.source)         query = query.eq("source", opts.source);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as EventLogRow[];
}

const SECRET_KEYS = new Set([
  "password", "token", "access_token", "refresh_token", "api_key", "secret",
  "client_secret", "webhook_secret", "encrypted_value", "key", "credential",
]);

function stripSecrets(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_KEYS.has(k.toLowerCase())) {
      out[k] = "[REDACTED]";
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = stripSecrets(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}
