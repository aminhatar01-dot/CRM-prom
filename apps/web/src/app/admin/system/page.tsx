import { adminGetSystemStatus, adminGetAuditLog } from "@/app/actions/admin";
import Link from "next/link";

export default async function AdminSystemPage() {
  const [status, auditLog] = await Promise.all([
    adminGetSystemStatus(),
    adminGetAuditLog(),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Sistema</h1>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Organizaciones" value={status.total_organizations} />
        <Stat label="Jobs pendientes" value={status.jobs_pending} color="text-yellow-400" />
        <Stat label="Jobs running" value={status.jobs_running} color="text-green-400" />
        <Stat label="Dead Letter" value={status.jobs_dead_letter} color={status.jobs_dead_letter > 0 ? "text-red-400" : "text-gray-400"} />
        <Stat label="Errores 24h" value={status.errors_last_24h} color={status.errors_last_24h > 0 ? "text-orange-400" : "text-gray-400"} />
        <Stat label="Orgs sin créditos" value={status.low_credit_orgs} color={status.low_credit_orgs > 0 ? "text-red-400" : "text-gray-400"} />
      </div>

      <div className="flex gap-3">
        <Link href="/settings/operations" className="text-sm text-blue-400 hover:text-blue-300 bg-gray-900 border border-gray-800 px-4 py-2 rounded">
          → Panel Operativo (jobs/logs)
        </Link>
        <Link href="/api/health" target="_blank" className="text-sm text-blue-400 hover:text-blue-300 bg-gray-900 border border-gray-800 px-4 py-2 rounded">
          → Healthcheck API
        </Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg">
        <div className="px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Log de auditoría admin</h2>
        </div>
        {auditLog.length === 0 ? (
          <div className="px-4 py-6 text-gray-500 text-sm">Sin acciones auditadas aún.</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-gray-400 uppercase">
              <tr>
                <th className="px-4 py-2 text-left">Acción</th>
                <th className="px-4 py-2 text-left">Entidad</th>
                <th className="px-4 py-2 text-left">Org</th>
                <th className="px-4 py-2 text-left">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {auditLog.map((log) => (
                <tr key={log.id} className="hover:bg-gray-900/50">
                  <td className="px-4 py-2 text-white font-medium">{log.action}</td>
                  <td className="px-4 py-2 text-gray-400">{log.entity_type}</td>
                  <td className="px-4 py-2 text-gray-500 font-mono">
                    {log.organization_id
                      ? <Link href={`/admin/organizations/${log.organization_id}`} className="text-blue-400 hover:underline">{String(log.organization_id).slice(0, 8)}…</Link>
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-500">{new Date(log.created_at).toLocaleString("es-AR")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color = "text-white" }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}
