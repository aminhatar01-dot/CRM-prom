import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  calcCreditsFromUsage,
  calcEstimatedCostUsd,
  buildLedgerEntry,
  MIN_CREDITS_TO_CALL,
} from "@crm-pro-ai/ai/credit-service";

const root = resolve(import.meta.dirname, "../../..");
const migration = readFileSync(
  resolve(root, "supabase/migrations/20260628160000_phase_26_ai_credits.sql"),
  "utf8",
);
const creditsLib = readFileSync(
  resolve(root, "apps/web/src/lib/ai/credits.ts"),
  "utf8",
);
const aiActions = readFileSync(
  resolve(root, "apps/web/src/app/actions/ai.ts"),
  "utf8",
);
const creditsPage = readFileSync(
  resolve(root, "apps/web/src/app/(crm)/settings/credits/page.tsx"),
  "utf8",
);

// ─── Migration contracts ───────────────────────────────────────────────────────

describe("phase 26 migration contracts", () => {
  it("creates all required tables", () => {
    for (const table of [
      "ai_credit_wallets",
      "ai_usage_ledger",
      "credit_adjustments",
      "plans",
      "organization_subscriptions",
    ]) {
      expect(migration).toContain(`create table public.${table}`);
    }
  });

  it("enforces RLS on all new tables", () => {
    for (const table of [
      "ai_credit_wallets",
      "ai_usage_ledger",
      "credit_adjustments",
      "plans",
      "organization_subscriptions",
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("uses is_org_member for tenant isolation on wallet and ledger", () => {
    expect(migration).toContain("is_org_member(organization_id)");
  });

  it("provides atomic deduction function", () => {
    expect(migration).toContain("create or replace function public.deduct_ai_credits");
    expect(migration).toContain("for update");
    expect(migration).toContain("is_admin_exempt");
    expect(migration).toContain("available_credits < p_credits");
  });

  it("provides load_ai_credits function", () => {
    expect(migration).toContain("create or replace function public.load_ai_credits");
    expect(migration).toContain("credit_adjustments");
  });

  it("backfills wallets for existing organizations", () => {
    expect(migration).toContain("insert into public.ai_credit_wallets");
    expect(migration).toContain("on conflict (organization_id) do nothing");
  });

  it("ai_usage_ledger has required columns", () => {
    for (const col of [
      "organization_id",
      "assistant_id",
      "conversation_id",
      "user_id",
      "ai_log_id",
      "provider",
      "model",
      "input_tokens",
      "output_tokens",
      "total_tokens",
      "estimated_cost_usd",
      "credits_charged",
      "operation_type",
      "mode",
      "idempotency_key",
    ]) {
      expect(migration).toContain(col);
    }
  });

  it("protects service_role operations via SECURITY DEFINER functions", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("grant execute on function public.deduct_ai_credits");
  });
});

// ─── Credit service unit contracts ────────────────────────────────────────────

describe("credit-service unit contracts", () => {
  it("calculates credits from token usage (1 credit per 1000 tokens)", () => {
    expect(calcCreditsFromUsage({ inputTokens: 500, outputTokens: 200, totalTokens: 700 })).toBe(1);
    expect(calcCreditsFromUsage({ inputTokens: 1000, outputTokens: 0, totalTokens: 1000 })).toBe(1);
    expect(calcCreditsFromUsage({ inputTokens: 1500, outputTokens: 600, totalTokens: 2100 })).toBe(3);
  });

  it("charges minimum 1 credit even for very small usage", () => {
    expect(calcCreditsFromUsage({ inputTokens: 10, outputTokens: 5, totalTokens: 15 })).toBeGreaterThanOrEqual(1);
  });

  it("charges 0 credits in demo mode via buildLedgerEntry", () => {
    const entry = buildLedgerEntry({
      organizationId: "org-1",
      model: "gpt-4o",
      usage: { inputTokens: 1500, outputTokens: 600, totalTokens: 2100 },
      mode: "demo",
    });
    expect(entry.credits_charged).toBe(0);
    expect(entry.estimated_cost_usd).toBe(0);
  });

  it("charges 0 credits in policy mode via buildLedgerEntry", () => {
    const entry = buildLedgerEntry({
      organizationId: "org-1",
      model: "gpt-4o",
      usage: { inputTokens: 500, outputTokens: 100, totalTokens: 600 },
      mode: "policy",
    });
    expect(entry.credits_charged).toBe(0);
  });

  it("charges credits in openai mode", () => {
    const entry = buildLedgerEntry({
      organizationId: "org-1",
      model: "gpt-4o",
      usage: { inputTokens: 1000, outputTokens: 500, totalTokens: 1500 },
      mode: "openai",
    });
    expect(entry.credits_charged).toBeGreaterThan(0);
    expect(entry.estimated_cost_usd).toBeGreaterThan(0);
  });

  it("estimates USD cost based on model pricing", () => {
    const cost = calcEstimatedCostUsd("gpt-4o", { inputTokens: 1000, outputTokens: 1000, totalTokens: 2000 });
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(1); // sanity: < $1 for 2K tokens
  });

  it("has a sensible MIN_CREDITS_TO_CALL constant", () => {
    expect(MIN_CREDITS_TO_CALL).toBeGreaterThan(0);
    expect(MIN_CREDITS_TO_CALL).toBeLessThan(100);
  });

  it("buildLedgerEntry maps all required fields", () => {
    const entry = buildLedgerEntry({
      organizationId: "org-uuid",
      assistantId: "asst-uuid",
      conversationId: "conv-uuid",
      userId: "user-uuid",
      model: "gpt-4o",
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      mode: "openai",
      operationType: "test",
    });
    expect(entry.organization_id).toBe("org-uuid");
    expect(entry.assistant_id).toBe("asst-uuid");
    expect(entry.provider).toBe("openai");
    expect(entry.operation_type).toBe("test");
  });
});

// ─── Credits lib contracts ─────────────────────────────────────────────────────

describe("phase 26 credits lib contracts", () => {
  it("exports InsufficientCreditsError", () => {
    expect(creditsLib).toContain("InsufficientCreditsError");
  });

  it("exports checkCreditsOrThrow", () => {
    expect(creditsLib).toContain("checkCreditsOrThrow");
  });

  it("exports recordAIUsage", () => {
    expect(creditsLib).toContain("recordAIUsage");
  });

  it("skips credit check in demo and policy mode", () => {
    expect(creditsLib).toContain(`mode !== "openai"`);
    expect(creditsLib).toContain("return");
  });

  it("skips credit check for admin exempt orgs", () => {
    expect(creditsLib).toContain("is_admin_exempt");
  });

  it("calls deduct_ai_credits RPC after recording", () => {
    expect(creditsLib).toContain("deduct_ai_credits");
  });

  it("handles idempotency conflict gracefully (no throw on 23505)", () => {
    expect(creditsLib).toContain("23505");
  });
});

// ─── AI actions integration contracts ─────────────────────────────────────────

describe("phase 26 AI action integration contracts", () => {
  it("imports checkCreditsOrThrow in ai actions", () => {
    expect(aiActions).toContain("checkCreditsOrThrow");
  });

  it("imports recordAIUsage in ai actions", () => {
    expect(aiActions).toContain("recordAIUsage");
  });

  it("imports InsufficientCreditsError in ai actions", () => {
    expect(aiActions).toContain("InsufficientCreditsError");
  });

  it("calls checkCreditsOrThrow before generateReply in runAssistantTest", () => {
    const testBlock = aiActions.slice(aiActions.indexOf("runAssistantTest"), aiActions.indexOf("suggestConversationReply"));
    expect(testBlock).toContain("checkCreditsOrThrow");
    expect(testBlock).toContain("generateReply");
    // check appears before generate
    expect(testBlock.indexOf("checkCreditsOrThrow")).toBeLessThan(testBlock.indexOf("generateReply"));
  });

  it("calls recordAIUsage after generateReply in runAssistantTest", () => {
    const testBlock = aiActions.slice(aiActions.indexOf("runAssistantTest"), aiActions.indexOf("suggestConversationReply"));
    expect(testBlock).toContain("recordAIUsage");
    expect(testBlock.indexOf("recordAIUsage")).toBeGreaterThan(testBlock.indexOf("generateReply"));
  });

  it("redirects to no-credits error on InsufficientCreditsError", () => {
    expect(aiActions).toContain("no-credits");
    expect(aiActions).toContain("isCreditsError");
  });
});

// ─── UI contracts ──────────────────────────────────────────────────────────────

describe("phase 26 credits UI contracts", () => {
  it("shows available credits balance", () => {
    expect(creditsPage).toContain("available_credits");
    expect(creditsPage).toContain("Saldo disponible");
  });

  it("shows low balance warning", () => {
    expect(creditsPage).toContain("Saldo bajo");
    expect(creditsPage).toContain("low_balance_threshold");
  });

  it("shows ledger history table", () => {
    expect(creditsPage).toContain("Historial de consumo");
    expect(creditsPage).toContain("credits_charged");
  });

  it("shows manual credit load form", () => {
    expect(creditsPage).toContain("Cargar creditos");
    expect(creditsPage).toContain("addCreditsManual");
  });

  it("gates the page behind manageSettings capability", () => {
    expect(creditsPage).toContain("manageSettings");
    expect(creditsPage).toContain('redirect("/dashboard")');
  });

  it("shows admin exempt status", () => {
    expect(creditsPage).toContain("is_admin_exempt");
    expect(creditsPage).toContain("Ilimitado");
  });
});
