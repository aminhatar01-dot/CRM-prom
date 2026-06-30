"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { canManageSettings } from "@/lib/permissions/roles";
import { logEvent } from "@/lib/observability/event-log";

export type UpdateOrganizationInput = {
  name?: string;
  description?: string;
  business_type?: string;
  country?: string;
  currency?: string;
  timezone?: string;
  tax_id?: string;
  fiscal_name?: string;
};

export async function updateOrganization(input: UpdateOrganizationInput): Promise<void> {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);

  if (!canManageSettings(org.role)) {
    throw new Error("Solo administradores pueden editar el perfil de la organización.");
  }

  const admin = createAdminClient();

  const { error } = await admin
    .from("organizations")
    .update({
      name:          input.name?.trim() || undefined,
      description:   input.description?.trim() ?? null,
      business_type: input.business_type?.trim() ?? null,
      country:       input.country?.trim() ?? null,
      currency:      input.currency?.trim() ?? null,
      timezone:      input.timezone?.trim() ?? null,
      tax_id:        input.tax_id?.trim() ?? null,
      fiscal_name:   input.fiscal_name?.trim() ?? null,
      updated_at:    new Date().toISOString(),
    })
    .eq("id", org.id);

  if (error) throw new Error(error.message);

  await logEvent(admin, {
    organizationId: org.id,
    source: "system",
    entityType: "user",
    entityId: user.id,
    eventType: "organization_profile_updated",
    severity: "info",
    message: "Perfil de organización actualizado",
    metadata: {},
  });

  revalidatePath("/settings/organization");
}

export async function uploadOrganizationLogo(formData: FormData): Promise<void> {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);

  if (!canManageSettings(org.role)) {
    throw new Error("Solo administradores pueden cambiar el logo.");
  }

  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) throw new Error("Archivo requerido.");
  if (file.size > 2 * 1024 * 1024) throw new Error("El logo no puede superar 2 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Formato no soportado. Use JPG, PNG o WebP.");
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `org-logos/${org.id}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("public-assets")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) throw new Error(uploadError.message);

  const { data: urlData } = supabase.storage
    .from("public-assets")
    .getPublicUrl(path);

  const admin = createAdminClient();
  await admin
    .from("organizations")
    .update({ logo_url: urlData.publicUrl, updated_at: new Date().toISOString() })
    .eq("id", org.id);

  revalidatePath("/settings/organization");
}
