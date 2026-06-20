"use server";

import { redirect } from "next/navigation";
import {
  organizationFormSchema,
  suggestOrganizationSlug
} from "@crm-pro-ai/database/tenant";
import { requireUser } from "@/lib/auth";

export async function createOrganization(formData: FormData) {
  const parsed = organizationFormSchema.safeParse({
    name: formData.get("name"),
    slug: String(formData.get("slug") ?? "")
  });

  if (!parsed.success) {
    redirect("/onboarding?error=invalid-slug");
  }

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("create_initial_organization", {
    p_name: parsed.data.name,
    p_slug: parsed.data.slug
  });

  if (error) {
    console.error("Initial organization creation failed", {
      code: error.code,
      message: error.message,
      details: error.details
    });

    if (error.code === "23505") {
      const suggestion = suggestOrganizationSlug(parsed.data.slug, crypto.randomUUID().slice(0, 6));
      redirect(
        `/onboarding?error=slug-taken&slug=${encodeURIComponent(parsed.data.slug)}&suggestion=${encodeURIComponent(suggestion)}`
      );
    }

    if (error.code === "P0001") {
      redirect("/dashboard");
    }

    redirect("/onboarding?error=create");
  }

  redirect("/dashboard");
}
