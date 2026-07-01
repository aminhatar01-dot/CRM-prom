import {
  adminGetUpgradeRequests,
  adminGetCheckoutSessions,
  adminApproveUpgradeRequest,
  adminRejectUpgradeRequest,
  adminCompleteCheckoutSession,
} from "@/app/actions/billing";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  pending:          "bg-yellow-900/50 text-yellow-300",
  checkout_pending: "bg-blue-900/50 text-blue-300",
  approved:         "bg-green-900/50 text-green-300",
  rejected:         "bg-red-900/50 text-red-300",
  completed:        "bg-gray-700 text-gray-300",
};

const SESSION_STATUS_COLORS: Record<string, string> = {
  pending:   "bg-yellow-900/50 text-yellow-300",
  completed: "bg-green-900/50 text-green-300",
  expired:   "bg-gray-700 text-gray-400",
  cancelled: "bg-red-900/50 text-red-300",
};

export default async function AdminBillingRequestsPage() {
  const [upgradeRequests, checkoutSessions] = await Promise.all([
    adminGetUpgradeRequests(),
    adminGetCheckoutSessions(),
  ]);

  const pending     = upgradeRequests.filter((r) => (r as { status: string }).status === "pending").length;
  const pendingPay  = checkoutSessions.filter((s) => (s as { status: string }).status === "pending").length;

  async function handleApprove(formData: FormData) {
    "use server";
    await adminApproveUpgradeRequest(formData);
  }

  async function handleReject(formData: FormData) {
    "use server";
    await adminRejectUpgradeRequest(formData);
  }

  async function handleCompleteSession(formData: FormData) {
    "use server";
    await adminCompleteCheckoutSession(formData);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Solicitudes de Upgrade y Checkout</h1>
        <Link href="/admin/billing" className="text-sm text-gray-400 hover:text-white">
          ← Volver a Facturacion
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Solicitudes pendientes" value={String(pending)} color={pending > 0 ? "text-yellow-400" : "text-gray-400"} />
        <Stat label="Checkouts pendientes" value={String(pendingPay)} color={pendingPay > 0 ? "text-yellow-400" : "text-gray-400"} />
        <Stat label="Total solicitudes" value={String(upgradeRequests.length)} color="text-blue-400" />
      </div>

      {/* Upgrade requests */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Solicitudes de cambio de plan ({upgradeRequests.length})
          </h2>
        </div>
        {upgradeRequests.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">Sin solicitudes de upgrade.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-400 text-xs uppercase bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 text-left">Organizacion</th>
                <th className="px-4 py-3 text-left">Plan objetivo</th>
                <th className="px-4 py-3 text-left">Ciclo</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {upgradeRequests.map((req) => {
                const r    = req as { id: string; status: string; billing_cycle: string; created_at: string; organizations?: { name: string } | Array<{ name: string }>; target_plan?: { name: string } | Array<{ name: string }> };
                const org  = Array.isArray(r.organizations) ? r.organizations[0] : r.organizations;
                const plan = Array.isArray(r.target_plan) ? r.target_plan[0] : r.target_plan;
                const canAct = r.status === "pending" || r.status === "checkout_pending";

                return (
                  <tr key={r.id} className="hover:bg-gray-900/50">
                    <td className="px-4 py-3 text-gray-200">{org?.name ?? "—"}</td>
                    <td className="px-4 py-3 font-medium text-white">{plan?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-gray-400">{r.billing_cycle}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-700 text-gray-300"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(r.created_at).toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-4 py-3">
                      {canAct && (
                        <div className="flex gap-2">
                          <form action={handleApprove}>
                            <input type="hidden" name="request_id" value={r.id} />
                            <button
                              type="submit"
                              className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded"
                            >
                              Aprobar
                            </button>
                          </form>
                          <form action={handleReject}>
                            <input type="hidden" name="request_id" value={r.id} />
                            <input type="hidden" name="notes" value="Rechazado por admin" />
                            <button
                              type="submit"
                              className="text-xs bg-red-800 hover:bg-red-700 text-white px-2 py-1 rounded"
                            >
                              Rechazar
                            </button>
                          </form>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Checkout sessions */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Checkout sessions ({checkoutSessions.length})
          </h2>
        </div>
        {checkoutSessions.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500 text-sm">Sin checkout sessions.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-gray-400 text-xs uppercase bg-gray-900/50">
              <tr>
                <th className="px-4 py-3 text-left">Organizacion</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Provider</th>
                <th className="px-4 py-3 text-right">Creditos</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Fecha</th>
                <th className="px-4 py-3 text-left">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {checkoutSessions.map((s) => {
                const session = s as { id: string; session_type: string; provider: string; credits_amount: number; status: string; created_at: string; organizations?: { name: string } | Array<{ name: string }> };
                const org     = Array.isArray(session.organizations) ? session.organizations[0] : session.organizations;

                return (
                  <tr key={session.id} className="hover:bg-gray-900/50">
                    <td className="px-4 py-3 text-gray-200">{org?.name ?? session.id.slice(0, 8) + "…"}</td>
                    <td className="px-4 py-3 text-gray-300">{session.session_type}</td>
                    <td className="px-4 py-3 text-purple-400">{session.provider}</td>
                    <td className="px-4 py-3 text-right font-mono text-blue-400">
                      {session.credits_amount > 0 ? session.credits_amount.toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${SESSION_STATUS_COLORS[session.status] ?? "bg-gray-700 text-gray-300"}`}>
                        {session.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(session.created_at).toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-4 py-3">
                      {session.status === "pending" && (
                        <form action={handleCompleteSession}>
                          <input type="hidden" name="session_id" value={session.id} />
                          <button
                            type="submit"
                            className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded"
                          >
                            Marcar pagado
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
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
