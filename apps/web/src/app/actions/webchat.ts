"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { webchatWidgetSchema } from "@crm-pro-ai/integrations/webchat";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

function value(formData: FormData, key: string) {
  const formValue = formData.get(key);
  return typeof formValue === "string" ? formValue : "";
}

export async function saveWebchatWidget(formData: FormData) {
  const id = value(formData, "id");
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const parsed = webchatWidgetSchema.safeParse({
    organization_id: organization.id,
    name: value(formData, "name"),
    primary_color: value(formData, "primary_color") || "#0f766e",
    initial_message: value(formData, "initial_message"),
    position: value(formData, "position"),
    active: formData.get("active") === "on",
    allowed_domains: value(formData, "allowed_domains")
      .split("\n")
      .map((domain) => domain.trim())
      .filter(Boolean),
    assistant_id: value(formData, "assistant_id")
  });

  if (!parsed.success) redirect("/settings/channels/webchat?error=invalid");

  const payload = {
    ...parsed.data,
    public_token: id ? undefined : `wchat_${randomUUID().replaceAll("-", "")}`
  };

  const query = id
    ? supabase.from("webchat_widgets").update(payload).eq("id", id).eq("organization_id", organization.id).select("id")
    : supabase.from("webchat_widgets").insert(payload).select("id");

  const { data, error } = await query.single<{ id: string }>();

  if (error || !data) redirect("/settings/channels/webchat?error=save");

  await supabase.from("audit_logs").insert({
    organization_id: organization.id,
    actor_user_id: user.id,
    action: id ? "update_webchat_widget" : "create_webchat_widget",
    entity_table: "webchat_widgets",
    entity_id: data.id,
    metadata: { active: parsed.data.active }
  });

  revalidatePath("/settings/channels/webchat");
  redirect("/settings/channels/webchat?saved=1");
}
