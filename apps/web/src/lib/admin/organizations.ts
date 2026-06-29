import type { SupabaseClient } from "@supabase/supabase-js";

export type AdminOrgRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  subscription: {
    plan_name: string | null;
    plan_slug: string | null;
    status: string;
    commercial_status: string;
    trial_ends_at: string | null;
    origin: string;
  } | null;
  wallet: {
    available_credits: number;
    lifetime_credits_used: number;
    is_admin_exempt: boolean;
  } | null;
  member_count: number;
  whatsapp_connected: boolean;
  onboarding_completed: boolean;
};

export type AdminOrgDetail = AdminOrgRow & {
  members: { user_id: string; email: string; role: string; created_at: string }[];
  integrations: { provider_key: string; status: string; display_name: string }[];
  recent_errors: { message: string; severity: string; created_at: string }[];
  failed_jobs: { job_type: string; status: string; error_message: string | null; created_at: string }[];
  subscription_notes: string;
};

export async function listAdminOrganizations(adminSupabase: SupabaseClient): Promise<AdminOrgRow[]> {
  const { data: orgs, error } = await adminSupabase
    .from("organizations")
    .select(`
      id, name, slug, created_at,
      organization_subscriptions (
        plan_id, status, commercial_status, trial_ends_at, origin,
        plans ( name, slug )
      ),
      ai_credit_wallets ( available_credits, lifetime_credits_used, is_admin_exempt ),
      onboarding_progress ( completed_at )
    `)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const { data: memberCounts } = await adminSupabase
    .from("organization_members")
    .select("organization_id");

  const countMap = new Map<string, number>();
  for (const m of memberCounts ?? []) {
    countMap.set(m.organization_id, (countMap.get(m.organization_id) ?? 0) + 1);
  }

  const { data: waConnections } = await adminSupabase
    .from("whatsapp_connections")
    .select("organization_id, status");

  const waMap = new Map<string, boolean>();
  for (const w of waConnections ?? []) {
    if (w.status === "connected") waMap.set(w.organization_id, true);
  }

  return (orgs ?? []).map((org) => {
    const sub = Array.isArray(org.organization_subscriptions)
      ? org.organization_subscriptions[0]
      : org.organization_subscriptions;
    const plan = sub?.plans
      ? (Array.isArray(sub.plans) ? sub.plans[0] : sub.plans)
      : null;
    const wallet = Array.isArray(org.ai_credit_wallets)
      ? org.ai_credit_wallets[0]
      : org.ai_credit_wallets;
    const onboarding = Array.isArray(org.onboarding_progress)
      ? org.onboarding_progress[0]
      : org.onboarding_progress;

    return {
      id:                  org.id,
      name:                org.name,
      slug:                org.slug,
      created_at:          org.created_at,
      member_count:        countMap.get(org.id) ?? 0,
      whatsapp_connected:  waMap.get(org.id) ?? false,
      onboarding_completed: !!onboarding?.completed_at,
      subscription: sub
        ? {
            plan_name:        plan?.name ?? null,
            plan_slug:        plan?.slug ?? null,
            status:           sub.status,
            commercial_status: sub.commercial_status ?? "prospect",
            trial_ends_at:    sub.trial_ends_at ?? null,
            origin:           sub.origin ?? "organic",
          }
        : null,
      wallet: wallet
        ? {
            available_credits:      Number(wallet.available_credits),
            lifetime_credits_used:  Number(wallet.lifetime_credits_used),
            is_admin_exempt:        wallet.is_admin_exempt,
          }
        : null,
    };
  });
}

export async function getAdminOrgDetail(adminSupabase: SupabaseClient, orgId: string): Promise<AdminOrgDetail | null> {
  const { data: org } = await adminSupabase
    .from("organizations")
    .select(`
      id, name, slug, created_at,
      organization_subscriptions (
        plan_id, status, commercial_status, trial_ends_at, origin, internal_notes,
        plans ( name, slug )
      ),
      ai_credit_wallets ( available_credits, lifetime_credits_used, is_admin_exempt ),
      onboarding_progress ( completed_at )
    `)
    .eq("id", orgId)
    .single();

  if (!org) return null;

  const [membersRes, integrationsRes, errorsRes, jobsRes] = await Promise.all([
    adminSupabase
      .from("organization_members")
      .select("user_id, role, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true }),
    adminSupabase
      .from("integration_connections")
      .select("provider_key, status, display_name")
      .eq("organization_id", orgId)
      .eq("status", "connected"),
    adminSupabase
      .from("event_logs")
      .select("message, severity, created_at")
      .eq("organization_id", orgId)
      .in("severity", ["error", "critical"])
      .order("created_at", { ascending: false })
      .limit(10),
    adminSupabase
      .from("job_queue")
      .select("job_type, status, error_message, created_at")
      .eq("organization_id", orgId)
      .in("status", ["dead_letter", "failed"])
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const userIds = (membersRes.data ?? []).map((m) => m.user_id);
  const emailMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users } = await adminSupabase.auth.admin.listUsers();
    for (const u of users?.users ?? []) {
      if (userIds.includes(u.id)) emailMap.set(u.id, u.email ?? "");
    }
  }

  const sub = Array.isArray(org.organization_subscriptions)
    ? org.organization_subscriptions[0]
    : org.organization_subscriptions;
  const plan = sub?.plans
    ? (Array.isArray(sub.plans) ? sub.plans[0] : sub.plans)
    : null;
  const wallet = Array.isArray(org.ai_credit_wallets)
    ? org.ai_credit_wallets[0]
    : org.ai_credit_wallets;
  const onboarding = Array.isArray(org.onboarding_progress)
    ? org.onboarding_progress[0]
    : org.onboarding_progress;

  return {
    id:                  org.id,
    name:                org.name,
    slug:                org.slug,
    created_at:          org.created_at,
    member_count:        membersRes.data?.length ?? 0,
    whatsapp_connected:  false,
    onboarding_completed: !!onboarding?.completed_at,
    subscription_notes:  sub?.internal_notes ?? "",
    subscription: sub
      ? {
          plan_name:        plan?.name ?? null,
          plan_slug:        plan?.slug ?? null,
          status:           sub.status,
          commercial_status: sub.commercial_status ?? "prospect",
          trial_ends_at:    sub.trial_ends_at ?? null,
          origin:           sub.origin ?? "organic",
        }
      : null,
    wallet: wallet
      ? {
          available_credits:      Number(wallet.available_credits),
          lifetime_credits_used:  Number(wallet.lifetime_credits_used),
          is_admin_exempt:        wallet.is_admin_exempt,
        }
      : null,
    members: (membersRes.data ?? []).map((m) => ({
      user_id:    m.user_id,
      email:      emailMap.get(m.user_id) ?? "",
      role:       m.role,
      created_at: m.created_at,
    })),
    integrations: (integrationsRes.data ?? []).map((i) => ({
      provider_key: i.provider_key,
      status:       i.status,
      display_name: i.display_name,
    })),
    recent_errors: (errorsRes.data ?? []).map((e) => ({
      message:    e.message,
      severity:   e.severity,
      created_at: e.created_at,
    })),
    failed_jobs: (jobsRes.data ?? []).map((j) => ({
      job_type:      j.job_type,
      status:        j.status,
      error_message: j.error_message,
      created_at:    j.created_at,
    })),
  };
}
