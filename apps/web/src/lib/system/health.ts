import { validateServerEnv } from "../env";
import { getAllProviders } from "@crm-pro-ai/integrations/provider-registry";

export type HealthStatus = {
  status: "ok" | "degraded";
  timestamp: string;
  env: {
    ok: boolean;
    missing: string[];
    issues: string[];
  };
  features: {
    ai: "demo" | "openai";
    whatsappConfigured: boolean;
    cronConfigured: boolean;
    serviceRoleConfigured: boolean;
    integrationHubProviders: number;
    lastMigration: string;
  };
  jobQueue?: {
    pending: number;
    running: number;
    dead_letter: number;
  };
  credits?: {
    active: boolean;
  };
};

export function getHealthStatus(env: NodeJS.ProcessEnv = process.env): HealthStatus {
  const validation = validateServerEnv(env);

  let hubProviders = 0;
  try {
    hubProviders = getAllProviders().length;
  } catch {
    // non-fatal
  }

  const features = {
    ai: (env.OPENAI_API_KEY && env.AI_DEMO_MODE !== "true" ? "openai" : "demo") as "demo" | "openai",
    whatsappConfigured: Boolean(
      env.WHATSAPP_VERIFY_TOKEN &&
        (
          (env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID) ||
          (env.META_APP_ID &&
            env.META_WHATSAPP_CONFIGURATION_ID &&
            env.WHATSAPP_APP_SECRET &&
            env.WHATSAPP_TOKEN_ENCRYPTION_KEY)
        ),
    ),
    cronConfigured:          Boolean(env.CRON_SECRET),
    serviceRoleConfigured:   Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
    integrationHubProviders: hubProviders,
    lastMigration:           "20260628180000_phase_28_operational_reliability",
  };

  return {
    status:    validation.ok ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    env: {
      ok:      validation.ok,
      missing: validation.missing,
      issues:  validation.issues,
    },
    features,
  };
}

export async function getExtendedHealthStatus(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  env: NodeJS.ProcessEnv = process.env,
): Promise<HealthStatus> {
  const base = getHealthStatus(env);

  let jobQueue: HealthStatus["jobQueue"] | undefined;
  let credits: HealthStatus["credits"] | undefined;

  try {
    const { data } = await supabase
      .from("job_queue")
      .select("status")
      .in("status", ["pending", "running", "dead_letter"]);

    const rows = (data ?? []) as { status: string }[];
    jobQueue = {
      pending:     rows.filter((r) => r.status === "pending").length,
      running:     rows.filter((r) => r.status === "running").length,
      dead_letter: rows.filter((r) => r.status === "dead_letter").length,
    };
  } catch {
    // non-fatal
  }

  try {
    const { count } = await supabase
      .from("ai_credit_wallets")
      .select("id", { count: "exact", head: true })
      .gt("available_credits", 0);
    credits = { active: (count ?? 0) > 0 };
  } catch {
    // non-fatal
  }

  return { ...base, jobQueue, credits };
}
