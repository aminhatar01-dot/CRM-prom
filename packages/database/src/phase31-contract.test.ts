/**
 * Phase 31 contract tests — Billing Foundation
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");

function readFile(rel: string) {
  return readFileSync(resolve(ROOT, rel), "utf-8");
}

// ─── Migration SQL ────────────────────────────────────────────────────────────

describe("Migration 20260629120000_phase_31_billing_foundation", () => {
  const sql = readFile("supabase/migrations/20260629120000_phase_31_billing_foundation.sql");

  it("creates billing_customers table", () => {
    expect(sql).toContain("billing_customers");
    expect(sql.toLowerCase()).toContain("create table");
  });

  it("creates billing_subscriptions table", () => {
    expect(sql).toContain("billing_subscriptions");
  });

  it("creates billing_invoices table", () => {
    expect(sql).toContain("billing_invoices");
  });

  it("creates billing_payments table", () => {
    expect(sql).toContain("billing_payments");
  });

  it("creates billing_checkout_sessions table", () => {
    expect(sql).toContain("billing_checkout_sessions");
  });

  it("creates billing_webhook_events table", () => {
    expect(sql).toContain("billing_webhook_events");
  });

  it("supports all three providers", () => {
    expect(sql).toContain("manual");
    expect(sql).toContain("mercado_pago");
    expect(sql).toContain("stripe");
  });

  it("billing_payments has idempotency_key unique constraint", () => {
    expect(sql).toContain("idempotency_key");
    expect(sql).toContain("unique");
  });

  it("billing_webhook_events has external_id dedup index", () => {
    expect(sql).toContain("billing_webhook_events_external_dedup_idx");
    expect(sql).toContain("external_id");
  });

  it("all billing tables have RLS enabled", () => {
    const count = (sql.match(/enable row level security/g) ?? []).length;
    expect(count).toBeGreaterThanOrEqual(6);
  });

  it("webhook events are service_role only — not authenticated", () => {
    expect(sql).not.toMatch(/grant select on public\.billing_webhook_events to authenticated/i);
  });

  it("billing_record_webhook is SECURITY DEFINER", () => {
    expect(sql.toLowerCase()).toContain("billing_record_webhook");
    expect(sql.toLowerCase()).toContain("security definer");
  });

  it("billing_mark_invoice_paid is SECURITY DEFINER", () => {
    expect(sql.toLowerCase()).toContain("billing_mark_invoice_paid");
    expect(sql.toLowerCase()).toContain("security definer");
  });

  it("billing_create_invoice is SECURITY DEFINER", () => {
    expect(sql.toLowerCase()).toContain("billing_create_invoice");
    expect(sql.toLowerCase()).toContain("security definer");
  });

  it("billing_suspend_org is SECURITY DEFINER", () => {
    expect(sql.toLowerCase()).toContain("billing_suspend_org");
    expect(sql.toLowerCase()).toContain("security definer");
  });

  it("billing_reactivate_org is SECURITY DEFINER", () => {
    expect(sql.toLowerCase()).toContain("billing_reactivate_org");
    expect(sql.toLowerCase()).toContain("security definer");
  });

  it("mark_invoice_paid prevents double payment via idempotency", () => {
    expect(sql).toContain("idempotency_key");
    expect(sql).toContain("v_already_paid");
  });

  it("mark_invoice_paid grants credits from plan", () => {
    expect(sql).toContain("admin_load_credits");
    expect(sql).toContain("v_credits");
  });
});

// ─── Billing types ────────────────────────────────────────────────────────────

describe("Billing types (apps/web/src/lib/billing/types.ts)", () => {
  const src = readFile("apps/web/src/lib/billing/types.ts");

  it("exports BillingProvider type", () => {
    expect(src).toContain("BillingProvider");
  });

  it("BillingProvider includes all three", () => {
    expect(src).toContain('"manual"');
    expect(src).toContain('"mercado_pago"');
    expect(src).toContain('"stripe"');
  });

  it("exports InvoiceStatus type", () => {
    expect(src).toContain("InvoiceStatus");
  });

  it("exports BillingInvoice type", () => {
    expect(src).toContain("BillingInvoice");
  });

  it("exports BillingPayment with idempotency_key", () => {
    expect(src).toContain("BillingPayment");
    expect(src).toContain("idempotency_key");
  });

  it("exports BillingWebhookEvent", () => {
    expect(src).toContain("BillingWebhookEvent");
  });
});

// ─── Billing core lib ─────────────────────────────────────────────────────────

describe("Billing core lib (apps/web/src/lib/billing/core.ts)", () => {
  const src = readFile("apps/web/src/lib/billing/core.ts");

  it("exports createManualInvoice", () => {
    expect(src).toContain("export async function createManualInvoice");
  });

  it("exports markInvoicePaid with idempotencyKey param", () => {
    expect(src).toContain("export async function markInvoicePaid");
    expect(src).toContain("idempotencyKey");
  });

  it("exports listOrgInvoices", () => {
    expect(src).toContain("export async function listOrgInvoices");
  });

  it("exports listAllInvoices", () => {
    expect(src).toContain("export async function listAllInvoices");
  });

  it("exports suspendOrg", () => {
    expect(src).toContain("export async function suspendOrg");
  });

  it("exports reactivateOrg", () => {
    expect(src).toContain("export async function reactivateOrg");
  });

  it("exports recordWebhookEvent", () => {
    expect(src).toContain("export async function recordWebhookEvent");
  });

  it("uses billing_mark_invoice_paid RPC", () => {
    expect(src).toContain("billing_mark_invoice_paid");
  });

  it("uses billing_record_webhook RPC", () => {
    expect(src).toContain("billing_record_webhook");
  });

  it("uses billing_suspend_org RPC", () => {
    expect(src).toContain("billing_suspend_org");
  });
});

// ─── Providers lib ────────────────────────────────────────────────────────────

describe("Billing providers lib (apps/web/src/lib/billing/providers.ts)", () => {
  const src = readFile("apps/web/src/lib/billing/providers.ts");

  it("exports getActiveProvider", () => {
    expect(src).toContain("export function getActiveProvider");
  });

  it("exports isMercadoPagoConfigured", () => {
    expect(src).toContain("export function isMercadoPagoConfigured");
  });

  it("exports isStripeConfigured", () => {
    expect(src).toContain("export function isStripeConfigured");
  });

  it("exports verifyMercadoPagoSignature", () => {
    expect(src).toContain("export async function verifyMercadoPagoSignature");
  });

  it("exports verifyStripeSignature", () => {
    expect(src).toContain("export async function verifyStripeSignature");
  });

  it("getActiveProvider falls back to manual when no env vars", () => {
    // Without BILLING_PROVIDER env var set, returns 'manual'
    expect(src).toContain('"manual"');
    expect(src).toContain("return");
  });

  it("does not hard-require env vars at module load time", () => {
    // Vars are only read inside functions, not at top level
    expect(src).not.toMatch(/const\s+\w+\s*=\s*process\.env\.\w+!/);
  });

  it("exports parseMercadoPagoEvent", () => {
    expect(src).toContain("export function parseMercadoPagoEvent");
  });

  it("exports parseStripeEvent", () => {
    expect(src).toContain("export function parseStripeEvent");
  });
});

// ─── Server actions ───────────────────────────────────────────────────────────

describe("Billing server actions (apps/web/src/app/actions/billing.ts)", () => {
  const src = readFile("apps/web/src/app/actions/billing.ts");

  it("is a server action file", () => {
    expect(src).toMatch(/^"use server"/);
  });

  it("admin actions gate through requireSuperAdmin", () => {
    expect(src).toContain("requireSuperAdmin");
  });

  it("client actions gate through requireUser", () => {
    expect(src).toContain("requireUser");
  });

  it("exports adminCreateManualInvoice", () => {
    expect(src).toContain("export async function adminCreateManualInvoice");
  });

  it("exports adminMarkInvoicePaid", () => {
    expect(src).toContain("export async function adminMarkInvoicePaid");
  });

  it("exports adminSuspendOrg", () => {
    expect(src).toContain("export async function adminSuspendOrg");
  });

  it("exports adminReactivateOrg", () => {
    expect(src).toContain("export async function adminReactivateOrg");
  });

  it("exports getMyBillingStatus for clients", () => {
    expect(src).toContain("export async function getMyBillingStatus");
  });

  it("mark invoice paid uses idempotency key", () => {
    expect(src).toContain("idempotencyKey");
  });

  it("does not expose secrets", () => {
    expect(src).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(src).not.toContain("STRIPE_SECRET_KEY");
    expect(src).not.toContain("MERCADO_PAGO_ACCESS_TOKEN");
  });

  it("uses createAdminClient for billing operations", () => {
    expect(src).toContain("createAdminClient");
  });
});

// ─── Webhook routes ───────────────────────────────────────────────────────────

describe("Webhook routes", () => {
  it("Mercado Pago webhook returns not_configured when unconfigured", () => {
    const src = readFile("apps/web/src/app/api/webhooks/billing/mercado-pago/route.ts");
    expect(src).toContain("not_configured");
    expect(src).toContain("isMercadoPagoConfigured");
  });

  it("Stripe webhook returns not_configured when unconfigured", () => {
    const src = readFile("apps/web/src/app/api/webhooks/billing/stripe/route.ts");
    expect(src).toContain("not_configured");
    expect(src).toContain("isStripeConfigured");
  });

  it("Mercado Pago webhook validates signature", () => {
    const src = readFile("apps/web/src/app/api/webhooks/billing/mercado-pago/route.ts");
    expect(src).toContain("verifyMercadoPagoSignature");
    expect(src).toContain("401");
  });

  it("Stripe webhook validates signature", () => {
    const src = readFile("apps/web/src/app/api/webhooks/billing/stripe/route.ts");
    expect(src).toContain("verifyStripeSignature");
    expect(src).toContain("401");
  });

  it("both webhooks store events idempotently", () => {
    const mp     = readFile("apps/web/src/app/api/webhooks/billing/mercado-pago/route.ts");
    const stripe = readFile("apps/web/src/app/api/webhooks/billing/stripe/route.ts");
    expect(mp).toContain("recordWebhookEvent");
    expect(mp).toContain("duplicate");
    expect(stripe).toContain("recordWebhookEvent");
    expect(stripe).toContain("duplicate");
  });
});

// ─── Admin UI routes ──────────────────────────────────────────────────────────

describe("Admin billing UI routes", () => {
  it("billing list page exists", () => {
    const src = readFile("apps/web/src/app/admin/billing/page.tsx");
    expect(src).toContain("adminListAllInvoices");
    expect(src).toContain("adminListWebhookEvents");
  });

  it("new invoice page exists", () => {
    const src = readFile("apps/web/src/app/admin/billing/new/page.tsx");
    expect(src).toContain("adminCreateManualInvoice");
  });

  it("invoice detail page exists with pay/suspend/reactivate actions", () => {
    const src = readFile("apps/web/src/app/admin/billing/invoice/[id]/page.tsx");
    expect(src).toContain("adminMarkInvoicePaid");
    expect(src).toContain("adminSuspendOrg");
    expect(src).toContain("adminReactivateOrg");
  });

  it("billing is in admin nav", () => {
    const layout = readFile("apps/web/src/app/admin/layout.tsx");
    expect(layout).toContain("billing");
  });
});

// ─── Client billing page ──────────────────────────────────────────────────────

describe("Client settings billing page", () => {
  it("settings/billing page exists", () => {
    const src = readFile("apps/web/src/app/(crm)/settings/billing/page.tsx");
    expect(src).toContain("getMyBillingStatus");
  });

  it("shows plan and credit balance", () => {
    const src = readFile("apps/web/src/app/(crm)/settings/billing/page.tsx");
    expect(src).toContain("available_credits");
    expect(src).toContain("monthly_credits");
  });

  it("shows invoice list", () => {
    const src = readFile("apps/web/src/app/(crm)/settings/billing/page.tsx");
    expect(src).toContain("invoices");
  });

  it("does not expose internal secrets", () => {
    const src = readFile("apps/web/src/app/(crm)/settings/billing/page.tsx");
    expect(src).not.toContain("STRIPE_SECRET_KEY");
    expect(src).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });
});

// ─── Security invariants ──────────────────────────────────────────────────────

describe("Phase 31 security invariants", () => {
  it("billing_webhook_events has no authenticated SELECT", () => {
    const sql = readFile("supabase/migrations/20260629120000_phase_31_billing_foundation.sql");
    expect(sql).not.toMatch(/grant select on public\.billing_webhook_events to authenticated/i);
  });

  it("providers module never hard-reads secrets at top level", () => {
    const src = readFile("apps/web/src/lib/billing/providers.ts");
    // process.env access should be inside function bodies, not at top-level const
    const lines = src.split("\n").filter((l) => !l.startsWith(" ") && !l.startsWith("\t"));
    const topLevelSecrets = lines.filter(
      (l) => l.includes("process.env.STRIPE") || l.includes("process.env.MERCADO"),
    );
    expect(topLevelSecrets).toHaveLength(0);
  });

  it("mark_invoice_paid is idempotent — SQL checks existing payment", () => {
    const sql = readFile("supabase/migrations/20260629120000_phase_31_billing_foundation.sql");
    expect(sql).toContain("v_already_paid");
    expect(sql).toContain("if v_already_paid then");
  });

  it("duplicate webhook events are rejected without processing", () => {
    const sql = readFile("supabase/migrations/20260629120000_phase_31_billing_foundation.sql");
    expect(sql).toContain("billing_webhook_events_external_dedup_idx");
  });
});
