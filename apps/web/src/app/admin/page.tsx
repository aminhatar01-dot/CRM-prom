import { adminGetSystemStatus } from "@/app/actions/admin";

export default async function AdminDashboard() {
  const status = await adminGetSystemStatus();

  const stats = [
    { label: "Organizaciones", value: status.total_organizations, color: "text-blue-400" },
    { label: "Jobs pendientes", value: status.jobs_pending, color: "text-yellow-400" },
    { label: "Jobs running", value: status.jobs_running, color: "text-green-400" },
    { label: "Dead Letter", value: status.jobs_dead_letter, color: "text-red-400" },
    { label: "Errores 24h", value: status.errors_last_24h, color: "text-orange-400" },
    { label: "Orgs sin créditos", value: status.low_credit_orgs, color: "text-purple-400" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Panel Admin</h1>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-gray-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <QuickLink href="/admin/organizations" title="Organizaciones" desc="Ver y gestionar clientes" />
        <QuickLink href="/admin/plans" title="Planes SaaS" desc="Configurar planes y límites" />
        <QuickLink href="/admin/credits" title="Créditos IA" desc="Cargar y revisar saldos" />
        <QuickLink href="/admin/system" title="Sistema" desc="Jobs, logs y healthcheck" />
      </div>
    </div>
  );
}

function QuickLink({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <a href={href} className="block bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition-colors">
      <div className="font-semibold text-white">{title}</div>
      <div className="text-sm text-gray-400 mt-1">{desc}</div>
    </a>
  );
}
