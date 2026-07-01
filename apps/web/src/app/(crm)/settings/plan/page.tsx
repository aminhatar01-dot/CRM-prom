import { redirect } from "next/navigation";
import { getPlansAndCredits, requestPlanUpgrade } from "@/app/actions/billing";
import { isStripeConfigured, isMercadoPagoConfigured } from "@/lib/billing/providers";
import type { PublicPlan } from "@/lib/billing/checkout";

const PLAN_FEATURES: Record<string, string[]> = {
  free:       ["1.000 creditos/mes", "3 miembros", "1 asistente", "1 automatizacion", "Soporte basico"],
  starter:    ["5.000 creditos/mes", "10 miembros", "5 asistentes", "10 automatizaciones", "WhatsApp", "Soporte estandar"],
  pro:        ["20.000 creditos/mes", "25 miembros", "20 asistentes", "50 automatizaciones", "WhatsApp + WebChat", "Soporte prioritario"],
  business:   ["100.000 creditos/mes", "50 miembros", "50 asistentes", "Automatizaciones ilimitadas", "Todos los canales", "Soporte premium"],
  enterprise: ["500.000 creditos/mes", "Miembros ilimitados", "Asistentes ilimitados", "Sin limites", "SLA garantizado", "Soporte dedicado"],
};

const STATUS_LABEL: Record<string, string> = {
  trialing:  "Trial activo",
  active:    "Activo",
  past_due:  "Pago pendiente",
  cancelled: "Cancelado",
  suspended: "Suspendido",
};

