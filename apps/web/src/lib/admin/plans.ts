import type { SupabaseClient } from "@supabase/supabase-js";

export type PlanRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  monthly_credits: number;
  max_members: number | null;
  max_assistants: number | null;
  max_automations: number | null;
  max_integrations: number | null;
  max_documents: number | null;
  max_conversations: number | null;
  max_storage_mb: number | null;
  price_usd_monthly: number;
  is_public: boolean;
  active: boolean;
  sort_order: number;
  features: Record<string, unknown>;
};

export async function listPlans(adminSupabase: SupabaseClient): Promise<PlanRow[]> {
  const { data, error } = await adminSupabase
    .from("plans")
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PlanRow[];
}

export async function getPlanBySlug(adminSupabase: SupabaseClient, slug: string): Promise<PlanRow | null> {
  const { data } = await adminSupabase
    .from("plans")
    .select("*")
    .eq("slug", slug)
    .single();
  return data as PlanRow | null;
}

export async function checkOrgLimit(
  adminSupabase: SupabaseClient,
  orgId: string,
  limitKey: "max_assistants" | "max_automations" | "max_integrations" | "max_members",
  currentCount: number,
): Promise<{ allowed: boolean; limit: number | null; current: number }> {
  const { data } = await adminSupabase
    .from("organization_subscriptions")
    .select(`plans(${limitKey}, features)`)
    .eq("organization_id", orgId)
    .single();

  if (!data) return { allowed: true, limit: null, current: currentCount };

  const plan = Array.isArray(data.plans) ? data.plans[0] : data.plans;
  const features = (plan?.features ?? {}) as Record<string, unknown>;
  const bypassLimits = features?.bypass_limits === true;
  const limit = (plan as Record<string, unknown>)?.[limitKey] as number | null | undefined;

  if (bypassLimits || limit == null) return { allowed: true, limit: null, current: currentCount };
  return { allowed: currentCount < limit, limit, current: currentCount };
}
