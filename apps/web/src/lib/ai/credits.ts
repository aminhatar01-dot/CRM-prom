import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MIN_CREDITS_TO_CALL,
  buildLedgerEntry,
  type LedgerEntry
} from "@crm-pro-ai/ai/credit-service";
import type { AIUsage } from "@crm-pro-ai/ai/openai-client";

export class InsufficientCreditsError extends Error {
  constructor(available: number) {
    super(
      `Saldo de creditos insuficiente (${available.toFixed(0)} disponibles). Contacta al administrador para recargar.`
    );
    this.name = "InsufficientCreditsError";
  }
}

export async function getOrganizationWallet(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("ai_credit_wallets")
    .select("available_credits, lifetime_credits_used, lifetime_credits_loaded, low_balance_threshold, is_admin_exempt, updated_at")
    .eq("organization_id", organizationId)
    .single<{
      available_credits: number;
      lifetime_credits_used: number;
      lifetime_credits_loaded: number;
      low_balance_threshold: number;
      is_admin_exempt: boolean;
      updated_at: string;
    }>();

  if (error || !data) return null;
  return data;
}

export async function checkCreditsOrThrow(
  supabase: SupabaseClient,
  organizationId: string,
  mode: "openai" | "demo" | "policy"
): Promise<void> {
  // demo and policy modes never consume credits
  if (mode !== "openai") return;

  const wallet = await getOrganizationWallet(supabase, organizationId);
  if (!wallet) return; // wallet not yet backfilled; allow (will be created on next settle)

  if (wallet.is_admin_exempt) return;

  if (wallet.available_credits < MIN_CREDITS_TO_CALL) {
    throw new InsufficientCreditsError(wallet.available_credits);
  }
}

export type RecordAIUsageParams = {
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
};

export async function recordAIUsage(
  supabase: SupabaseClient,
  params: RecordAIUsageParams
): Promise<void> {
  const entry = buildLedgerEntry({
    organizationId: params.organizationId,
    assistantId: params.assistantId,
    conversationId: params.conversationId,
    userId: params.userId,
    aiLogId: params.aiLogId,
    model: params.model,
    usage: params.usage,
    mode: params.mode,
    operationType: params.operationType,
    idempotencyKey: params.idempotencyKey,
    metadata: params.metadata
  });

  // Insert ledger entry (idempotency via unique index on idempotency_key)
  const { error: ledgerError } = await supabase
    .from("ai_usage_ledger")
    .insert(entry);

  if (ledgerError) {
    // Conflict on idempotency key = already recorded; safe to skip
    if ((ledgerError as { code?: string }).code === "23505") return;
    console.error("[credits] ledger insert error:", ledgerError.message);
    return;
  }

  // Atomic deduction via DB function (only for real openai calls)
  if (entry.credits_charged > 0) {
    const { error: deductError } = await supabase.rpc("deduct_ai_credits", {
      p_organization_id: params.organizationId,
      p_credits: entry.credits_charged,
      p_idempotency_key: params.idempotencyKey ?? null
    });
    if (deductError) {
      console.error("[credits] deduction error:", deductError.message);
    }
  }
}
