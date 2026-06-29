"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireSuperAdmin } from "@/lib/admin/auth";
import { listAdminOrganizations, getAdminOrgDetail } from "@/lib/admin/organizations";
import { listPlans } from "@/lib/admin/plans";
import { revalidatePath } from "next/cache";
import { logEvent } from "@/lib/observability/event-log";

// ─── Organizations ────────────────────────────────────────────────────────────

export async function adminListOrganizations() {
  await requireSuperAdmin();
  const adminSupabase = createAdminClient();
  return listAdminOrganizations(adminSupabase);
}

export async function adminGetOrganization(orgId: string) {
  await requireSuperAdmin();
  const adminSupabase = createAdminClient();
  return getAdminOrgDetail(adminSupabase, orgId);
}

// ─── Plans ────────────────────────────────────────────────────────────────────

export async function adminListPlans() {
  await requireSuperAdmin();
  const adminSupabase = createAdminClient();
  return listPlans(adminSupabase);
}

// ─── Subscription management ──────────────────────────────────────────────────

export async function adminSetSubscription(formData: FormData) {
  const { user } = await requireSuperAdmin();
  const orgId           = formData.get("org_id") as string;
  const planSlug        = formData.get("plan_slug") as string;
  const status          = formData.get("status") as string;
  const commercialStatus = formData.get("commercial_status") as string | null;
  const internalNotes   = formData.get("internal_notes") as string | null;
  const trialEndsAt     = formData.get("trial_ends_at") as string | null;

  if (!orgId || !planSlug || !status) throw new Error("org_id, plan_slug, status required");

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase.rpc("admin_set_subscription", {
    p_organization_id:   orgId,
    p_plan_slug:         planSlug,
    p_status:            status,
    p_commercial_status: commercialStatus ?? null,
    p_internal_notes:    internalNotes ?? null,
    p_trial_ends_at:     trialEndsAt ?? null,
  });
  if (error) throw new Error(`Failed to set subscription: ${error.message}`);

  await adminSupabase.rpc("log_admin_action", {
    p_action:          "set_subscription",
    p_entity_type:     "organization_subscription",
    p_organization_id: orgId,
    p_after_state:     { plan_slug: planSlug, status, commercial_status: commercialStatus },
  });

  await logEvent(adminSupabase, {
    organizationId: orgId,
    severity:       "info",
    source:         "system",
    eventType:      "admin_subscription_changed",
    message:        `Admin ${user.email} changed subscription to plan=${planSlug} status=${status}`,
    entityType:     "organization",
    entityId:       orgId,
    metadata:       { plan_slug: planSlug, status },
  });

  revalidatePath("/admin/organizations");
  revalidatePath(`/admin/organizations/${orgId}`);
}

// ─── Credits ──────────────────────────────────────────────────────────────────

export async function adminLoadCredits(formData: FormData) {
  const { user } = await requireSuperAdmin();
  const orgId  = formData.get("org_id") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const reason = formData.get("reason") as string;

  if (!orgId) throw new Error("org_id required");
  if (!amount || amount <= 0) throw new Error("amount must be positive");
  if (!reason?.trim()) throw new Error("reason required");

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase.rpc("admin_load_credits", {
    p_organization_id: orgId,
    p_amount:          amount,
    p_reason:          reason,
    p_admin_user_id:   user.id,
  });
  if (error) throw new Error(`Failed to load credits: ${error.message}`);

  await adminSupabase.rpc("log_admin_action", {
    p_action:          "load_credits",
    p_entity_type:     "ai_credit_wallet",
    p_organization_id: orgId,
    p_after_state:     { amount, reason },
  });

  await logEvent(adminSupabase, {
    organizationId: orgId,
    severity:       "info",
    source:         "billing",
    eventType:      "admin_credits_loaded",
    message:        `Admin loaded ${amount} credits. Reason: ${reason}`,
    entityType:     "ai_credit_wallet",
    metadata:       { amount, reason },
  });

  revalidatePath(`/admin/organizations/${orgId}`);
  revalidatePath("/admin/credits");
}

