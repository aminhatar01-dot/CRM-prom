import { adminCreateManualInvoice } from "@/app/actions/billing";
import { adminListOrganizations, adminListPlans } from "@/app/actions/admin";

export default async function NewInvoicePage() {
  const [orgs, plans] = await Promise.all([
    adminListOrganizations(),
    adminListPlans(),
  ]);

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-4 mb-6">
        <a href="/admin/billing" className="text-gray-500 hover:text-white text-sm">← Facturación</a>
        <h1 className="text-2xl font-bold">Nueva factura manual</h1>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-5">
        <form action={adminCreateManualInvoice} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Organización</label>
            <select name="org_id" required className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white">
              <option value="">Seleccionar organización…</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name} ({o.slug})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Monto (USD)</label>
            <input
              type="number"
              name="amount_usd"
              min="0.01"
              step="0.01"
              placeholder="49.00"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Descripción</label>
            <input
              type="text"
              name="description"
              placeholder="Suscripción Plan Starter — Julio 2026"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Plan a asignar (opcional)</label>
            <select name="plan_slug" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white">
              <option value="">Sin cambio de plan</option>
              {plans.map((p) => (
                <option key={p.slug} value={p.slug}>{p.name} — {p.slug}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">Si se marca pagada, cargará los créditos del plan.</p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="w-full bg-blue-700 hover:bg-blue-600 text-white py-2 rounded font-medium text-sm"
            >
              Crear factura
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
