import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@crm-pro-ai/ui/button";
import { acceptPublicQuote } from "@/app/actions/public-quotes";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicQuoteTokenSchema } from "@crm-pro-ai/types/quotes";

export default async function PublicQuotePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ success?: string; error?: string }> }) {
  const { token } = await params; const query = await searchParams; if (!publicQuoteTokenSchema.safeParse(token).success) notFound();
  const admin = createAdminClient();
  const { data: quote } = await admin.from("quotes").select("id,quote_number,customer_name,customer_phone,status,currency,subtotal,discount_total,tax_total,total,expires_at,commercial_terms,organization_id,organizations(name)").eq("public_token", token).is("archived_at", null).maybeSingle<PublicQuoteRow>();
  if (!quote) notFound();
  const { data: items } = await admin.from("quote_items").select("id,name,description,quantity,unit_price,line_total").eq("quote_id", quote.id).eq("organization_id", quote.organization_id).order("position");
  const { data: channel } = await admin.from("whatsapp_channel_settings").select("display_phone_number").eq("organization_id", quote.organization_id).eq("enabled", true).limit(1).maybeSingle<{ display_phone_number: string | null }>();
  const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: quote.currency }); const expired = quote.expires_at && new Date(quote.expires_at).getTime() < Date.now();
  return <main className="min-h-screen bg-muted/30 px-4 py-8"><section className="mx-auto max-w-3xl overflow-hidden rounded-md border bg-background"><header className="border-b p-6"><p className="text-sm text-muted-foreground">{quote.organizations?.name ?? "CRM PRO AI"}</p><h1 className="mt-1 text-2xl font-semibold">Cotizacion {quote.quote_number}</h1><p className="mt-2 text-sm">Preparada para {quote.customer_name}</p></header>
    <div className="space-y-5 p-6">{query.success ? <p className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">Cotizacion aceptada. El equipo comercial fue notificado.</p> : null}{query.error || expired ? <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">Esta cotizacion no esta disponible para aceptar.</p> : null}
      <div className="divide-y rounded-md border">{((items ?? []) as PublicQuoteItem[]).map((item) => <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 p-4"><div><p className="font-medium">{item.quantity} x {item.name}</p>{item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}</div><strong>{money.format(item.line_total)}</strong></div>)}</div>
      <div className="ml-auto max-w-xs space-y-2"><div className="flex justify-between"><span>Subtotal</span><span>{money.format(quote.subtotal)}</span></div>{quote.discount_total > 0 ? <div className="flex justify-between"><span>Descuentos</span><span>-{money.format(quote.discount_total)}</span></div> : null}<div className="flex justify-between border-t pt-2 text-xl"><span>Total</span><strong>{money.format(quote.total)}</strong></div></div>
      {quote.expires_at ? <p className="text-sm text-muted-foreground">Valida hasta el {new Date(quote.expires_at).toLocaleDateString("es-AR")}.</p> : null}{quote.commercial_terms ? <p className="whitespace-pre-wrap text-sm">{quote.commercial_terms}</p> : null}
      <div className="flex flex-wrap gap-3">{["pending_approval","sent"].includes(quote.status) && !expired ? <form action={acceptPublicQuote}><input type="hidden" name="token" value={token}/><Button type="submit">Aceptar cotizacion</Button></form> : <p className="rounded-md border px-3 py-2 text-sm">Estado: {quote.status}</p>}{channel?.display_phone_number ? <Button asChild variant="outline"><Link href={`https://wa.me/${channel.display_phone_number.replace(/\D/g, "")}`} target="_blank">Consultar por WhatsApp</Link></Button> : null}</div>
    </div></section></main>;
}
type PublicQuoteRow = { id: string; quote_number: string; customer_name: string; customer_phone: string | null; status: string; currency: string; subtotal: number; discount_total: number; tax_total: number; total: number; expires_at: string | null; commercial_terms: string | null; organization_id: string; organizations: { name: string } | null };
type PublicQuoteItem = { id: string; name: string; description: string | null; quantity: number; unit_price: number; line_total: number };
