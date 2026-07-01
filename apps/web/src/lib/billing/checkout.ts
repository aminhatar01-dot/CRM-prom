import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveProvider } from "./providers";

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreditPackage = {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  currency: string;
  enabled: boolean;
  sort_order: number;
};

export type CheckoutSession = {
  id: string;
  organization_id: string;
  provider: string;
  session_type: string;
  plan_id: string | null;
  credits_amount: number;
  status: string;
  checkout_url: string | null;
  success_url: string | null;
  cancel_url: string | null;
  invoice_id: string | null;
  expires_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type PlanUpgradeRequest = {
  id: string;
  organization_id: string;
  requested_by: string;
  current_plan_id: string | null;
  target_plan_id: string;
  billing_cycle: string;
  status: string;
  notes: string;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
};

// ─── Credit packages ──────────────────────────────────────────────────────────

export async function listCreditPackages(adminSupabase: SupabaseClient): Promise<CreditPackage[]> {
  const { data } = await adminSupabase
    .from("credit_packages")
    .select("*")
    .eq("enabled", true)
    .order("sort_order");
  return (data ?? []) as CreditPackage[];
}

// ─── Checkout sessions ────────────────────────────────────────────────────────

export async function createCheckoutSession(
  adminSupabase: SupabaseClient,
  params: {
    orgId: string;
    sessionType: "plan_upgrade" | "credit_purchase";
    planId?: string;
    creditsAmount?: number;
    amountCents: number;
    currency?: string;
    successUrl?: string;
    cancelUrl?: string;
  },
): Promise<{ sessionId: string; checkoutUrl: string | null; provider: string }> {
  const provider = getActiveProvider();

  const { data, error } = await adminSupabase.rpc("billing_create_checkout_session", {
    p_organization_id: params.orgId,
    p_session_type:    params.sessionType,
    p_plan_id:         params.planId ?? null,
    p_credits_amount:  params.creditsAmount ?? 0,
    p_amount_cents:    params.amountCents,
    p_currency:        params.currency ?? "USD",
    p_provider:        provider,
    p_success_url:     params.successUrl ?? null,
    p_cancel_url:      params.cancelUrl ?? null,
  });
  if (error) throw new Error(error.message);

  const sessionId = data as string;
  let checkoutUrl: string | null = null;

  if (provider === "mercado_pago") {
    checkoutUrl = await createMercadoPagoPreference(adminSupabase, sessionId, params);
  } else if (provider === "stripe") {
    checkoutUrl = await createStripeCheckoutSession(adminSupabase, sessionId, params);
  }

  return { sessionId, checkoutUrl, provider };
}

async function createMercadoPagoPreference(
  adminSupabase: SupabaseClient,
  sessionId: string,
  params: { orgId: string; amountCents: number; currency?: string; successUrl?: string; cancelUrl?: string },
): Promise<string | null> {
  const accessToken = process.env.MERCADO_PAGO_ACCESS_TOKEN;
  if (!accessToken) return null;

  try {
    const amount = params.amountCents / 100;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

    const res = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: [{ title: "CRM PRO AI", quantity: 1, unit_price: amount, currency_id: (params.currency ?? "USD") }],
        external_reference: sessionId,
        back_urls: {
          success: params.successUrl ?? `${appUrl}/settings/billing?success=1`,
          failure: params.cancelUrl  ?? `${appUrl}/settings/billing?cancelled=1`,
          pending: params.successUrl ?? `${appUrl}/settings/billing?pending=1`,
        },
        auto_return: "approved",
        notification_url: `${appUrl}/api/webhooks/billing/mercado-pago`,
      }),
    });
    if (!res.ok) return null;

    const body = await res.json() as { init_point?: string; id?: string };
    const checkoutUrl = body.init_point ?? null;
    const externalId  = body.id ? String(body.id) : null;

    if (checkoutUrl || externalId) {
      await adminSupabase
        .from("billing_checkout_sessions")
        .update({ checkout_url: checkoutUrl, external_id: externalId, updated_at: new Date().toISOString() })
        .eq("id", sessionId);
    }
    return checkoutUrl;
  } catch {
    return null;
  }
}

