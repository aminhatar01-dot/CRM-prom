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
