import { adminListOrganizations } from "@/app/actions/admin";
import Link from "next/link";

export default async function AdminOrganizationsPage() {
  const orgs = await adminListOrganizations();

  const statusColors: Record<string, string> = {
    trial:     "bg-yellow-900/50 text-yellow-300",
    active:    "bg-green-900/50 text-green-300",
    suspended: "bg-red-900/50 text-red-300",
    cancelled: "bg-gray-700 text-gray-400",
    past_due:  "bg-orange-900/50 text-orange-300",
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Organizaciones ({orgs.length})</h1>
      </div>

      <div className="overflow-auto rounded-lg border border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-gray-400 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Organización</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Créditos</th>
              <th className="px-4 py-3 text-left">Miembros</th>
              <th className="px-4 py-3 text-left">WA</th>
              <th className="px-4 py-3 text-left">Onboarding</th>
              <th className="px-4 py-3 text-left">Creado</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {orgs.map((org) => (
              <tr key={org.id} className="hover:bg-gray-900/50">
                <td className="px-4 py-3">
                  <div className="font-medium text-white">{org.name}</div>
                  <div className="text-gray-500 text-xs">{org.slug}</div>
                </td>
                <td className="px-4 py-3 text-gray-300">
                  {org.subscription?.plan_name ?? <span className="text-gray-600">—</span>}
                </td>
                <td className="px-4 py-3">
                  {org.subscription ? (
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[org.subscription.status] ?? "bg-gray-700 text-gray-300"}`}>
                      {org.subscription.status}
                    </span>
                  ) : (
                    <span className="text-gray-600 text-xs">sin suscripción</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {org.wallet ? (
                    <div>
                      <div className={`font-mono ${org.wallet.available_credits < 50 ? "text-red-400" : "text-green-400"}`}>
                        {org.wallet.available_credits.toLocaleString()}
                      </div>
                      {org.wallet.is_admin_exempt && (
                        <span className="text-xs text-purple-400">exempt</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-600">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-300">{org.member_count}</td>
                <td className="px-4 py-3">
                  <span className={org.whatsapp_connected ? "text-green-400" : "text-gray-600"}>
                    {org.whatsapp_connected ? "✓" : "—"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={org.onboarding_completed ? "text-green-400" : "text-yellow-400"}>
                    {org.onboarding_completed ? "✓" : "pendiente"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {new Date(org.created_at).toLocaleDateString("es-AR")}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/organizations/${org.id}`}
                    className="text-blue-400 hover:text-blue-300 text-xs"
                  >
                    Ver →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
