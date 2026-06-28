import type { SupabaseClient } from "@supabase/supabase-js";

export type RateLimitBucket =
  | "ai_calls"
  | "whatsapp_messages"
  | "automation_dispatch"
  | "integration_tools"
  | "knowledge_import"
  | "webhook_events"
  | "api_requests";

export type RateLimitConfig = {
  limit: number;
  windowSeconds: number;
};

export const RATE_LIMIT_DEFAULTS: Record<RateLimitBucket, RateLimitConfig> = {
  ai_calls:             { limit: 100,   windowSeconds: 60 },
  whatsapp_messages:    { limit: 200,   windowSeconds: 60 },
  automation_dispatch:  { limit: 500,   windowSeconds: 60 },
  integration_tools:    { limit: 60,    windowSeconds: 60 },
  knowledge_import:     { limit: 10,    windowSeconds: 3600 },
  webhook_events:       { limit: 1000,  windowSeconds: 60 },
  api_requests:         { limit: 300,   windowSeconds: 60 },
};

export class RateLimitExceededError extends Error {
  constructor(
    public readonly bucket: string,
    public readonly organizationId: string,
  ) {
    super(`Rate limit exceeded for ${bucket} (org: ${organizationId})`);
    this.name = "RateLimitExceededError";
  }
}

export async function checkDistributedRateLimit(
  supabase: SupabaseClient,
  organizationId: string,
  bucket: RateLimitBucket,
  overrides?: Partial<RateLimitConfig>,
): Promise<boolean> {
  const config = { ...RATE_LIMIT_DEFAULTS[bucket], ...overrides };
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_organization_id: organizationId,
    p_bucket_key:      bucket,
    p_limit:           config.limit,
    p_window_seconds:  config.windowSeconds,
  });
  if (error) {
    console.warn("[rate-limit] DB check failed, allowing:", error.message);
    return true;
  }
  return data === true;
}

export async function checkRateLimitOrThrow(
  supabase: SupabaseClient,
  organizationId: string,
  bucket: RateLimitBucket,
  overrides?: Partial<RateLimitConfig>,
): Promise<void> {
  const allowed = await checkDistributedRateLimit(supabase, organizationId, bucket, overrides);
  if (!allowed) {
    throw new RateLimitExceededError(bucket, organizationId);
  }
}
