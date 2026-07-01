import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../../../");

function readSrc(rel: string) {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("FASE 36 — Self-Service Checkout contracts", () => {
  // ─── Migration ────────────────────────────────────────────────────────────────

  describe("migration: phase_36_self_service_checkout.sql", () => {
    const sql = readSrc("supabase/migrations/20260701000000_phase_36_self_service_checkout.sql");

    it("adds session_type to billing_checkout_sessions", () => {
      expect(sql).toContain("session_type");
    });

    it("adds credits_amount to billing_checkout_sessions", () => {
      expect(sql).toContain("credits_amount");
    });

    it("adds invoice_id to billing_checkout_sessions", () => {
      expect(sql).toContain("invoice_id");
    });

    it("creates credit_packages table", () => {
      expect(sql).toContain("create table if not exists public.credit_packages");
    });

    it("credit_packages has credits and price_cents columns", () => {
      expect(sql).toContain("credits");
      expect(sql).toContain("price_cents");
    });

    it("seeds 3 standard credit packages", () => {
      expect(sql).toContain("10000");
      expect(sql).toContain("50000");
      expect(sql).toContain("100000");
    });

    it("creates plan_upgrade_requests table", () => {
      expect(sql).toContain("create table if not exists public.plan_upgrade_requests");
    });

    it("plan_upgrade_requests has status check with pending and approved", () => {
      expect(sql).toContain("pending");
      expect(sql).toContain("approved");
    });

    it("plan_upgrade_requests has billing_cycle column", () => {
      expect(sql).toContain("billing_cycle");
    });

    it("enables RLS on credit_packages", () => {
      expect(sql).toContain("alter table public.credit_packages enable row level security");
    });

    it("enables RLS on plan_upgrade_requests", () => {
      expect(sql).toContain("alter table public.plan_upgrade_requests enable row level security");
    });

    it("org members can read their own upgrade requests (RLS)", () => {
      expect(sql).toContain("is_org_member(organization_id)");
    });

    it("creates billing_create_checkout_session function", () => {
      expect(sql).toContain("billing_create_checkout_session");
    });

    it("creates billing_complete_checkout function", () => {
      expect(sql).toContain("billing_complete_checkout");
    });

    it("creates billing_approve_upgrade_request function", () => {
      expect(sql).toContain("billing_approve_upgrade_request");
    });

    it("complete_checkout grants credits for credit_purchase sessions", () => {
      expect(sql).toContain("credit_purchase");
      expect(sql).toContain("admin_load_credits");
    });

    it("complete_checkout applies plan upgrade for plan_upgrade sessions", () => {
      expect(sql).toContain("admin_set_subscription");
    });

    it("adds price_usd_annual to plans", () => {
      expect(sql).toContain("price_usd_annual");
    });
  });

  // ─── checkout.ts ─────────────────────────────────────────────────────────────

  describe("lib/billing/checkout.ts", () => {
    const src = readSrc("apps/web/src/lib/billing/checkout.ts");

    it("exports listCreditPackages", () => {
      expect(src).toContain("export async function listCreditPackages");
    });

    it("exports createCheckoutSession", () => {
      expect(src).toContain("export async function createCheckoutSession");
    });

    it("exports completeCheckoutSession", () => {
      expect(src).toContain("export async function completeCheckoutSession");
    });

    it("exports createUpgradeRequest", () => {
      expect(src).toContain("export async function createUpgradeRequest");
    });

    it("exports approveUpgradeRequest", () => {
      expect(src).toContain("export async function approveUpgradeRequest");
    });

    it("exports rejectUpgradeRequest", () => {
      expect(src).toContain("export async function rejectUpgradeRequest");
    });

    it("exports listPublicPlans", () => {
      expect(src).toContain("export async function listPublicPlans");
    });

    it("exports listAllUpgradeRequests", () => {
      expect(src).toContain("export async function listAllUpgradeRequests");
    });

    it("exports listOrgCheckoutSessions", () => {
      expect(src).toContain("export async function listOrgCheckoutSessions");
    });

    it("createCheckoutSession dispatches to MP if configured", () => {
      expect(src).toContain("createMercadoPagoPreference");
    });

    it("createCheckoutSession dispatches to Stripe if configured", () => {
      expect(src).toContain("createStripeCheckoutSession");
    });

    it("createCheckoutSession calls billing_create_checkout_session RPC", () => {
      expect(src).toContain("billing_create_checkout_session");
    });

    it("completeCheckoutSession calls billing_complete_checkout RPC", () => {
      expect(src).toContain("billing_complete_checkout");
    });

    it("approveUpgradeRequest calls billing_approve_upgrade_request RPC", () => {
      expect(src).toContain("billing_approve_upgrade_request");
    });

    it("MP preference uses external_reference for session tracking", () => {
      expect(src).toContain("external_reference: sessionId");
    });

    it("Stripe checkout uses metadata.session_id for session tracking", () => {
      expect(src).toContain("session_id");
      expect(src).toContain("sessionId");
    });

    it("MP and Stripe creation errors are caught without throwing", () => {
      const catchCount = (src.match(/} catch \{/g) ?? []).length;
      expect(catchCount).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── billing.ts actions ───────────────────────────────────────────────────────

  describe("actions/billing.ts", () => {
    const src = readSrc("apps/web/src/app/actions/billing.ts");

    it("exports getPlansAndCredits", () => {
      expect(src).toContain("export async function getPlansAndCredits");
    });

    it("exports requestPlanUpgrade", () => {
      expect(src).toContain("export async function requestPlanUpgrade");
    });

    it("exports purchaseCredits", () => {
      expect(src).toContain("export async function purchaseCredits");
    });

    it("exports adminGetUpgradeRequests", () => {
      expect(src).toContain("export async function adminGetUpgradeRequests");
    });

    it("exports adminApproveUpgradeRequest", () => {
      expect(src).toContain("export async function adminApproveUpgradeRequest");
    });

    it("exports adminRejectUpgradeRequest", () => {
      expect(src).toContain("export async function adminRejectUpgradeRequest");
    });

    it("exports adminCompleteCheckoutSession", () => {
      expect(src).toContain("export async function adminCompleteCheckoutSession");
    });

    it("exports adminGetCheckoutSessions", () => {
      expect(src).toContain("export async function adminGetCheckoutSessions");
    });

    it("requestPlanUpgrade blocks duplicate pending requests", () => {
      expect(src).toContain("Ya tienes una solicitud pendiente para este plan");
    });

    it("requestPlanUpgrade creates checkout session", () => {
      expect(src).toContain("createCheckoutSession");
    });

    it("requestPlanUpgrade creates upgrade request", () => {
      expect(src).toContain("createUpgradeRequest");
    });

    it("purchaseCredits validates package exists and is enabled", () => {
      expect(src).toContain("Paquete no encontrado o deshabilitado");
    });

    it("admin actions require super admin", () => {
      expect(src).toContain("requireSuperAdmin");
    });

    it("events logged to event_logs", () => {
      expect(src).toContain("plan_upgrade_requested");
      expect(src).toContain("credit_purchase_initiated");
    });
  });

  // ─── Settings/plan page ───────────────────────────────────────────────────────

  describe("settings/plan/page.tsx", () => {
    const src = readSrc("apps/web/src/app/(crm)/settings/plan/page.tsx");

    it("shows current plan", () => {
      expect(src).toContain("Plan actual");
    });

    it("shows available plans grid", () => {
      expect(src).toContain("Planes disponibles");
    });

    it("shows upgrade request form", () => {
      expect(src).toContain("requestPlanUpgrade");
    });

    it("shows upgrade requests history", () => {
      expect(src).toContain("Solicitudes de cambio de plan");
    });

    it("shows provider notice when no provider configured", () => {
      expect(src).toContain("checkout automatico no esta configurado");
    });

    it("blocks double submit when pending request exists", () => {
      expect(src).toContain("disabled={!!pendingRequest}");
    });

    it("links to buy credits page", () => {
      expect(src).toContain("/settings/credits/buy");
    });

    it("shows annual discount info", () => {
      expect(src).toContain("ahorra");
    });
  });

  // ─── Settings/credits/buy page ────────────────────────────────────────────────

  describe("settings/credits/buy/page.tsx", () => {
    const src = readSrc("apps/web/src/app/(crm)/settings/credits/buy/page.tsx");

    it("shows available credits balance", () => {
      expect(src).toContain("Creditos disponibles");
    });

    it("shows low credits warning", () => {
      expect(src).toContain("Tus creditos estan bajos");
    });

    it("shows packages grid", () => {
      expect(src).toContain("Paquetes disponibles");
    });

    it("shows price per credit", () => {
      expect(src).toContain("centavos por credito");
    });

    it("shows provider notice when manual mode", () => {
      expect(src).toContain("checkout automatico no esta configurado");
    });

    it("shows recent purchases", () => {
      expect(src).toContain("Compras recientes");
    });

    it("calls purchaseCredits server action", () => {
      expect(src).toContain("purchaseCredits");
    });
  });

  // ─── Admin billing requests page ──────────────────────────────────────────────

  describe("admin/billing/requests/page.tsx", () => {
    const src = readSrc("apps/web/src/app/admin/billing/requests/page.tsx");

    it("shows upgrade requests list", () => {
      expect(src).toContain("Solicitudes de cambio de plan");
    });

    it("shows checkout sessions list", () => {
      expect(src).toContain("Checkout sessions");
    });

    it("has approve action button", () => {
      expect(src).toContain("Aprobar");
    });

    it("has reject action button", () => {
      expect(src).toContain("Rechazar");
    });

    it("has mark paid action for pending checkouts", () => {
      expect(src).toContain("Marcar pagado");
    });

    it("imports admin actions", () => {
      expect(src).toContain("adminApproveUpgradeRequest");
      expect(src).toContain("adminRejectUpgradeRequest");
      expect(src).toContain("adminCompleteCheckoutSession");
    });
  });

  // ─── Webhooks ─────────────────────────────────────────────────────────────────

  describe("webhook: stripe/route.ts", () => {
    const src = readSrc("apps/web/src/app/api/webhooks/billing/stripe/route.ts");

    it("returns not_configured when stripe not set up", () => {
      expect(src).toContain("not_configured");
    });

    it("validates stripe signature", () => {
      expect(src).toContain("verifyStripeSignature");
    });

    it("deduplicates events", () => {
      expect(src).toContain("duplicate");
    });

    it("processes checkout.session.completed events", () => {
      expect(src).toContain("checkout.session.completed");
    });

    it("processes invoice.paid events", () => {
      expect(src).toContain("invoice.paid");
    });

    it("calls completeCheckoutSession on successful payment", () => {
      expect(src).toContain("completeCheckoutSession");
    });

    it("marks webhook event as processed", () => {
      expect(src).toContain("processed: true");
    });

    it("stores errors on webhook events on failure", () => {
      expect(src).toContain("error_message");
    });
  });

  describe("webhook: mercado-pago/route.ts", () => {
    const src = readSrc("apps/web/src/app/api/webhooks/billing/mercado-pago/route.ts");

    it("returns not_configured when MP not set up", () => {
      expect(src).toContain("not_configured");
    });

    it("validates MP signature", () => {
      expect(src).toContain("verifyMercadoPagoSignature");
    });

    it("fetches payment details to get external_reference", () => {
      expect(src).toContain("external_reference");
    });

    it("calls completeCheckoutSession for approved payments", () => {
      expect(src).toContain("completeCheckoutSession");
    });

    it("uses idempotency key per payment", () => {
      expect(src).toContain("idempotencyKey");
    });
  });

  // ─── Navigation ───────────────────────────────────────────────────────────────

  describe("navigation/main-nav.ts", () => {
    const src = readSrc("apps/web/src/lib/navigation/main-nav.ts");

    it("includes settings/plan route", () => {
      expect(src).toContain("/settings/plan");
    });
  });
});
