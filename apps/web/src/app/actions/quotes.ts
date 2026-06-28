"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { WhatsAppCloudService } from "@crm-pro-ai/integrations/whatsapp-cloud-service";
import { quoteIdSchema, quoteSchema, quoteStatuses } from "@crm-pro-ai/types/quotes";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { getActiveOrganization } from "@/lib/organization";
import { createQuoteFromConversation, formatQuoteMessage } from "@/lib/quotes/service";
import { getWhatsAppAccessToken } from "@/lib/whatsapp/token-store";

function text(formData: FormData, name: string) { const value = formData.get(name); return typeof value === "string" ? value.trim() : ""; }
function nullable(value: string) { return value || null; }

function parsePayload(formData: FormData) {
  let items: unknown = [];
  try { items = JSON.parse(text(formData, "items_json")); } catch { items = []; }
  return quoteSchema.safeParse({
    lead_id: nullable(text(formData, "lead_id")), contact_id: nullable(text(formData, "contact_id")),
    conversation_id: nullable(text(formData, "conversation_id")), customer_name: text(formData, "customer_name"),
    customer_phone: nullable(text(formData, "customer_phone")), status: text(formData, "status") || "draft",
    currency: text(formData, "currency") || "ARS", tax_total: text(formData, "tax_total") || 0,
    expires_at: nullable(text(formData, "expires_at") ? new Date(text(formData, "expires_at")).toISOString() : ""),
    internal_notes: nullable(text(formData, "internal_notes")), commercial_terms: nullable(text(formData, "commercial_terms")), items
  });
}

export async function createQuote(formData: FormData) {
  const parsed = parsePayload(formData);
  if (!parsed.success) redirect("/quotes/new?error=invalid");
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { items, ...quote } = parsed.data;
  const { data, error } = await supabase.from("quotes").insert({ ...quote, organization_id: organization.id, created_by: user.id })
    .select("id").single<{ id: string }>();
  if (error || !data) redirect("/quotes/new?error=create-failed");
  const { error: itemsError } = await supabase.from("quote_items").insert(items.map((item, index) => ({ ...item, organization_id: organization.id, quote_id: data.id, position: index + 1, source_metadata: {} })));
  if (itemsError) { await supabase.from("quotes").delete().eq("id", data.id).eq("organization_id", organization.id); redirect("/quotes/new?error=items-failed"); }
  await recordEvent(supabase, organization.id, data.id, "created_manual", user.id);
  revalidatePath("/quotes"); redirect(`/quotes/${data.id}?success=created`);
}

export async function updateQuote(formData: FormData) {
  const id = text(formData, "id");
  const idResult = quoteIdSchema.safeParse({ id });
  const parsed = parsePayload(formData);
  if (!idResult.success || !parsed.success) redirect(`/quotes/${id}/edit?error=invalid`);
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { items, ...quote } = parsed.data;
  const { data, error } = await supabase.from("quotes").update(quote).eq("id", id).eq("organization_id", organization.id).is("archived_at", null).select("id").maybeSingle();
  if (error || !data) redirect(`/quotes/${id}/edit?error=update-failed`);
  const { error: deleteError } = await supabase.from("quote_items").delete().eq("quote_id", id).eq("organization_id", organization.id);
  const { error: itemsError } = deleteError ? { error: deleteError } : await supabase.from("quote_items").insert(items.map((item, index) => ({ ...item, organization_id: organization.id, quote_id: id, position: index + 1, source_metadata: {} })));
  if (itemsError) redirect(`/quotes/${id}/edit?error=items-failed`);
  await recordEvent(supabase, organization.id, id, "updated", user.id);
  revalidatePath("/quotes"); revalidatePath(`/quotes/${id}`); redirect(`/quotes/${id}?success=updated`);
}

export async function createQuoteFromInbox(formData: FormData) {
  const conversationId = text(formData, "conversation_id");
  if (!quoteIdSchema.safeParse({ id: conversationId }).success) redirect("/inbox?error=invalid");
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  try {
    const result = await createQuoteFromConversation({ organizationId: organization.id, conversationId, createdBy: user.id });
    if (result.status === "created") redirect(`/quotes/${result.quoteId}?success=generated`);
    redirect(`/inbox?conversation=${conversationId}&error=quote-${result.reason}`);
  } catch { redirect(`/inbox?conversation=${conversationId}&error=quote-failed`); }
}

