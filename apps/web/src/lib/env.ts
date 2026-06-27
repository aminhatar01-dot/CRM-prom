import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1)
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().min(1).optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().min(1).optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().min(1).optional(),
  WHATSAPP_APP_SECRET: z.string().min(1).optional(),
  META_APP_ID: z.string().min(1).optional(),
  META_WHATSAPP_CONFIGURATION_ID: z.string().min(1).optional(),
  WHATSAPP_TOKEN_ENCRYPTION_KEY: z.string().min(1).optional(),
  WHATSAPP_GRAPH_API_VERSION: z.string().min(1).default("v23.0"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.2"),
  OPENAI_TEMPERATURE: z.coerce.number().min(0).max(2).default(0.7),
  OPENAI_EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
  CRON_SECRET: z.string().min(1).optional(),
  AI_DEMO_MODE: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true")
});

export function getPublicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  });
}

export function getServerEnv() {
  return serverEnvSchema.parse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
    META_APP_ID: process.env.META_APP_ID,
    META_WHATSAPP_CONFIGURATION_ID: process.env.META_WHATSAPP_CONFIGURATION_ID,
    WHATSAPP_TOKEN_ENCRYPTION_KEY: process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY,
    WHATSAPP_GRAPH_API_VERSION: process.env.WHATSAPP_GRAPH_API_VERSION,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENAI_TEMPERATURE: process.env.OPENAI_TEMPERATURE,
    OPENAI_EMBEDDING_MODEL: process.env.OPENAI_EMBEDDING_MODEL,
    CRON_SECRET: process.env.CRON_SECRET,
    AI_DEMO_MODE: process.env.AI_DEMO_MODE
  });
}

export const requiredEnvVars = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
] as const;

export const optionalProductionEnvVars = [
  "NEXT_PUBLIC_APP_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "OPENAI_TEMPERATURE",
  "OPENAI_EMBEDDING_MODEL",
  "AI_DEMO_MODE",
  "CRON_SECRET",
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
  "WHATSAPP_APP_SECRET",
  "META_APP_ID",
  "META_WHATSAPP_CONFIGURATION_ID",
  "WHATSAPP_TOKEN_ENCRYPTION_KEY",
  "WHATSAPP_GRAPH_API_VERSION"
] as const;

export function validateServerEnv(env: NodeJS.ProcessEnv = process.env) {
  const parsed = serverEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
    WHATSAPP_VERIFY_TOKEN: env.WHATSAPP_VERIFY_TOKEN,
    WHATSAPP_ACCESS_TOKEN: env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_APP_SECRET: env.WHATSAPP_APP_SECRET,
    META_APP_ID: env.META_APP_ID,
    META_WHATSAPP_CONFIGURATION_ID: env.META_WHATSAPP_CONFIGURATION_ID,
    WHATSAPP_TOKEN_ENCRYPTION_KEY: env.WHATSAPP_TOKEN_ENCRYPTION_KEY,
    WHATSAPP_GRAPH_API_VERSION: env.WHATSAPP_GRAPH_API_VERSION,
    OPENAI_API_KEY: env.OPENAI_API_KEY,
    OPENAI_MODEL: env.OPENAI_MODEL,
    OPENAI_TEMPERATURE: env.OPENAI_TEMPERATURE,
    OPENAI_EMBEDDING_MODEL: env.OPENAI_EMBEDDING_MODEL,
    CRON_SECRET: env.CRON_SECRET,
    AI_DEMO_MODE: env.AI_DEMO_MODE
  });
  const missingOpenAIKey = parsed.success && !parsed.data.AI_DEMO_MODE && !parsed.data.OPENAI_API_KEY;

  return {
    ok: parsed.success && !missingOpenAIKey,
    data: parsed.success && !missingOpenAIKey ? parsed.data : null,
    missing: requiredEnvVars.filter((key) => !env[key]),
    issues: parsed.success
      ? missingOpenAIKey
        ? ["OPENAI_API_KEY: required when AI_DEMO_MODE is false"]
        : []
      : parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
  };
}
