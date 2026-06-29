import { adminGetCreditsOverview } from "@/app/actions/admin";
import Link from "next/link";

export default async function AdminCreditsPage() {
  const { wallets, recentUsage } = await adminGetCreditsOverview();

  const totalAvailable   = wallets.reduce((s, w) => s + w.available_credits, 0);
  const totalUsed        = wallets.reduce((s, w) => s + w.lifetime_credits_used, 0);
  const lowCreditCount   = wallets.filter((w) => w.available_credits < 50 && !w.is_admin_exempt).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Créditos IA</h1>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Total créditos disponibles" value={totalAvailable.toLocaleString()} color="text-green-400" />
        <Stat label="Total créditos consumidos" value={totalUsed.toLocaleString()} color="text-blue-400" />
        <Stat label="Orgs con créditos bajos" value={String(lowCreditCount)} color={lowCreditCount > 0 ? "text-red-400" : "text-green-400"} />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Saldos por organización</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="text-gray-400 text-xs uppercase bg-gray-900/50">
            <tr>
              <th className="px-4 py-3 text-left">Organización</th>
              <th className="px-4 py-3 text-right">Disponible</th>
              <th className="px-4 py-3 text-right">Usado total</th>
              <th className="px-4 py-3 text-center">Exempt</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {wallets.map((w) => (
              <tr key={w.organization_id} className="hover:bg-gray-900/50">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{w.org_name}</div>
                  <div className="text-xs text-gray-500">{w.org_slug}</div>
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  <span className={w.available_credits < 50 && !w.is_admin_exempt ? "text-red-400" : "text-green-400"}>
                    {w.available_credits.toLocaleString()}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-blue-400">
                  {w.lifetime_credits_used.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-center">
                  {w.is_admin_exempt ? <span className="text-purple-400">✓</span> : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/organizations/${w.organization_id}`} className="text-blue-400 hover:text-blue-300 text-xs">
                    Gestionar →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Consumo reciente (últimas 100 llamadas)</h2>
        </div>
        <div className="overflow-auto max-h-72">
          <table className="w-full text-xs">
            <thead className="text-gray-400 uppercase sticky top-0 bg-gray-900">
              <tr>
                <th className="px-4 py-2 text-left">Org</th>
                <th className="px-4 py-2 text-left">Modelo</th>
                <th className="px-4 py-2 text-right">Créditos</th>
                <th className="px-4 py-2 text-left">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {(recentUsage as { organization_id: string; model: string; credits_used: number; created_at: string }[]).map((u, i) => (
                <tr key={i} className="hover:bg-gray-900/50">
                  <td className="px-4 py-2 font-mono text-gray-400">{u.organization_id.slice(0, 8)}…</td>
                  <td className="px-4 py-2 text-gray-300">{u.model}</td>
                  <td className="px-4 py-2 text-right text-blue-400">{u.credits_used}</td>
                  <td className="px-4 py-2 text-gray-500">{new Date(u.created_at).toLocaleString("es-AR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
