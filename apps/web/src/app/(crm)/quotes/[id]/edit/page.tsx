import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { QuoteForm } from "../../_components/quote-form";

export default async function EditQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { supabase, user } = await requireUser(); const organization = await getActiveOrganization(supabase, user);
  const { data: quote } = await supabase.from("quotes").select("id,customer_name,customer_phone,status,currency,tax_total,expires_at,internal_notes,commercial_terms,lead_id,contact_id,conversation_id").eq("id", id).eq("organization_id", organization.id).is("archived_at", null).maybeSingle<EditQuoteRow>();
  if (!quote) notFound();
  const { data: items } = await supabase.from("quote_items").select("name,description,sku,quantity,unit_price,currency,discount_amount,stock,availability").eq("quote_id", id).eq("organization_id", organization.id).order("position");
  return <section className="mx-auto max-w-6xl px-4 py-6 lg:px-6"><h1 className="mb-6 text-2xl font-semibold">Editar {quote.customer_name}</h1><QuoteForm quote={{ ...quote, items: items ?? [] }} /></section>;
}
type EditQuoteRow = { id: string; customer_name: string; customer_phone: string | null; status: string; currency: string; tax_total: number; expires_at: string | null; internal_notes: string | null; commercial_terms: string | null; lead_id: string | null; contact_id: string | null; conversation_id: string | null };
