import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingCustomer, BillingInvoice, BillingPayment, BillingSubscription } from "./types";

// ─── Customer ─────────────────────────────────────────────────────────────────

export async function getOrCreateBillingCustomer(
  adminSupabase: SupabaseClient,
  orgId: string,
  email?: string,
  name?: string,
): Promise<string> {
  const { data } = await adminSupabase.rpc("billing_get_or_create_customer", {
    p_organization_id: orgId,
    p_provider:        "manual",
    p_email:           email ?? null,
    p_name:            name ?? null,
  });
  return data as string;
}

export async function getBillingCustomer(
  adminSupabase: SupabaseClient,
  orgId: string,
): Promise<BillingCustomer | null> {
  const { data } = await adminSupabase
    .from("billing_customers")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle();
  return data as BillingCustomer | null;
}

// ─── Subscription ─────────────────────────────────────────────────────────────

export async function getOrgBillingSubscription(
  adminSupabase: SupabaseClient,
  orgId: string,
): Promise<(BillingSubscription & { plan?: { name: string; slug: string; monthly_credits: number } | null }) | null> {
  const { data } = await adminSupabase
    .from("billing_subscriptions")
    .select(`*, plans(name, slug, monthly_credits)`)
    .eq("organization_id", orgId)
    .maybeSingle();
  return data as (BillingSubscription & { plan?: { name: string; slug: string; monthly_credits: number } | null }) | null;
}

export async function createOrUpdateBillingSubscription(
  adminSupabase: SupabaseClient,
  orgId: string,
  customerId: string,
  planId: string | null,
  billingCycle: "monthly" | "annual" | "one_time" = "monthly",
): Promise<string> {
  const { data: existing } = await adminSupabase
    .from("billing_subscriptions")
    .select("id")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (existing) {
    await adminSupabase
      .from("billing_subscriptions")
      .update({ plan_id: planId, billing_cycle: billingCycle, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data } = await adminSupabase
    .from("billing_subscriptions")
    .insert({
      organization_id:    orgId,
      billing_customer_id: customerId,
      plan_id:            planId,
      provider:           "manual",
      status:             "trialing",
      billing_cycle:      billingCycle,
    })
    .select("id")
    .single();

  return (data as { id: string }).id;
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

export async function createManualInvoice(
  adminSupabase: SupabaseClient,
  params: {
    orgId: string;
    amountCents: number;
    description: string;
    currency?: string;
    periodStart?: Date;
    periodEnd?: Date;
    dueDate?: Date;
    subscriptionId?: string;
    lineItems?: unknown[];
    createdBy?: string;
  },
): Promise<string> {
  const { data } = await adminSupabase.rpc("billing_create_invoice", {
    p_organization_id:         params.orgId,
    p_amount_cents:            params.amountCents,
    p_description:             params.description,
    p_currency:                params.currency ?? "USD",
    p_period_start:            params.periodStart?.toISOString() ?? null,
    p_period_end:              params.periodEnd?.toISOString() ?? null,
    p_due_date:                params.dueDate?.toISOString() ?? null,
    p_billing_subscription_id: params.subscriptionId ?? null,
    p_line_items:              JSON.stringify(params.lineItems ?? []),
    p_provider:                "manual",
    p_created_by:              params.createdBy ?? null,
  });
  return data as string;
}

export async function listOrgInvoices(
  adminSupabase: SupabaseClient,
  orgId: string,
  limit = 20,
): Promise<BillingInvoice[]> {
  const { data } = await adminSupabase
    .from("billing_invoices")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as BillingInvoice[];
}

export async function listAllInvoices(
  adminSupabase: SupabaseClient,
  limit = 50,
): Promise<(BillingInvoice & { organizations?: { name: string; slug: string } | null })[]> {
  const { data } = await adminSupabase
    .from("billing_invoices")
    .select(`*, organizations(name, slug)`)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as (BillingInvoice & { organizations?: { name: string; slug: string } | null })[];
}

export async function markInvoicePaid(
  adminSupabase: SupabaseClient,
  invoiceId: string,
  adminUserId: string,
  method = "manual",
  notes = "",
  idempotencyKey?: string,
): Promise<{ success: boolean; payment_id?: string; credits_granted?: number; idempotent?: boolean }> {
  const { data, error } = await adminSupabase.rpc("billing_mark_invoice_paid", {
    p_invoice_id:      invoiceId,
    p_admin_user_id:   adminUserId,
    p_payment_method:  method,
    p_notes:           notes,
    p_idempotency_key: idempotencyKey ?? null,
  });
  if (error) throw new Error(error.message);
  return data as { success: boolean; payment_id?: string; credits_granted?: number; idempotent?: boolean };
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function listOrgPayments(
  adminSupabase: SupabaseClient,
  orgId: string,
  limit = 20,
): Promise<BillingPayment[]> {
  const { data } = await adminSupabase
    .from("billing_payments")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as BillingPayment[];
}

// ─── Suspend / Reactivate ─────────────────────────────────────────────────────

export async function suspendOrg(
  adminSupabase: SupabaseClient,
  orgId: string,
  reason = "past_due",
  adminUserId?: string,
): Promise<void> {
  const { error } = await adminSupabase.rpc("billing_suspend_org", {
    p_organization_id: orgId,
    p_reason:          reason,
    p_admin_user_id:   adminUserId ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function reactivateOrg(
  adminSupabase: SupabaseClient,
  orgId: string,
  adminUserId?: string,
): Promise<void> {
  const { error } = await adminSupabase.rpc("billing_reactivate_org", {
    p_organization_id: orgId,
    p_admin_user_id:   adminUserId ?? null,
  });
  if (error) throw new Error(error.message);
}

// ─── Webhook events ───────────────────────────────────────────────────────────

export async function recordWebhookEvent(
  adminSupabase: SupabaseClient,
  provider: string,
  externalId: string | null,
  eventType: string,
  payload: Record<string, unknown>,
  orgId?: string,
): Promise<{ event_id?: string; duplicate: boolean }> {
  const { data, error } = await adminSupabase.rpc("billing_record_webhook", {
    p_provider:    provider,
    p_external_id: externalId ?? null,
    p_event_type:  eventType,
    p_payload:     payload,
    p_org_id:      orgId ?? null,
  });
  if (error) throw new Error(error.message);
  return data as { event_id?: string; duplicate: boolean };
}

export async function listRecentWebhookEvents(
  adminSupabase: SupabaseClient,
  limit = 30,
) {
  const { data } = await adminSupabase
    .from("billing_webhook_events")
    .select("id, provider, event_type, processed, created_at, error_message")
    .order("created_at", { ascending: false })
    .limit(limit);
  return data ?? [];
}