export async function adminAdjustCredits(formData: FormData) {
  const { user } = await requireSuperAdmin();
  const orgId  = formData.get("org_id") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const reason = formData.get("reason") as string;

  if (!orgId || !reason?.trim()) throw new Error("org_id and reason required");

  const adminSupabase = createAdminClient();

  if (amount > 0) {
    const { error } = await adminSupabase.rpc("admin_load_credits", {
      p_organization_id: orgId,
      p_amount:          amount,
      p_reason:          `[ADJUSTMENT] ${reason}`,
      p_admin_user_id:   user.id,
    });
    if (error) throw new Error(error.message);
  } else {
    // Direct deduction via update (negative adjustment)
    const { data: wallet } = await adminSupabase
      .from("ai_credit_wallets")
      .select("available_credits, id")
      .eq("organization_id", orgId)
      .single();

    if (!wallet) throw new Error("Wallet not found");
    const newBalance = Math.max(0, Number(wallet.available_credits) + amount);

    await adminSupabase
      .from("ai_credit_wallets")
      .update({ available_credits: newBalance })
      .eq("organization_id", orgId);

    await adminSupabase.from("credit_adjustments").insert({
      organization_id: orgId,
      wallet_id:       wallet.id,
      amount:          amount,
      reason:          `[DEDUCTION] ${reason}`,
      adjusted_by:     user.id,
    });
  }

  revalidatePath(`/admin/organizations/${orgId}`);
  revalidatePath("/admin/credits");
}

export async function adminSetAdminExempt(formData: FormData) {
  await requireSuperAdmin();
  const orgId   = formData.get("org_id") as string;
  const exempt  = formData.get("exempt") === "true";

  const adminSupabase = createAdminClient();
  await adminSupabase
    .from("ai_credit_wallets")
    .update({ is_admin_exempt: exempt })
    .eq("organization_id", orgId);

  revalidatePath(`/admin/organizations/${orgId}`);
}

// ─── Credit usage overview ─────────────────────────────────────────────────────

export async function adminGetCreditsOverview() {
  await requireSuperAdmin();
  const adminSupabase = createAdminClient();

  const { data: wallets } = await adminSupabase
    .from("ai_credit_wallets")
    .select(`
      organization_id, available_credits, lifetime_credits_used, is_admin_exempt,
      organizations ( name, slug )
    `)
    .order("lifetime_credits_used", { ascending: false })
    .limit(50);

  const { data: recentUsage } = await adminSupabase
    .from("ai_usage_ledger")
    .select("organization_id, credits_used, model, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return {
    wallets: (wallets ?? []).map((w) => {
      const org = Array.isArray(w.organizations) ? w.organizations[0] : w.organizations;
      return {
        organization_id:       w.organization_id,
        org_name:              org?.name ?? "",
        org_slug:              org?.slug ?? "",
        available_credits:     Number(w.available_credits),
        lifetime_credits_used: Number(w.lifetime_credits_used),
        is_admin_exempt:       w.is_admin_exempt,
      };
    }),
    recentUsage: recentUsage ?? [],
  };
}

// ─── System dashboard ─────────────────────────────────────────────────────────

export async function adminGetSystemStatus() {
  await requireSuperAdmin();
  const adminSupabase = createAdminClient();

  const [orgsCountRes, jobsRes, errorsRes, creditsRes] = await Promise.all([
    adminSupabase.from("organizations").select("id", { count: "exact", head: true }),
    adminSupabase
      .from("job_queue")
      .select("status")
      .in("status", ["pending", "running", "dead_letter"]),
    adminSupabase
      .from("event_logs")
      .select("id", { count: "exact", head: true })
      .in("severity", ["error", "critical"])
      .gte("created_at", new Date(Date.now() - 86400000).toISOString()),
    adminSupabase
      .from("ai_credit_wallets")
      .select("available_credits")
      .lt("available_credits", 50)
      .eq("is_admin_exempt", false),
  ]);

  const jobsByStatus = (jobsRes.data ?? []).reduce((acc: Record<string, number>, j) => {
    acc[j.status] = (acc[j.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    total_organizations: orgsCountRes.count ?? 0,
    jobs_pending:        jobsByStatus["pending"] ?? 0,
    jobs_running:        jobsByStatus["running"] ?? 0,
    jobs_dead_letter:    jobsByStatus["dead_letter"] ?? 0,
    errors_last_24h:     errorsRes.count ?? 0,
    low_credit_orgs:     creditsRes.data?.length ?? 0,
  };
}

// ─── Admin audit log ──────────────────────────────────────────────────────────

export async function adminGetAuditLog(orgId?: string) {
  await requireSuperAdmin();
  const adminSupabase = createAdminClient();

  let query = adminSupabase
    .from("admin_audit_log")
    .select("id, action, entity_type, entity_id, organization_id, after_state, created_at, performed_by")
    .order("created_at", { ascending: false })
    .limit(50);

  if (orgId) query = query.eq("organization_id", orgId);

  const { data } = await query;
  return data ?? [];
}
