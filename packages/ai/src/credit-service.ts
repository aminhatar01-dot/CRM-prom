import type { AIUsage } from "./openai-client";

export const MIN_CREDITS_TO_CALL = 5;

// Pricing approximation per 1K tokens in USD
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.005, output: 0.015 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-5.2": { input: 0.005, output: 0.015 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 }
};

const DEFAULT_PRICING = { input: 0.005, output: 0.015 };

// 1 credit = 1000 tokens (rounded up)
export function calcCreditsFromUsage(usage: AIUsage): number {
  const total = (usage.totalTokens ?? 0) || (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0);
  return Math.max(1, Math.ceil(total / 1000));
}

export function calcEstimatedCostUsd(model: string, usage: AIUsage): number {
  const pricing = MODEL_PRICING[model] ?? DEFAULT_PRICING;
  const inputK = (usage.inputTokens ?? 0) / 1000;
  const outputK = (usage.outputTokens ?? 0) / 1000;
  return Math.round((inputK * pricing.input + outputK * pricing.output) * 1_000_000) / 1_000_000;
}

export type LedgerEntry = {
  organization_id: string;
  assistant_id?: string | null;
  conversation_id?: string | null;
  user_id?: string | null;
  ai_log_id?: string | null;
  provider: string;
  model: string;
  operation_type: "reply" | "test" | "classification" | "extraction" | "embedding" | "routing" | "other";
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  credits_charged: number;
  mode: "openai" | "demo" | "policy";
  idempotency_key?: string | null;
  metadata?: Record<string, unknown>;
};

export function buildLedgerEntry(params: {
  organizationId: string;
  assistantId?: string | null;
  conversationId?: string | null;
  userId?: string | null;
  aiLogId?: string | null;
  model: string;
  usage: AIUsage;
  mode: "openai" | "demo" | "policy";
  operationType?: LedgerEntry["operation_type"];
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
}): LedgerEntry {
  const credits = params.mode === "openai" ? calcCreditsFromUsage(params.usage) : 0;
  const cost = params.mode === "openai" ? calcEstimatedCostUsd(params.model, params.usage) : 0;

  return {
    organization_id: params.organizationId,
    assistant_id: params.assistantId ?? null,
    conversation_id: params.conversationId ?? null,
    user_id: params.userId ?? null,
    ai_log_id: params.aiLogId ?? null,
    provider: "openai",
    model: params.model,
    operation_type: params.operationType ?? "reply",
    input_tokens: params.usage.inputTokens ?? 0,
    output_tokens: params.usage.outputTokens ?? 0,
    total_tokens: params.usage.totalTokens ?? 0,
    estimated_cost_usd: cost,
    credits_charged: credits,
    mode: params.mode,
    idempotency_key: params.idempotencyKey ?? null,
    metadata: params.metadata ?? {}
  };
}