export async function duplicateQuote(formData: FormData) {
  const parsed = quoteIdSchema.safeParse({ id: text(formData, "id") });
  if (!parsed.success) redirect("/quotes?error=invalid");
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: source } = await supabase.from("quotes").select("lead_id,contact_id,conversation_id,customer_name,customer_phone,currency,tax_total,expires_at,internal_notes,commercial_terms").eq("id", parsed.data.id).eq("organization_id", organization.id).maybeSingle();
  const { data: items } = await supabase.from("quote_items").select("name,description,sku,product_code,quantity,unit_price,currency,discount_amount,stock,availability,source_document_id,source_title,source_metadata,position").eq("quote_id", parsed.data.id).eq("organization_id", organization.id).order("position");
  if (!source || !items?.length) redirect("/quotes?error=not-found");
  const { data: copy, error } = await supabase.from("quotes").insert({ ...source, organization_id: organization.id, status: "draft", created_by: user.id, sent_at: null, accepted_at: null, rejected_at: null }).select("id").single<{ id: string }>();
  if (error || !copy) redirect("/quotes?error=duplicate-failed");
  await supabase.from("quote_items").insert(items.map((item) => ({ ...item, organization_id: organization.id, quote_id: copy.id })));
  await recordEvent(supabase, organization.id, copy.id, "duplicated", user.id, { source_quote_id: parsed.data.id });
  revalidatePath("/quotes"); redirect(`/quotes/${copy.id}?success=duplicated`);
}

export async function changeQuoteStatus(formData: FormData) {
  const id = text(formData, "id"); const status = text(formData, "status");
  if (!quoteIdSchema.safeParse({ id }).success || !quoteStatuses.includes(status as never)) redirect("/quotes?error=invalid");
  const { supabase, user } = await requireUser(); const organization = await getActiveOrganization(supabase, user);
  const timestamp = status === "accepted" ? { accepted_at: new Date().toISOString() } : status === "rejected" ? { rejected_at: new Date().toISOString() } : {};
  const { data } = await supabase.from("quotes").update({ status, ...timestamp }).eq("id", id).eq("organization_id", organization.id).select("id").maybeSingle();
  if (!data) redirect(`/quotes/${id}?error=status-failed`);
  await recordEvent(supabase, organization.id, id, `status_${status}`, user.id);
  revalidatePath("/quotes"); revalidatePath(`/quotes/${id}`); redirect(`/quotes/${id}?success=status`);
}

export async function archiveQuote(formData: FormData) {
  const parsed = quoteIdSchema.safeParse({ id: text(formData, "id") }); if (!parsed.success) redirect("/quotes?error=invalid");
  const { supabase, user } = await requireUser(); const organization = await getActiveOrganization(supabase, user);
  const { data } = await supabase.from("quotes").update({ archived_at: new Date().toISOString(), status: "cancelled" }).eq("id", parsed.data.id).eq("organization_id", organization.id).select("id").maybeSingle();
  if (!data) redirect("/quotes?error=archive-failed");
  await recordEvent(supabase, organization.id, parsed.data.id, "archived", user.id); revalidatePath("/quotes"); redirect("/quotes?success=archived");
}

