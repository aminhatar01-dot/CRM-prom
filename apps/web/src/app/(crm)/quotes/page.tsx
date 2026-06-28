import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

type Row = { id: string; quote_number: string; customer_name: string; status: string; currency: string; total: number; expires_at: string | null; created_at: string };
export default async function QuotesPage() {
  const { supabase, user } = await requireUser(); const organization = await getActiveOrganization(supabase, user);
  const { data } = await supabase.from("quotes").select("id,quote_number,customer_name,status,currency,total,expires_at,created_at").eq("organization_id", organization.id).is("archived_at", null).order("created_at", { ascending: false }).returns<Row[]>();
  return <section className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
    <div className="mb-6 flex items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold">Cotizaciones</h1><p className="text-sm text-muted-foreground">Presupuestos reales creados desde catalogo o manualmente.</p></div><Button asChild><Link href="/quotes/new"><Plus className="size-4" />Nueva cotizacion</Link></Button></div>
    <div className="overflow-hidden rounded-md border"><div className="hidden grid-cols-[130px_1fr_130px_130px_130px] gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-medium md:grid"><span>Numero</span><span>Cliente</span><span>Estado</span><span>Total</span><span>Fecha</span></div>
      {(data ?? []).map((quote) => <Link key={quote.id} href={`/quotes/${quote.id}`} className="grid gap-2 border-b px-4 py-4 last:border-0 hover:bg-muted/30 md:grid-cols-[130px_1fr_130px_130px_130px] md:items-center"><span className="font-medium">{quote.quote_number}</span><span>{quote.customer_name}</span><span className="text-sm">{labelStatus(quote.status)}</span><span>{new Intl.NumberFormat("es-AR", { style: "currency", currency: quote.currency }).format(quote.total)}</span><span className="text-sm text-muted-foreground">{new Date(quote.created_at).toLocaleDateString("es-AR")}</span></Link>)}
      {data?.length === 0 ? <div className="flex min-h-52 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground"><FileText className="size-7" /><p>No hay cotizaciones. Crea una manualmente o desde una conversacion.</p></div> : null}
    </div>
  </section>;
}
function labelStatus(status: string) { return ({ draft: "Borrador", pending_approval: "Pendiente", sent: "Enviada", accepted: "Aceptada", rejected: "Rechazada", expired: "Vencida", cancelled: "Cancelada" } as Record<string,string>)[status] ?? status; }
