"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/admin/auth";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import {
  createManualInvoice,
  markInvoicePaid,
  listOrgInvoices,
  listAllInvoices,
  listOrgPayments,
  getOrgBillingSubscription,
  getBillingCustomer,
  getOrCreateBillingCustomer,
  createOrUpdateBillingSubscription,
  suspendOrg,
  reactivateOrg,
  listRecentWebhookEvents,
} from "@/lib/billing/core";
import { revalidatePath } from "next/cache";

// ─── Admin actions (require super_admin) ──────────────────────────────────────

export async function adminGetOrgBilling(orgId: string) {
  await requireSuperAdmin();
  const adminSupabase = createAdminClient();
  const [customer, subscription, invoices, payments] = await Promise.all([
    getBillingCustomer(adminSupabase, orgId),
    getOrgBillingSubscription(adminSupabase, orgId),
    listOrgInvoices(adminSupabase, orgId, 20),
    listOrgPayments(adminSupabase, orgId, 20),
  ]);
  return { customer, subscription, invoices, payments };
}

export async function adminListAllInvoices() {
  await requireSuperAdmin();
  const adminSupabase = createAdminClient();
  return listAllInvoices(adminSupabase, 50);
}

export async function adminListWebhookEvents() {
  await requireSuperAdmin();
  const adminSupabase = createAdminClient();
  return listRecentWebhookEvents(adminSupabase, 30);
}

export async function adminCreateManualInvoice(formData: FormData) {
  const { user } = await requireSuperAdmin();
  const orgId       = formData.get("org_id") as string;
  const amountStr   = formData.get("amount_usd") as string;
  const description = formData.get("description") as string;
  const planSlug    = formData.get("plan_slug") as string | null;

  if (!orgId || !amountStr || !description?.trim()) {
    throw new Error("org_id, amount_usd, and description are required");
  }

  const amountCents = Math.round(parseFloat(amountStr) * 100);
  if (isNaN(amountCents) || amountCents <= 0) throw new Error("Invalid amount");

  const adminSupabase = createAdminClient();

  // Ensure customer exists
  const customerId = await getOrCreateBillingCustomer(adminSupabase, orgId);

  // Get or create subscription if plan specified
  let subscriptionId: string | undefined;
  if (planSlug) {
    const { data: plan } = await adminSupabase
      .from("plans")
      .select("id")
      .eq("slug", planSlug)
      .single();
    if (plan) {
      subscriptionId = await createOrUpdateBillingSubscription(
        adminSupabase, orgId, customerId, plan.id,
      );
    }
  }

  await createManualInvoice(adminSupabase, {
    orgId,
    amountCents,
    description,
    subscriptionId,
    createdBy: user.id,
  });

  revalidatePath(`/admin/organizations/${orgId}`);
  revalidatePath("/admin/billing");
}

export async function adminMarkInvoicePaid(formData: FormData) {
  const { user } = await requireSuperAdmin();
  const invoiceId = formData.get("invoice_id") as string;
  const notes     = (formData.get("notes") as string) ?? "";
  const method    = (formData.get("method") as string) ?? "manual";
  const orgId     = formData.get("org_id") as string;

  if (!invoiceId) throw new Error("invoice_id required");

  const adminSupabase = createAdminClient();
  const idempotencyKey = `admin-pay-${invoiceId}`;

  await markInvoicePaid(adminSupabase, invoiceId, user.id, method, notes, idempotencyKey);

  revalidatePath(`/admin/organizations/${orgId}`);
  revalidatePath("/admin/billing");
}

export async function adminSuspendOrg(formData: FormData) {
  const { user } = await requireSuperAdmin();
  const orgId  = formData.get("org_id") as string;
  const reason = (formData.get("reason") as string) ?? "past_due";
  if (!orgId) throw new Error("org_id required");

  const adminSupabase = createAdminClient();
  await suspendOrg(adminSupabase, orgId, reason, user.id);

  revalidatePath(`/admin/organizations/${orgId}`);
  revalidatePath("/admin/billing");
}