export default async function SettingsPlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp      = await searchParams;
  const success = sp.success === "1";
  const error   = sp.error ? decodeURIComponent(sp.error) : null;

  const { plans, upgradeRequests, orgSubscription } = await getPlansAndCredits();
  const hasProvider = isStripeConfigured() || isMercadoPagoConfigured();

  const currentPlan = Array.isArray(orgSubscription?.plans)
    ? orgSubscription!.plans[0]
    : orgSubscription?.plans;
  const currentPlanTyped = currentPlan as { id?: string; name?: string; slug?: string; monthly_credits?: number; price_usd_monthly?: number } | null | undefined;

  const pendingRequest = upgradeRequests.find(
    (r) => (r as { status: string }).status === "pending" || (r as { status: string }).status === "checkout_pending",
  );

  async function handleUpgrade(formData: FormData) {
    "use server";
    try {
      const result = await requestPlanUpgrade(formData);
      if (result.checkoutUrl) {
        redirect(result.checkoutUrl);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      redirect(`/settings/plan?error=${encodeURIComponent(msg)}`);
    }
    redirect("/settings/plan?success=1");
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Plan y suscripcion</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Administra tu plan actual, creditos disponibles y solicitudes de upgrade.
        </p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">
          Solicitud enviada correctamente. El equipo la procesara a la brevedad.
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {/* Current plan card */}
      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">Plan actual</h2>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-2xl font-bold">{currentPlanTyped?.name ?? "Sin plan"}</div>
            {orgSubscription && (
              <div className="text-sm text-muted-foreground mt-1">
                Estado:{" "}
                <span className={orgSubscription.status === "active" || orgSubscription.status === "trialing" ? "text-green-600" : "text-yellow-600"}>
                  {STATUS_LABEL[orgSubscription.status as string] ?? orgSubscription.status}
                </span>
              </div>
            )}
            {orgSubscription?.current_period_end && (
              <div className="text-xs text-muted-foreground mt-1">
                Periodo hasta: {new Date(orgSubscription.current_period_end as string).toLocaleDateString("es-AR")}
              </div>
            )}
          </div>
          {currentPlanTyped && (
            <div className="text-right">
              <div className="text-3xl font-bold font-mono text-primary">
                {currentPlanTyped.monthly_credits?.toLocaleString() ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground">creditos/mes</div>
              {(currentPlanTyped.price_usd_monthly ?? 0) > 0 && (
                <div className="text-sm text-muted-foreground mt-1">
                  USD {currentPlanTyped.price_usd_monthly?.toFixed(2)}/mes
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pending upgrade notice */}
      {pendingRequest && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-lg px-4 py-3 text-sm">
          Tienes una solicitud de cambio de plan pendiente de aprobacion. El equipo la procesara pronto.
        </div>
      )}

      {/* Plans grid */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Planes disponibles</h2>
        {!hasProvider && (
          <p className="text-sm text-muted-foreground mb-4">
            El checkout automatico no esta configurado. Al solicitar un upgrade, se enviara una notificacion al equipo para procesarlo manualmente.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(plans as PublicPlan[]).map((plan) => {
            const isCurrent = currentPlanTyped?.slug === plan.slug;
            const features  = PLAN_FEATURES[plan.slug] ?? [];

            return (
              <div
                key={plan.id}
                className={`border rounded-lg p-5 space-y-4 ${isCurrent ? "border-primary bg-primary/5" : "bg-card"}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="text-lg font-bold">{plan.name}</div>
                    {isCurrent && (
                      <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">
                        Actual
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    {plan.price_usd_monthly === 0 ? (
                      <span className="text-2xl font-bold">Gratis</span>
                    ) : (
                      <div>
                        <span className="text-2xl font-bold">USD {plan.price_usd_monthly.toFixed(0)}</span>
                        <span className="text-sm text-muted-foreground">/mes</span>
                      </div>
                    )}
                    {plan.price_usd_annual > 0 && (
                      <div className="text-xs text-muted-foreground">
                        o USD {plan.price_usd_annual.toFixed(0)}/ano (ahorra {Math.round((1 - plan.price_usd_annual / (plan.price_usd_monthly * 12)) * 100)}%)
                      </div>
                    )}
                  </div>
                </div>

                <ul className="space-y-1.5 text-sm">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="text-green-600 mt-0.5">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {!isCurrent && plan.slug !== "free" && (
                  <form action={handleUpgrade}>
                    <input type="hidden" name="plan_id" value={plan.id} />
                    <input type="hidden" name="billing_cycle" value="monthly" />
                    <button
                      type="submit"
                      disabled={!!pendingRequest}
                      className="w-full py-2 px-4 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {plan.slug === "enterprise"
                        ? "Contactar ventas"
                        : hasProvider
                          ? "Mejorar a " + plan.name
                          : "Solicitar " + plan.name}
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upgrade requests history */}
      {upgradeRequests.length > 0 && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Solicitudes de cambio de plan
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Plan</th>
                <th className="px-4 py-3 text-left">Ciclo</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {upgradeRequests.map((req) => {
                const r = req as { id: string; billing_cycle: string; status: string; created_at: string; target_plan?: { name: string } | Array<{ name: string }> };
                const plan = Array.isArray(r.target_plan) ? r.target_plan[0] : r.target_plan;
                return (
                  <tr key={r.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{plan?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.billing_cycle}</td>
                    <td className="px-4 py-3">
                      <UpgradeStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleDateString("es-AR")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Links */}
      <div className="flex gap-4 text-sm">
        <a href="/settings/credits/buy" className="text-primary hover:underline">
          Comprar creditos adicionales →
        </a>
        <a href="/settings/billing" className="text-muted-foreground hover:underline">
          Ver facturas y pagos
        </a>
      </div>
    </div>
  );
}

function UpgradeStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:          "text-yellow-700 bg-yellow-50 border-yellow-200",
    checkout_pending: "text-blue-700 bg-blue-50 border-blue-200",
    approved:         "text-green-700 bg-green-50 border-green-200",
    rejected:         "text-red-700 bg-red-50 border-red-200",
    completed:        "text-gray-700 bg-gray-50 border-gray-200",
  };
  const labels: Record<string, string> = {
    pending:          "Pendiente",
    checkout_pending: "Pago pendiente",
    approved:         "Aprobado",
    rejected:         "Rechazado",
    completed:        "Completado",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${styles[status] ?? "bg-gray-50 border-gray-200 text-gray-700"}`}>
      {labels[status] ?? status}
    </span>
  );
}
