import { redirect } from "next/navigation";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type ActiveOrganization = {
  id: string;
  name: string;
  slug: string;
  role: string;
};

type MembershipRow = {
  role: string;
  organizations: {
    id: string;
    name: string;
    slug: string;
  } | null;
};

export async function getActiveOrganization(
  supabase: SupabaseClient,
  user: User,
): Promise<ActiveOrganization> {
  const { data } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name, slug)")
    .eq("user_id", user.id)
    .limit(1)
    .returns<MembershipRow[]>();

  const membership = data?.[0];

  if (!membership?.organizations) {
    redirect("/onboarding");
  }

  return {
    ...membership.organizations,
    role: membership.role
  };
}

export async function getAssignableMembers(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const { data } = await supabase
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", organizationId)
    .order("created_at");

  return data ?? [];
}
