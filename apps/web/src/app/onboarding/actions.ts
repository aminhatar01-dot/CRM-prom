"use server";

import { redirect } from "next/navigation";
import { organizationSchema } from "@crm-pro-ai/database/tenant";
import { requireUser } from "@/lib/auth";

export async function createOrganization(formData: FormData) {
  const parsed = organizationSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug")
  });

  if (!parsed.success) {
    redirect("/onboarding?error=invalid");
  }

  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("organizations")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error || !data) {
    redirect("/onboarding?error=create");
  }

  const { error: memberError } = await supabase.from("organization_members").insert({
    organization_id: data.id,
    user_id: user.id,
    role: "owner"
  });

  if (memberError) {
    redirect("/onboarding?error=member");
  }

  redirect("/dashboard");
}