async function createStripeCheckoutSession(
  adminSupabase: SupabaseClient,
  sessionId: string,
  params: { orgId: string; amountCents: number; currency?: string; successUrl?: string; cancelUrl?: string },
): Promise<string | null> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const body   = new URLSearchParams({
      "payment_method_types[]":                             "card",
      "line_items[0][price_data][currency]":                (params.currency ?? "USD").toLowerCase(),
      "line_items[0][price_data][unit_amount]":             String(params.amountCents),
      "line_items[0][price_data][product_data][name]":      "CRM PRO AI",
      "line_items[0][quantity]":                            "1",
      mode:                                                 "payment",
      success_url:                                          params.successUrl ?? `${appUrl}/settings/billing?success=1`,
      cancel_url:                                           params.cancelUrl  ?? `${appUrl}/settings/billing?cancelled=1`,
      "metadata[session_id]":                               sessionId,
      "metadata[organization_id]":                          params.orgId,
    });

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });
    if (!res.ok) return null;

    const data = await res.json() as { url?: string; id?: string };
    const checkoutUrl = data.url ?? null;
    const externalId  = data.id  ?? null;

    if (checkoutUrl || externalId) {
      await adminSupabase
        .from("billing_checkout_sessions")
        .update({ checkout_url: checkoutUrl, external_id: externalId, updated_at: new Date().toISOString() })
        .eq("id", sessionId);
    }
    return checkoutUrl;
  } catch {
    return null;
  }
}

export async function completeCheckoutSession(
  adminSupabase: SupabaseClient,
  sessionId: string,
  adminUserId: string,
  idempotencyKey?: string,
): Promise<{ success: boolean; credits_granted: number; idempotent?: boolean }> {
  const { data, error } = await adminSupabase.rpc("billing_complete_checkout", {
    p_session_id:      sessionId,
    p_admin_user_id:   adminUserId,
    p_idempotency_key: idempotencyKey ?? null,
  });
  if (error) throw new Error(error.message);
  return data as { success: boolean; credits_granted: number; idempotent?: boolean };
}

export async function listOrgCheckoutSessions(
  adminSupabase: SupabaseClient,
  orgId: string,
): Promise<CheckoutSession[]> {
  const { data } = await adminSupabase
    .from("billing_checkout_sessions")
    .select("*")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as CheckoutSession[];
}

export async function listAllCheckoutSessions(adminSupabase: SupabaseClient) {
  const { data } = await adminSupabase
    .from("billing_checkout_sessions")
    .select("*, organizations(name, slug), plans(name, slug)")
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

// ─── Upgrade requests ─────────────────────────────────────────────────────────

export async function createUpgradeRequest(
  adminSupabase: SupabaseClient,
  orgId: string,
  userId: string,
  targetPlanId: string,
  currentPlanId: string | null,
  billingCycle: "monthly" | "annual",
): Promise<string> {
  const { data, error } = await adminSupabase
    .from("plan_upgrade_requests")
    .insert({
      organization_id: orgId,
      requested_by:    userId,
      target_plan_id:  targetPlanId,
      current_plan_id: currentPlanId,
      billing_cycle:   billingCycle,
      status:          "pending",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

export async function approveUpgradeRequest(
  adminSupabase: SupabaseClient,
  requestId: string,
  adminUserId: string,
): Promise<void> {
  const { error } = await adminSupabase.rpc("billing_approve_upgrade_request", {
    p_request_id:    requestId,
    p_admin_user_id: adminUserId,
  });
  if (error) throw new Error(error.message);
}

export async function rejectUpgradeRequest(
  adminSupabase: SupabaseClient,
  requestId: string,
  notes: string,
): Promise<void> {
  const { error } = await adminSupabase
    .from("plan_upgrade_requests")
    .update({ status: "rejected", notes, updated_at: new Date().toISOString() })
    .eq("id", requestId);
  if (error) throw new Error(error.message);
}

export async function listAllUpgradeRequests(adminSupabase: SupabaseClient) {
  const { data } = await adminSupabase
    .from("plan_upgrade_requests")
    .select("*, organizations(name, slug), target_plan:plans!target_plan_id(name, slug)")
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function listOrgUpgradeRequests(
  adminSupabase: SupabaseClient,
  orgId: string,
) {
  const { data } = await adminSupabase
    .from("plan_upgrade_requests")
    .select("*, target_plan:plans!target_plan_id(name, slug)")
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(20);
  return data ?? [];
}

// ─── Plans for display ────────────────────────────────────────────────────────

export type PublicPlan = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_credits: number;
  max_members: number | null;
  max_assistants: number | null;
  price_usd_monthly: number;
  price_usd_annual: number;
  is_public: boolean;
  sort_order: number;
  features: Record<string, unknown>;
};

export async function listPublicPlans(adminSupabase: SupabaseClient): Promise<PublicPlan[]> {
  const { data } = await adminSupabase
    .from("plans")
    .select("id, name, slug, description, monthly_credits, max_members, max_assistants, price_usd_monthly, price_usd_annual, is_public, sort_order, features")
    .eq("active", true)
    .eq("is_public", true)
    .order("sort_order");
  return (data ?? []) as PublicPlan[];
}
