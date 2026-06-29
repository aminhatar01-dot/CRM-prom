import { adminListAllInvoices, adminListWebhookEvents } from "@/app/actions/billing";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  paid:          "bg-green-900/50 text-green-300",
  open:          "bg-yellow-900/50 text-yellow-300",
  draft:         "bg-gray-700 text-gray-400",
  void:          "bg-gray-700 text-gray-400",
  uncollectible: "bg-red-900/50 text-red-300",
};

export default async function AdminBillingPage() {
  const [invoices, webhookEvents] = await Promise.all([
    adminListAllInvoices(),
    adminListWebhookEvents(),
  ]);

  const totalBilled = invoices
    .filter((i) => i.status !== "void" && !i.credit_note)
    .reduce((s, i) => s + i.amount_cents, 0);

  const totalPaid = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount_cents, 0);

  const openCount = invoices.filter((i) => i.status === "open").length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Facturación</h1>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Total facturado" value={`$${(totalBilled / 100).toFixed(2)}`} color="text-blue-400" />
        <Stat label="Total cobrado" value={`$${(totalPaid / 100).toFixed(2)}`} color="text-green-400" />
        <Stat label="Facturas abiertas" value={String(openCount)} color={openCount > 0 ? "text-yellow-400" : "text-gray-400"} />
      </div>

      {/* Invoice list */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Facturas ({invoices.length})</h2>
          <Link href="/admin/billing/new" className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded font-medium">
            + Nueva factura
          </Link>
        </div>
        <table className="w-full text-sm">
          <thead className="text-gray-400 text-xs uppercase bg-gray-900/50">
            <tr>
              <th className="px-4 py-3 text-left">Nro.</th>
              <th className="px-4 py-3 text-left">Organización</th>
              <th className="px-4 py-3 text-left">Descripción</th>
              <th className="px-4 py-3 text-right">Monto</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {invoices.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500 text-sm">
                  Sin facturas aún. Crear la primera desde una organización.
                </td>
              </tr>
            )}
            {invoices.map((inv) => {
              const org = Array.isArray(inv.organizations) ? inv.organizations[0] : inv.organizations;
              return (
                <tr key={inv.id} className="hover:bg-gray-900/50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">{inv.number ?? inv.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">
                    {org ? (
                      <Link href={`/admin/organizations/${inv.organization_id}`} className="text-blue-400 hover:underline text-sm">
                        {org.name}
                      </Link>
                    ) : (
                      <span className="text-gray-500 text-xs font-mono">{inv.organization_id.slice(0, 8)}…</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-300 max-w-xs truncate">{inv.description}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">
                    {inv.currency} {(inv.amount_cents / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[inv.status] ?? "bg-gray-700 text-gray-300"}`}>
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(inv.created_at).toLocaleDateString("es-AR")}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/billing/invoice/${inv.id}`} className="text-blue-400 hover:text-blue-300 text-xs">
                      Ver →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Webhook events */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Últimos webhooks billing</h2>
        </div>
        {webhookEvents.length === 0 ? (
          <div className="px-4 py-6 text-gray-500 text-sm">Sin webhooks recibidos.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-gray-400 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Provider</th>
                <th className="px-4 py-2 text-left">Evento</th>
                <th className="px-4 py-2 text-center">Procesado</th>
                <th className="px-4 py-2 text-left">Fecha</th>
                <th className="px-4 py-2 text-left">Error</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {(webhookEvents as { id: string; provider: string; event_type: string; processed: boolean; created_at: string; error_message: string | null }[]).map((ev) => (
                <tr key={ev.id} className="hover:bg-gray-900/50">
                  <td className="px-4 py-2 text-purple-400">{ev.provider}</td>
                  <td className="px-4 py-2 text-gray-300">{ev.event_type}</td>
                  <td className="px-4 py-2 text-center">
                    {ev.processed ? <span className="text-green-400">✓</span> : <span className="text-gray-500">—</span>}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{new Date(ev.created_at).toLocaleString("es-AR")}</td>
                  <td className="px-4 py-2 text-red-400 truncate max-w-xs">{ev.error_message ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}
