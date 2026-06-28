import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, Copy, Edit3, Send } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { archiveQuote, changeQuoteStatus, duplicateQuote, sendQuote } from "@/app/actions/quotes";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { supabase, user } = await requireUser(); const organization = await getActiveOrganization(supabase, user);
  const { data: quote } = await supabase.from("quotes").select("*").eq("id", id).eq("organization_id", organization.id).is("archived_at", null).maybeSingle<QuoteDetail>();
  if (!quote) notFound();
  const [{ data: items }, { data: events }] = await Promise.all([
    supabase.from("quote_items").select("*").eq("quote_id", id).eq("organization_id", organization.id).order("position"),
    supabase.from("quote_events").select("id,event_type,metadata,created_at").eq("quote_id", id).eq("organization_id", organization.id).order("created_at", { ascending: false }).limit(30)
  ]);
  const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: quote.currency });
  return <section className="mx-auto max-w-6xl space-y-6 px-4 py-6 lg:px-6">
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><p className="text-sm text-muted-foreground">{quote.quote_number}</p><h1 className="text-2xl font-semibold">{quote.customer_name}</h1><p className="mt-1 text-sm">{quote.customer_phone || "Sin telefono"} · {quote.status}</p></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link href={`/quotes/${id}/edit`}><Edit3 className="size-4" />Editar</Link></Button><form action={duplicateQuote}><input type="hidden" name="id" value={id}/><Button type="submit" variant="outline"><Copy className="size-4" />Duplicar</Button></form>{quote.conversation_id ? <form action={sendQuote}><input type="hidden" name="id" value={id}/><Button type="submit"><Send className="size-4" />Aprobar y enviar</Button></form> : null}<form action={archiveQuote}><input type="hidden" name="id" value={id}/><Button type="submit" variant="outline" title="Archivar"><Archive className="size-4" /></Button></form></div></div>
    <div className="overflow-hidden rounded-md border"><div className="grid grid-cols-[1fr_90px_120px_120px] gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-medium"><span>Item</span><span>Cantidad</span><span>Precio</span><span>Total</span></div>{((items ?? []) as QuoteItemRow[]).map((item) => <div key={item.id} className="grid grid-cols-[1fr_90px_120px_120px] gap-3 border-b px-4 py-4 text-sm last:border-0"><div><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.sku || item.source_title || "Item manual"}</p></div><span>{item.quantity}</span><span>{money.format(item.unit_price)}</span><span>{money.format(item.line_total)}</span></div>)}</div>
    <div className="grid gap-6 md:grid-cols-[1fr_320px]"><div className="space-y-3"><h2 className="font-semibold">Historial</h2>{((events ?? []) as QuoteEventRow[]).map((event) => <div key={event.id} className="border-l-2 pl-3 text-sm"><p>{event.event_type}</p><p className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString("es-AR")}</p></div>)}</div><aside className="space-y-3 rounded-md border p-4"><div className="flex justify-between"><span>Subtotal</span><strong>{money.format(quote.subtotal)}</strong></div><div className="flex justify-between"><span>Descuentos</span><strong>-{money.format(quote.discount_total)}</strong></div><div className="flex justify-between"><span>Impuestos</span><strong>{money.format(quote.tax_total)}</strong></div><div className="flex justify-between border-t pt-3 text-lg"><span>Total</span><strong>{money.format(quote.total)}</strong></div><div className="flex flex-wrap gap-2 pt-2">{["accepted","rejected","cancelled"].map((status) => <form action={changeQuoteStatus} key={status}><input type="hidden" name="id" value={id}/><input type="hidden" name="status" value={status}/><Button type="submit" size="sm" variant="outline">{status === "accepted" ? "Aceptar" : status === "rejected" ? "Rechazar" : "Cancelar"}</Button></form>)}</div></aside></div>
  </section>;
}
type QuoteDetail = { id: string; quote_number: string; customer_name: string; customer_phone: string | null; status: string; currency: string; subtotal: number; discount_total: number; tax_total: number; total: number; conversation_id: string | null };
type QuoteItemRow = { id: string; name: string; sku: string | null; source_title: string | null; quantity: number; unit_price: number; line_total: number };
type QuoteEventRow = { id: string; event_type: string; created_at: string };
