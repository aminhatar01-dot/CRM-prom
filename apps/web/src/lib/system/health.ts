import { validateServerEnv } from "../env";

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
  };
};

export function getHealthStatus(env: NodeJS.ProcessEnv = process.env): HealthStatus {
  const validation = validateServerEnv(env);
  const features = {
    ai: env.OPENAI_API_KEY && env.AI_DEMO_MODE !== "true" ? ("openai" as const) : ("demo" as const),
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
    cronConfigured: Boolean(env.CRON_SECRET),
    serviceRoleConfigured: Boolean(env.SUPABASE_SERVICE_ROLE_KEY)
  };

  return {
    status: validation.ok ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    env: {
      ok: validation.ok,
      missing: validation.missing,
      issues: validation.issues
    },
    features
  };
}