export async function adminReactivateOrg(formData: FormData) {
  const { user } = await requireSuperAdmin();
  const orgId = formData.get("org_id") as string;
  if (!orgId) throw new Error("org_id required");

  const adminSupabase = createAdminClient();
  await reactivateOrg(adminSupabase, orgId, user.id);

  revalidatePath(`/admin/organizations/${orgId}`);
  revalidatePath("/admin/billing");
}

// ─── Client actions (authenticated user, own org only) ───────────────────────

export async function getMyBillingStatus() {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);

  const adminSupabase = createAdminClient();
  const [subscription, invoices, payments] = await Promise.all([
    getOrgBillingSubscription(adminSupabase, org.id),
    listOrgInvoices(adminSupabase, org.id, 10),
    listOrgPayments(adminSupabase, org.id, 5),
  ]);

  const { data: wallet } = await supabase
    .from("ai_credit_wallets")
    .select("available_credits, lifetime_credits_used")
    .eq("organization_id", org.id)
    .maybeSingle();

  const { data: orgSub } = await supabase
    .from("organization_subscriptions")
    .select(`status, commercial_status, current_period_end, plans(name, slug, monthly_credits)`)
    .eq("organization_id", org.id)
    .maybeSingle();

  return {
    subscription,
    invoices,
    payments,
    wallet: wallet ?? null,
    orgSubscription: orgSub ?? null,
  };
}

// ─── FASE 36: Self-service checkout ──────────────────────────────────────────

import {
  listCreditPackages,
  listPublicPlans,
  createCheckoutSession,
  completeCheckoutSession,
  createUpgradeRequest,
  approveUpgradeRequest,
  rejectUpgradeRequest,
  listAllUpgradeRequests,
  listOrgUpgradeRequests,
  listAllCheckoutSessions,
  listOrgCheckoutSessions,
} from "@/lib/billing/checkout";
import { logEvent } from "@/lib/observability/event-log";

export async function getPlansAndCredits() {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);

  const adminSupabase = createAdminClient();
  const [plans, packages, upgradeRequests, checkoutSessions] = await Promise.all([
    listPublicPlans(adminSupabase),
    listCreditPackages(adminSupabase),
    listOrgUpgradeRequests(adminSupabase, org.id),
    listOrgCheckoutSessions(adminSupabase, org.id),
  ]);

  const { data: wallet } = await supabase
    .from("ai_credit_wallets")
    .select("available_credits, lifetime_credits_used")
    .eq("organization_id", org.id)
    .maybeSingle();

  const { data: orgSub } = await supabase
    .from("organization_subscriptions")
    .select("status, commercial_status, current_period_end, plans(id, name, slug, monthly_credits, price_usd_monthly, price_usd_annual)")
    .eq("organization_id", org.id)
    .maybeSingle();

  return {
    plans,
    packages,
    upgradeRequests,
    checkoutSessions,
    wallet: wallet ?? null,
    orgSubscription: orgSub ?? null,
    orgId: org.id,
  };
}

export async function requestPlanUpgrade(formData: FormData): Promise<{ checkoutUrl: string | null; provider: string; requestId: string }> {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);

  const targetPlanId  = formData.get("plan_id") as string;
  const billingCycle  = (formData.get("billing_cycle") as "monthly" | "annual") ?? "monthly";

  if (!targetPlanId) throw new Error("Plan requerido");

  const adminSupabase = createAdminClient();

  // Get current plan id
  const { data: orgSub } = await adminSupabase
    .from("organization_subscriptions")
    .select("plan_id")
    .eq("organization_id", org.id)
    .maybeSingle();

  const currentPlanId = (orgSub as { plan_id?: string } | null)?.plan_id ?? null;

  // Get target plan
  const { data: plan } = await adminSupabase
    .from("plans")
    .select("id, name, slug, price_usd_monthly, price_usd_annual")
    .eq("id", targetPlanId)
    .single();

  if (!plan) throw new Error("Plan no encontrado");

  const typedPlan = plan as { id: string; name: string; slug: string; price_usd_monthly: number; price_usd_annual: number };
  const priceUsd   = billingCycle === "annual" ? typedPlan.price_usd_annual : typedPlan.price_usd_monthly;
  const amountCents = Math.round(priceUsd * 100);

  // Check for existing pending request
  const { data: existing } = await adminSupabase
    .from("plan_upgrade_requests")
    .select("id")
    .eq("organization_id", org.id)
    .eq("target_plan_id", targetPlanId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) throw new Error("Ya tienes una solicitud pendiente para este plan");

  const { checkoutUrl, sessionId, provider } = await createCheckoutSession(adminSupabase, {
    orgId:        org.id,
    sessionType:  "plan_upgrade",
    planId:       targetPlanId,
    amountCents:  amountCents > 0 ? amountCents : 0,
    billingCycle,
  } as Parameters<typeof createCheckoutSession>[1] & { billingCycle?: string });

  const requestId = await createUpgradeRequest(
    adminSupabase, org.id, user.id, targetPlanId, currentPlanId, billingCycle,
  );

  // Link session to request if created
  if (sessionId) {
    await adminSupabase
      .from("plan_upgrade_requests")
      .update({ checkout_session_id: sessionId, status: provider !== "manual" ? "checkout_pending" : "pending" })
      .eq("id", requestId);
  }

  await logEvent(adminSupabase, {
    eventType: "plan_upgrade_requested",
    organizationId: org.id,
    severity: "info",
    source: "billing",
    metadata: { target_plan: typedPlan.slug, billing_cycle: billingCycle, provider, user_id: user.id },
  });

  return { checkoutUrl, provider, requestId };
}

