import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function requireSuperAdmin() {
  const { user } = await requireUser();
  const adminSupabase = createAdminClient();

  const { data } = await adminSupabase
    .from("platform_users")
    .select("role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .single();

  if (!data) redirect("/dashboard");
  return { user, platformRole: data.role as "super_admin" | "support" };
}

export async function isSuperAdmin(userId: string): Promise<boolean> {
  const adminSupabase = createAdminClient();
  const { data } = await adminSupabase
    .from("platform_users")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .eq("is_active", true)
    .single();
  return !!data;
}
