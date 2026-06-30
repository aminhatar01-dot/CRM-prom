"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { logEvent } from "@/lib/observability/event-log";

export type UpdateProfileInput = {
  full_name?: string;
  phone?: string;
  job_title?: string;
  preferred_language?: string;
  timezone?: string;
};

export async function updateProfile(input: UpdateProfileInput): Promise<void> {
  const { user } = await requireUser();
  const admin = createAdminClient();

  const { error } = await admin
    .from("profiles")
    .update({
      full_name:          input.full_name?.trim() || undefined,
      phone:              input.phone?.trim() ?? null,
      job_title:          input.job_title?.trim() ?? null,
      preferred_language: input.preferred_language?.trim() ?? null,
      timezone:           input.timezone?.trim() ?? null,
      updated_at:         new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) throw new Error(error.message);

  await logEvent(admin, {
    source: "system",
    entityType: "user",
    entityId: user.id,
    eventType: "user_profile_updated",
    severity: "info",
    message: "Perfil de usuario actualizado",
    metadata: {},
  });

  revalidatePath("/settings/profile");
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const { supabase } = await requireUser();

  if (newPassword.length < 8) {
    throw new Error("La nueva contraseña debe tener al menos 8 caracteres.");
  }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: (await supabase.auth.getUser()).data.user?.email ?? "",
    password: currentPassword,
  });

  if (signInError) throw new Error("Contraseña actual incorrecta.");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