export async function purchaseCredits(formData: FormData): Promise<{ checkoutUrl: string | null; provider: string; sessionId: string }> {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);

  const packageId = formData.get("package_id") as string;
  if (!packageId) throw new Error("Paquete requerido");

  const adminSupabase = createAdminClient();

  const { data: pkg } = await adminSupabase
    .from("credit_packages")
    .select("*")
    .eq("id", packageId)
    .eq("enabled", true)
    .single();

  if (!pkg) throw new Error("Paquete no encontrado o deshabilitado");

  const typedPkg = pkg as { id: string; name: string; credits: number; price_cents: number; currency: string };

  const { checkoutUrl, sessionId, provider } = await createCheckoutSession(adminSupabase, {
    orgId:         org.id,
    sessionType:   "credit_purchase",
    creditsAmount: typedPkg.credits,
    amountCents:   typedPkg.price_cents,
    currency:      typedPkg.currency,
  });

  await logEvent(adminSupabase, {
    eventType: "credit_purchase_initiated",
    organizationId: org.id,
    severity: "info",
    source: "billing",
    metadata: { package: typedPkg.name, credits: typedPkg.credits, provider, user_id: user.id },
  });

  return { checkoutUrl, provider, sessionId };
}

// ─── Admin FASE 36 ────────────────────────────────────────────────────────────

export async function adminGetCheckoutSessions() {
  await requireSuperAdmin();
  const adminSupabase = createAdminClient();
  return listAllCheckoutSessions(adminSupabase);
}

export async function adminGetUpgradeRequests() {
  await requireSuperAdmin();
  const adminSupabase = createAdminClient();
  return listAllUpgradeRequests(adminSupabase);
}

export async function adminApproveUpgradeRequest(formData: FormData) {
  const { user } = await requireSuperAdmin();
  const requestId = formData.get("request_id") as string;
  if (!requestId) throw new Error("request_id required");

  const adminSupabase = createAdminClient();
  await approveUpgradeRequest(adminSupabase, requestId, user.id);
  revalidatePath("/admin/billing");
}

export async function adminRejectUpgradeRequest(formData: FormData) {
  await requireSuperAdmin();
  const requestId = formData.get("request_id") as string;
  const notes     = (formData.get("notes") as string) ?? "";
  if (!requestId) throw new Error("request_id required");

  const adminSupabase = createAdminClient();
  await rejectUpgradeRequest(adminSupabase, requestId, notes);
  revalidatePath("/admin/billing");
}

export async function adminCompleteCheckoutSession(formData: FormData) {
  const { user } = await requireSuperAdmin();
  const sessionId = formData.get("session_id") as string;
  if (!sessionId) throw new Error("session_id required");

  const adminSupabase = createAdminClient();
  const result = await completeCheckoutSession(adminSupabase, sessionId, user.id);
  revalidatePath("/admin/billing");
  return result;
}
