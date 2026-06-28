"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { publicQuoteTokenSchema } from "@crm-pro-ai/types/quotes";
import { createAdminClient } from "@/lib/supabase/admin";

export async function acceptPublicQuote(formData: FormData) {
  const tokenValue = formData.get("token");
  const parsed = publicQuoteTokenSchema.safeParse(typeof tokenValue === "string" ? tokenValue : "");
  if (!parsed.success) redirect("/q/invalid?error=invalid");
  const admin = createAdminClient();
  const { data: quote } = await admin.from("quotes").select("id,organization_id,status,expires_at").eq("public_token", parsed.data).is("archived_at", null).maybeSingle<{ id: string; organization_id: string; status: string; expires_at: string | null }>();
  if (!quote || !["pending_approval", "sent"].includes(quote.status)) redirect(`/q/${parsed.data}?error=not-available`);
  if (quote.expires_at && new Date(quote.expires_at).getTime() < Date.now()) {
    await admin.from("quotes").update({ status: "expired" }).eq("id", quote.id).eq("organization_id", quote.organization_id);
    redirect(`/q/${parsed.data}?error=expired`);
  }
  await admin.from("quotes").update({ status: "accepted", accepted_at: new Date().toISOString() }).eq("id", quote.id).eq("organization_id", quote.organization_id);
  await admin.from("quote_events").insert({ organization_id: quote.organization_id, quote_id: quote.id, event_type: "accepted_public", metadata: {} });
  await admin.from("internal_notifications").insert({ organization_id: quote.organization_id, title: "Cotizacion aceptada", body: `La cotizacion ${quote.id} fue aceptada desde el enlace publico.`, entity_table: "quotes", entity_id: quote.id, metadata: { quote_id: quote.id, type: "quote_accepted" } });
  revalidatePath(`/q/${parsed.data}`); redirect(`/q/${parsed.data}?success=accepted`);
}
