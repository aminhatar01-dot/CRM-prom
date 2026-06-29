import { requireSuperAdmin } from "@/lib/admin/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminMarkInvoicePaid, adminSuspendOrg, adminReactivateOrg } from "@/app/actions/billing";
import { notFound } from "next/navigation";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdmin();
  const { id } = await params;

  const adminSupabase = createAdminClient();
  const { data: invoice } = await adminSupabase
    .from("billing_invoices")
    .select(`*, organizations(name, slug)`)
    .eq("id", id)
    .maybeSingle();

  if (!invoice) notFound();

  const { data: payments } = await adminSupabase
    .from("billing_payments")
    .select("*")
    .eq("invoice_id", id)
    .order("created_at", { ascending: false });

  const org = Array.isArray(invoice.organizations) ? invoice.organizations[0] : invoice.organizations;

  const STATUS_COLORS: Record<string, string> = {
    paid:          "bg-green-900/50 text-green-300",
    open:          "bg-yellow-900/50 text-yellow-300",
    draft:         "bg-gray-700 text-gray-400",
    void:          "bg-gray-700 text-gray-400",
    uncollectible: "bg-red-900/50 text-red-300",
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4">
        <a href="/admin/billing" className="text-gray-500 hover:text-white text-sm">← Facturación</a>
        <h1 className="text-2xl font-bold">Factura {invoice.number ?? invoice.id.slice(0, 8)}</h1>
        <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[invoice.status] ?? "bg-gray-700 text-gray-300"}`}>
          {invoice.status}
        </span>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5 space-y-3">
        <Row label="Organización">
          {org ? (
            <a href={`/admin/organizations/${invoice.organization_id}`} className="text-blue-400 hover:underline">
              {org.name} ({org.slug})
            </a>
          ) : invoice.organization_id}
        </Row>
        <Row label="Monto">{invoice.currency} {(invoice.amount_cents / 100).toFixed(2)}</Row>
        <Row label="Descripción">{invoice.description}</Row>
        <Row label="Provider">{invoice.provider}</Row>
        <Row label="Creada">{new Date(invoice.created_at).toLocaleString("es-AR")}</Row>
        {invoice.due_date && <Row label="Vence">{new Date(invoice.due_date).toLocaleDateString("es-AR")}</Row>}
        {invoice.paid_at && <Row label="Pagada">{new Date(invoice.paid_at).toLocaleString("es-AR")}</Row>}
      </div>

      {/* Actions */}
      {invoice.status !== "paid" && invoice.status !== "void" && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">Acciones</h2>
          <form action={adminMarkInvoicePaid} className="space-y-3">
            <input type="hidden" name="invoice_id" value={invoice.id} />
            <input type="hidden" name="org_id" value={invoice.organization_id} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Método de pago</label>
                <select name="method" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white">
                  {["manual", "bank_transfer", "card", "mercado_pago", "pix", "other"].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Notas</label>
                <input type="text" name="notes" placeholder="Referencia de transferencia…" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <button type="submit" className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-medium">
              Marcar como pagada
            </button>
          </form>
        </div>
      )}

      {/* Suspend / reactivate */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">Estado de org</h2>
        <div className="flex gap-3">
          <form action={adminSuspendOrg}>
            <input type="hidden" name="org_id" value={invoice.organization_id} />
            <input type="hidden" name="reason" value="past_due" />
            <button type="submit" className="bg-red-800 hover:bg-red-700 text-white px-3 py-1.5 rounded text-xs font-medium">
              Suspender org
            </button>
          </form>
          <form action={adminReactivateOrg}>
            <input type="hidden" name="org_id" value={invoice.organization_id} />
            <button type="submit" className="bg-green-800 hover:bg-green-700 text-white px-3 py-1.5 rounded text-xs font-medium">
              Reactivar org
            </button>
          </form>
        </div>
      </div>

      {/* Payment history */}
      {payments && payments.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">Pagos registrados</h2>
          <table className="w-full text-xs">
            <thead className="text-gray-400 uppercase">
              <tr>
                <th className="text-left py-2">Método</th>
                <th className="text-left py-2">Estado</th>
                <th className="text-right py-2">Monto</th>
                <th className="text-right py-2">Créditos</th>
                <th className="text-left py-2">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="py-2 text-gray-300">{p.method}</td>
                  <td className="py-2 text-green-400">{p.status}</td>
                  <td className="py-2 text-right font-mono">{p.currency} {(p.amount_cents / 100).toFixed(2)}</td>
                  <td className="py-2 text-right text-blue-400 font-mono">{p.credits_granted > 0 ? p.credits_granted.toLocaleString() : "—"}</td>
                  <td className="py-2 text-gray-500">{new Date(p.created_at).toLocaleString("es-AR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4">
      <span className="text-xs text-gray-400 w-28 shrink-0">{label}</span>
      <span className="text-sm text-white">{children}</span>
    </div>
  );
}
