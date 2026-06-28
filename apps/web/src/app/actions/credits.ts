"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { roleCapabilities } from "@/lib/permissions/roles";

const addCreditsSchema = z.object({
  amount: z.coerce.number().positive().max(1_000_000),
  reason: z.string().trim().min(3).max(500),
});

export async function getCreditsOverview() {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);

  const [walletResult, ledgerResult, adjustmentsResult] = await Promise.all([
    supabase
      .from("ai_credit_wallets")
      .select(
        "available_credits, lifetime_credits_loaded, lifetime_credits_used, low_balance_threshold, is_admin_exempt, updated_at",
      )
      .eq("organization_id", organization.id)
      .single<{
        available_credits: number;
        lifetime_credits_loaded: number;
        lifetime_credits_used: number;
        low_balance_threshold: number;
        is_admin_exempt: boolean;
        updated_at: string;
      }>(),

    supabase
      .from("ai_usage_ledger")
      .select(
        "id, assistant_id, conversation_id, model, operation_type, input_tokens, output_tokens, total_tokens, estimated_cost_usd, credits_charged, mode, created_at",
      )
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<
        Array<{
          id: string;
          assistant_id: string | null;
          conversation_id: string | null;
          model: string;
          operation_type: string;
          input_tokens: number;
          output_tokens: number;
          total_tokens: number;
          estimated_cost_usd: number;
          credits_charged: number;
          mode: string;
          created_at: string;
        }>
      >(),

    supabase
      .from("credit_adjustments")
      .select("id, amount, adjustment_type, reason, created_at")
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<
        Array<{
          id: string;
          amount: number;
          adjustment_type: string;
          reason: string;
          created_at: string;
        }>
      >(),
  ]);

  return {
    wallet: walletResult.data,
    ledger: ledgerResult.data ?? [],
    adjustments: adjustmentsResult.data ?? [],
    organizationId: organization.id,
    role: organization.role,
  };
}

export async function getUsageByAssistant() {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);

  const { data } = await supabase
    .from("ai_usage_ledger")
    .select("assistant_id, credits_charged, total_tokens, mode")
    .eq("organization_id", organization.id)
    .returns<
      Array<{
        assistant_id: string | null;
        credits_charged: number;
        total_tokens: number;
        mode: string;
      }>
    >();

  const byAssistant = new Map<string, { credits: number; tokens: number; calls: number }>();
  for (const row of data ?? []) {
    const key = row.assistant_id ?? "_unknown";
    const prev = byAssistant.get(key) ?? { credits: 0, tokens: 0, calls: 0 };
    byAssistant.set(key, {
      credits: prev.credits + row.credits_charged,
      tokens: prev.tokens + row.total_tokens,
      calls: prev.calls + 1,
    });
  }

  return Object.fromEntries(byAssistant);
}

export async function addCreditsManual(formData: FormData) {
  const parsed = addCreditsSchema.safeParse({
    amount: formData.get("amount"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) redirect("/settings/credits?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const capabilities = roleCapabilities(organization.role);

  if (!capabilities.manageSettings) {
    redirect("/settings/credits?error=forbidden");
  }

  const { error } = await supabase.rpc("load_ai_credits", {
    p_organization_id: organization.id,
    p_credits: parsed.data.amount,
    p_reason: parsed.data.reason,
    p_actor_id: user.id,
    p_external_reference: null,
  });

  if (error) redirect("/settings/credits?error=load-failed");

  revalidatePath("/settings/credits");
  redirect("/settings/credits?success=credits-loaded");
}
