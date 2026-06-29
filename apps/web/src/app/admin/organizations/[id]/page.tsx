import { adminGetOrganization, adminListPlans } from "@/app/actions/admin";
import { adminSetSubscription, adminLoadCredits, adminAdjustCredits, adminSetAdminExempt } from "@/app/actions/admin";
import { notFound } from "next/navigation";

export default async function AdminOrgDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [org, plans] = await Promise.all([
    adminGetOrganization(id),
    adminListPlans(),
  ]);

  if (!org) notFound();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <a href="/admin/organizations" className="text-gray-500 hover:text-white text-sm">← Organizaciones</a>
        <h1 className="text-2xl font-bold">{org.name}</h1>
        <code className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400">{org.slug}</code>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Créditos disponibles" value={org.wallet?.available_credits?.toLocaleString() ?? "—"} color={org.wallet && org.wallet.available_credits < 50 ? "text-red-400" : "text-green-400"} />
        <StatCard label="Créditos usados (total)" value={org.wallet?.lifetime_credits_used?.toLocaleString() ?? "—"} color="text-blue-400" />
        <StatCard label="Miembros" value={String(org.member_count)} color="text-white" />
      </div>

      {/* Suscripción */}
      <Section title="Suscripción y plan">
        <form action={adminSetSubscription} className="space-y-3">
          <input type="hidden" name="org_id" value={org.id} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Plan</label>
              <select name="plan_slug" defaultValue={org.subscription?.plan_slug ?? ""} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white">
                {plans.map((p) => (
                  <option key={p.slug} value={p.slug}>{p.name} ({p.slug})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Estado de suscripción</label>
              <select name="status" defaultValue={org.subscription?.status ?? "trial"} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white">
                {["trial", "active", "suspended", "cancelled"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Estado comercial</label>
              <select name="commercial_status" defaultValue={org.subscription?.commercial_status ?? "prospect"} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white">
                {["prospect", "pilot", "active", "past_due", "suspended", "churned"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Trial hasta</label>
              <input type="date" name="trial_ends_at" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Notas internas</label>
            <textarea name="internal_notes" defaultValue={org.subscription_notes} rows={2} className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white" />
          </div>
          <button type="submit" className="bg-blue-700 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium">
            Guardar cambios
          </button>
        </form>
      </Section>

      {/* Créditos */}
      <Section title="Cargar créditos">
        <form action={adminLoadCredits} className="flex gap-3 items-end">
          <input type="hidden" name="org_id" value={org.id} />
          <div>
            <label className="block text-xs text-gray-400 mb-1">Monto</label>
            <input type="number" name="amount" min="1" placeholder="5000" className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white w-32" required />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Motivo</label>
            <input type="text" name="reason" placeholder="Pago mensual plan Starter" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white" required />
          </div>
          <button type="submit" className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded text-sm font-medium whitespace-nowrap">
            + Cargar créditos
          </button>
        </form>
      </Section>

      <Section title="Ajuste de créditos">
        <form action={adminAdjustCredits} className="flex gap-3 items-end">
          <input type="hidden" name="org_id" value={org.id} />
          <div>
            <label className="block text-xs text-gray-400 mb-1">Monto (negativo = descuento)</label>
            <input type="number" name="amount" placeholder="-500 o +1000" className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white w-36" required />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-400 mb-1">Motivo del ajuste</label>
            <input type="text" name="reason" placeholder="Corrección por error de facturación" className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white" required />
          </div>
          <button type="submit" className="bg-orange-700 hover:bg-orange-600 text-white px-4 py-2 rounded text-sm font-medium">
            Ajustar
          </button>
        </form>
      </Section>

      {/* Admin exempt */}
      <Section title="Configuración especial">
        <form action={adminSetAdminExempt} className="flex items-center gap-4">
          <input type="hidden" name="org_id" value={org.id} />
          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input type="checkbox" name="exempt" value="true" defaultChecked={org.wallet?.is_admin_exempt} className="w-4 h-4" />
            Exento de créditos (demo / admin)
          </label>
          <button type="submit" className="bg-purple-700 hover:bg-purple-600 text-white px-3 py-1.5 rounded text-xs font-medium">
            Guardar
          </button>
        </form>
      </Section>

      {/* Members */}
      <Section title={`Miembros (${org.members.length})`}>
        <table className="w-full text-sm">
          <thead className="text-gray-400 text-xs uppercase">
            <tr>
              <th className="text-left py-2">Email</th>
              <th className="text-left py-2">Rol</th>
              <th className="text-left py-2">Desde</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {org.members.map((m) => (
              <tr key={m.user_id}>
                <td className="py-2 text-white">{m.email || <span className="text-gray-500 font-mono text-xs">{m.user_id.slice(0, 8)}…</span>}</td>
                <td className="py-2 text-gray-400">{m.role}</td>
                <td className="py-2 text-gray-500">{new Date(m.created_at).toLocaleDateString("es-AR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      {/* Integrations */}
      {org.integrations.length > 0 && (
        <Section title={`Integraciones conectadas (${org.integrations.length})`}>
          <div className="flex flex-wrap gap-2">
            {org.integrations.map((i, idx) => (
              <span key={idx} className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded">
                {i.provider_key} — {i.display_name}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Recent errors */}
      {org.recent_errors.length > 0 && (
        <Section title="Errores recientes">
          <div className="space-y-2">
            {org.recent_errors.map((e, idx) => (
              <div key={idx} className="flex gap-3 text-xs">
                <span className="text-red-400 shrink-0">{e.severity}</span>
                <span className="text-gray-300 flex-1 truncate">{e.message}</span>
                <span className="text-gray-500">{new Date(e.created_at).toLocaleString("es-AR")}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Failed jobs */}
      {org.failed_jobs.length > 0 && (
        <Section title="Jobs fallidos">
          <div className="space-y-2">
            {org.failed_jobs.map((j, idx) => (
              <div key={idx} className="flex gap-3 text-xs">
                <span className="text-orange-400 shrink-0">{j.job_type}</span>
                <span className="text-gray-400 shrink-0">{j.status}</span>
                <span className="text-gray-500 flex-1 truncate">{j.error_message ?? "—"}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
      <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">{title}</h2>
      {children}
    </div>
  );
}
