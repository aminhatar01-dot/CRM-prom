import { adminListPlans } from "@/app/actions/admin";

export default async function AdminPlansPage() {
  const plans = await adminListPlans();

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Planes SaaS ({plans.length})</h1>

      <div className="grid gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-gray-900 border border-gray-800 rounded-lg p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold text-white">{plan.name}</h2>
                  <code className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">{plan.slug}</code>
                  {!plan.is_public && (
                    <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded">interno</span>
                  )}
                  {!plan.active && (
                    <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded">inactivo</span>
                  )}
                </div>
                <p className="text-sm text-gray-400 mt-1">{plan.description}</p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-green-400">
                  ${plan.price_usd_monthly.toFixed(2)}<span className="text-sm text-gray-400">/mes</span>
                </div>
                <div className="text-sm text-blue-400 font-mono">
                  {plan.monthly_credits.toLocaleString()} créditos/mes
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3 text-xs">
              <LimitBadge label="Miembros" value={plan.max_members} />
              <LimitBadge label="Asistentes" value={plan.max_assistants} />
              <LimitBadge label="Automatizaciones" value={plan.max_automations} />
              <LimitBadge label="Integraciones" value={plan.max_integrations} />
              <LimitBadge label="Documentos" value={plan.max_documents} />
              <LimitBadge label="Conversaciones" value={plan.max_conversations} />
              <LimitBadge label="Storage (MB)" value={plan.max_storage_mb} />
            </div>

            {Object.keys(plan.features).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {Object.entries(plan.features).map(([k, v]) => (
                  <span key={k} className="text-xs bg-indigo-900/40 text-indigo-300 px-2 py-0.5 rounded">
                    {k}: {String(v)}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function LimitBadge({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="bg-gray-800 rounded p-2">
      <div className="text-gray-400">{label}</div>
      <div className={`font-mono font-semibold ${value == null ? "text-green-400" : "text-white"}`}>
        {value == null ? "∞" : value.toLocaleString()}
      </div>
    </div>
  );
}
