import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

const AI_REQUESTS_PER_MINUTE = 20;

export function getAIRuntimeConfig() {
  const env = getServerEnv();
  return {
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    temperature: env.OPENAI_TEMPERATURE,
    demoMode: env.AI_DEMO_MODE
  };
}

export async function enforceAIRateLimit(supabase: SupabaseClient, organizationId: string) {
  const since = new Date(Date.now() - 60_000).toISOString();
  const { count, error } = await supabase
    .from("ai_logs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("created_at", since);

  if (error) throw new Error("No pudimos validar el limite de IA.");
  if ((count ?? 0) >= AI_REQUESTS_PER_MINUTE) {
    throw new Error("Limite de IA alcanzado. Espera un minuto antes de intentar nuevamente.");
  }
}

export function usageMetadata(usage: {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
}, extra: Record<string, unknown> = {}) {
  return {
    ...extra,
    usage: {
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      total_tokens: usage.totalTokens
    }
  };
}

export function summarizeAIInput(input: Record<string, unknown>) {
  const serialized = JSON.stringify(input);
  return {
    summary: serialized.length > 2_000 ? `${serialized.slice(0, 2_000)}...` : serialized,
    truncated: serialized.length > 2_000
  };
}