export async function sendQuote(formData: FormData) {
  const parsed = quoteIdSchema.safeParse({ id: text(formData, "id") }); if (!parsed.success) redirect("/quotes?error=invalid");
  const { supabase, user } = await requireUser(); const organization = await getActiveOrganization(supabase, user);
  const { data: quote } = await supabase.from("quotes").select("id,quote_number,conversation_id,customer_phone,currency,total,expires_at,commercial_terms,public_token,status").eq("id", parsed.data.id).eq("organization_id", organization.id).is("archived_at", null).maybeSingle<SendQuoteRow>();
  const { data: items } = await supabase.from("quote_items").select("name,quantity,unit_price,line_total").eq("quote_id", parsed.data.id).eq("organization_id", organization.id).order("position").returns<SendQuoteItem[]>();
  if (!quote || !items?.length || !quote.conversation_id) redirect(`/quotes/${parsed.data.id}?error=missing-conversation`);
  const { data: conversation } = await supabase.from("conversations").select("id,channel,contacts(phone),leads(phone)").eq("id", quote.conversation_id).eq("organization_id", organization.id).maybeSingle<SendConversationRow>();
  if (!conversation || conversation.channel !== "whatsapp") redirect(`/quotes/${parsed.data.id}?error=whatsapp-required`);
  const { data: setting } = await supabase.from("whatsapp_channel_settings").select("id,phone_number_id,connection_method").eq("organization_id", organization.id).eq("enabled", true).limit(1).maybeSingle<ChannelSettingRow>();
  const recipient = conversation.contacts?.phone ?? conversation.leads?.phone ?? quote.customer_phone;
  const accessToken = setting ? await getWhatsAppAccessToken({ organizationId: organization.id, channelSettingId: setting.id, connectionMethod: setting.connection_method }) : null;
  if (!recipient || !setting || !accessToken) redirect(`/quotes/${parsed.data.id}?error=whatsapp-not-configured`);
  const env = getServerEnv(); const baseUrl = env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const body = formatQuoteMessage(quote, items, baseUrl ? `${baseUrl}/q/${quote.public_token}` : undefined);
  const { data: message, error: messageError } = await supabase.from("messages").insert({ organization_id: organization.id, conversation_id: conversation.id, direction: "outbound", channel: "whatsapp", sender_type: "human", sender_id: user.id, body, status: "pending", metadata: { quote_id: quote.id } }).select("id").single<{ id: string }>();
  if (messageError || !message) redirect(`/quotes/${parsed.data.id}?error=message-failed`);
  try {
    const response = await new WhatsAppCloudService({ accessToken, phoneNumberId: setting.phone_number_id, graphApiVersion: env.WHATSAPP_GRAPH_API_VERSION, appSecret: env.WHATSAPP_APP_SECRET }).sendText({ to: recipient, body });
    const externalId = response.messages?.[0]?.id;
    await supabase.from("messages").update({ status: "sent", external_message_id: externalId, metadata: { quote_id: quote.id, whatsapp_response: response } }).eq("id", message.id).eq("organization_id", organization.id);
    await supabase.from("whatsapp_events").insert({ organization_id: organization.id, direction: "outbound", event_type: "quote", whatsapp_message_id: externalId, conversation_id: conversation.id, message_id: message.id, phone_number_id: setting.phone_number_id, contact_wa_id: recipient, payload: response });
    await supabase.from("quotes").update({ status: "sent", sent_at: new Date().toISOString(), approved_by: user.id }).eq("id", quote.id).eq("organization_id", organization.id);
    await recordEvent(supabase, organization.id, quote.id, "sent_whatsapp", user.id, { message_id: message.id, external_message_id: externalId });
  } catch (error) {
    await supabase.from("messages").update({ status: "failed", metadata: { quote_id: quote.id, error: safeError(error) } }).eq("id", message.id).eq("organization_id", organization.id);
    await recordEvent(supabase, organization.id, quote.id, "send_failed", user.id, { error: safeError(error) });
    redirect(`/quotes/${quote.id}?error=send-failed`);
  }
  revalidatePath("/quotes"); revalidatePath(`/quotes/${quote.id}`); revalidatePath("/inbox"); redirect(`/quotes/${quote.id}?success=sent`);
}

async function recordEvent(supabase: SupabaseClient, organizationId: string, quoteId: string, eventType: string, userId: string, metadata: Record<string, unknown> = {}) {
  await supabase.from("quote_events").insert({ organization_id: organizationId, quote_id: quoteId, event_type: eventType, actor_user_id: userId, metadata });
  await supabase.from("audit_logs").insert({ organization_id: organizationId, actor_user_id: userId, action: `quote_${eventType}`, entity_table: "quotes", entity_id: quoteId, metadata });
}
function safeError(error: unknown) { return (error instanceof Error ? error.message : "WhatsApp no pudo enviar la cotizacion.").replace(/EAA[A-Za-z0-9]+/g, "[redacted]").slice(0, 300); }

type SendQuoteRow = { id: string; quote_number: string; conversation_id: string | null; customer_phone: string | null; currency: string; total: number; expires_at: string | null; commercial_terms: string | null; public_token: string; status: string };
type SendQuoteItem = { name: string; quantity: number; unit_price: number; line_total: number };
type SendConversationRow = { id: string; channel: string; contacts: { phone: string | null } | null; leads: { phone: string | null } | null };
type ChannelSettingRow = { id: string; phone_number_id: string; connection_method: string };
