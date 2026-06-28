import { OpenAIResponsesClient } from "@crm-pro-ai/ai/openai-client";
import { QuoteIntentExtractor } from "@crm-pro-ai/ai/quote-extractor";
import type { QuoteItemInput } from "@crm-pro-ai/types/quotes";
import { getServerEnv } from "@/lib/env";
import { searchKnowledge } from "@/lib/knowledge/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { matchCatalogProduct, parseCatalogSources } from "./catalog";

export type QuoteBuildResult =
  | { status: "created"; quoteId: string; quoteNumber: string }
  | { status: "clarification"; message: string; reason: "not_quote" | "missing_product" | "missing_quantity" | "ambiguous" | "missing_price" | "currency_mismatch" };

type ConversationRow = {
  id: string; organization_id: string; lead_id: string | null; contact_id: string | null;
  channel: string; lead: { first_name: string; last_name: string | null; phone: string | null } | null; contact: { first_name: string; last_name: string | null; phone: string | null } | null;
};

export async function createQuoteFromConversation({ organizationId, conversationId, createdBy }: { organizationId: string; conversationId: string; createdBy?: string | null }): Promise<QuoteBuildResult> {
  const admin = createAdminClient();
  const { data: conversation, error } = await admin.from("conversations")
    .select("id,organization_id,lead_id,contact_id,channel,lead:leads(first_name,last_name,phone),contact:contacts(first_name,last_name,phone)")
    .eq("id", conversationId).eq("organization_id", organizationId).single<ConversationRow>();
  if (error || !conversation) throw new Error("Conversacion no encontrada para la cotizacion.");
  const { data: latest } = await admin.from("messages").select("id,body")
    .eq("organization_id", organizationId).eq("conversation_id", conversationId).eq("direction", "inbound")
    .order("created_at", { ascending: false }).limit(1).maybeSingle<{ id: string; body: string }>();
  if (!latest?.body) return { status: "clarification", reason: "missing_product", message: "Necesitamos un mensaje del cliente con el producto o servicio solicitado." };

  const env = getServerEnv();
  const extraction = await new QuoteIntentExtractor(new OpenAIResponsesClient({ apiKey: env.OPENAI_API_KEY, model: env.OPENAI_MODEL, temperature: 0.2, demoMode: env.AI_DEMO_MODE })).extract(latest.body);
  if (!extraction.data.is_quote_intent) return { status: "clarification", reason: "not_quote", message: "El ultimo mensaje no contiene una intencion clara de cotizacion." };
  if (extraction.data.requested_items.length === 0) return { status: "clarification", reason: "missing_product", message: "¿Que producto o servicio queres cotizar?" };
  if (extraction.data.requested_items.some((item) => item.quantity === null)) return { status: "clarification", reason: "missing_quantity", message: "¿Que cantidad necesitas de cada producto o servicio?" };

  const resolved: QuoteItemInput[] = [];
  for (const requested of extraction.data.requested_items) {
    const sources = await searchKnowledge({ organizationId, query: requested.query, limit: 8, minSimilarity: 0.2 });
    const match = matchCatalogProduct(requested.query, parseCatalogSources(sources));
    if (match.kind === "not_found") return { status: "clarification", reason: "missing_product", message: `No encontre "${requested.query}" en el catalogo. Necesito que un asesor confirme el producto.` };
    if (match.kind === "ambiguous") return { status: "clarification", reason: "ambiguous", message: `Encontre varias opciones para "${requested.query}": ${match.products.map((product) => product.name).join(", ")}. ¿Cual necesitas?` };
    if (match.kind === "missing_price") return { status: "clarification", reason: "missing_price", message: `${match.product.name} no tiene un precio verificable en el catalogo. Un asesor debe confirmarlo.` };
    if (match.product.price === null) return { status: "clarification", reason: "missing_price", message: `${match.product.name} no tiene un precio verificable en el catalogo. Un asesor debe confirmarlo.` };
    const currency = extraction.data.currency ?? match.product.currency ?? "ARS";
    if (match.product.currency && match.product.currency !== currency) return { status: "clarification", reason: "currency_mismatch", message: `El catalogo publica ${match.product.name} en ${match.product.currency}; no puedo convertirlo automaticamente a ${currency}.` };
    resolved.push({
      name: match.product.name, description: match.product.description, sku: match.product.sku,
      product_code: match.product.code, quantity: requested.quantity!, unit_price: match.product.price,
      currency, discount_amount: 0, stock: match.product.stock, availability: match.product.availability,
      source_document_id: match.product.sourceDocumentId, source_title: match.product.sourceTitle
    });
  }
  const currencies = new Set(resolved.map((item) => item.currency));
  if (currencies.size !== 1) return { status: "clarification", reason: "currency_mismatch", message: "Los productos usan monedas diferentes. Un asesor debe preparar esta cotizacion." };
  const person = conversation.contact ?? conversation.lead;
  if (!person) throw new Error("La conversacion no tiene lead o contacto asociado.");
  const { data: quote, error: quoteError } = await admin.from("quotes").insert({
    organization_id: organizationId, lead_id: conversation.lead_id, contact_id: conversation.contact_id,
    conversation_id: conversationId, customer_name: [person.first_name, person.last_name].filter(Boolean).join(" "), customer_phone: person.phone,
    status: "pending_approval", currency: resolved[0].currency, created_by: createdBy ?? null,
    internal_notes: `Generada desde mensaje ${latest.id}. Modo IA: ${extraction.mode}.`
  }).select("id,quote_number").single<{ id: string; quote_number: string }>();
  if (quoteError || !quote) throw new Error("No pudimos crear la cotizacion.");
  const { error: itemError } = await admin.from("quote_items").insert(resolved.map((item, index) => ({ ...item, organization_id: organizationId, quote_id: quote.id, position: index + 1, source_metadata: { inbound_message_id: latest.id } })));
  if (itemError) { await admin.from("quotes").delete().eq("id", quote.id).eq("organization_id", organizationId); throw new Error("No pudimos guardar los items de la cotizacion."); }
  await admin.from("quote_events").insert({ organization_id: organizationId, quote_id: quote.id, event_type: "created_from_conversation", actor_user_id: createdBy ?? null, metadata: { message_id: latest.id, ai_mode: extraction.mode } });
  return { status: "created", quoteId: quote.id, quoteNumber: quote.quote_number };
}

export function formatQuoteMessage(quote: { quote_number: string; currency: string; total: number; expires_at: string | null; commercial_terms: string | null }, items: Array<{ name: string; quantity: number; unit_price: number; line_total: number }>, publicUrl?: string) {
  const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: quote.currency });
  return [
    `Cotizacion ${quote.quote_number}`,
    ...items.map((item) => `${item.quantity} x ${item.name} - ${money.format(item.unit_price)} = ${money.format(item.line_total)}`),
    `Total: ${money.format(quote.total)}`,
    quote.expires_at ? `Vigencia: ${new Date(quote.expires_at).toLocaleDateString("es-AR")}` : "",
    quote.commercial_terms ?? "",
    publicUrl ? `Ver cotizacion: ${publicUrl}` : "",
    "Para aceptar o consultar, responde a este mensaje."
  ].filter(Boolean).join("\n");
}
