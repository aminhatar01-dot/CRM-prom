import { getMyBillingStatus } from "@/app/actions/billing";
import { isStripeConfigured, isMercadoPagoConfigured } from "@/lib/billing/providers";

const STATUS_COLORS: Record<string, string> = {
  paid:          "text-green-400",
  open:          "text-yellow-400",
  draft:         "text-gray-400",
  void:          "text-gray-500",
  uncollectible: "text-red-400",
};

const SUB_STATUS_LABEL: Record<string, string> = {
  trialing:  "Trial activo",
  active:    "Activo",
  past_due:  "Pago pendiente",
  cancelled: "Cancelado",
  suspended: "Suspendido",
  unpaid:    "Sin pago",
};

export default async function SettingsBillingPage() {
  const { subscription, invoices, payments, wallet, orgSubscription } = await getMyBillingStatus();
  const hasStripe = isStripeConfigured();
  const hasMercadoPago = isMercadoPagoConfigured();

  const plan = Array.isArray(orgSubscription?.plans) ? orgSubscription!.plans[0] : orgSubscription?.plans;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Suscripción y facturación</h1>

      {/* Current plan */}
      <div className="bg-card border rounded-lg p-5 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Plan actual</h2>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-xl font-bold">{plan?.name ?? "Sin plan"}</div>
            {subscription && (
              <div className="text-sm text-muted-foreground mt-1">
                Estado: <span className={subscription.status === "active" ? "text-green-500" : "text-yellow-500"}>
                  {SUB_STATUS_LABEL[subscription.status] ?? subscription.status}
                </span>
              </div>
            )}
          </div>
          {plan && (
            <div className="text-right">
              <div className="text-2xl font-bold font-mono text-primary">
                {plan.monthly_credits?.toLocaleString() ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground">créditos/mes</div>
            </div>
          )}
        </div>

        {subscription?.current_period_end && (
          <div className="text-xs text-muted-foreground">
            Período actual hasta: {new Date(subscription.current_period_end).toLocaleDateString("es-AR")}
          </div>
        )}

        {subscription?.trial_end && subscription.status === "trialing" && (
          <div className="text-xs text-yellow-500">
            Trial termina: {new Date(subscription.trial_end).toLocaleDateString("es-AR")}
          </div>
        )}
      </div>

      {/* Credits */}
      {wallet && (
        <div className="bg-card border rounded-lg p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Créditos IA</h2>
          <div className="flex gap-6">
            <div>
              <div className={`text-2xl font-bold font-mono ${(wallet.available_credits as number) < 50 ? "text-red-500" : "text-green-500"}`}>
                {(wallet.available_credits as number).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">disponibles</div>
            </div>
            <div>
              <div className="text-2xl font-bold font-mono text-muted-foreground">
                {(wallet.lifetime_credits_used as number).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground">usados total</div>
            </div>
          </div>
          {(wallet.available_credits as number) < 50 && (
            <div className="mt-3 text-sm text-red-500">
              ⚠ Créditos bajos. Contacta a soporte para recargar tu plan.
            </div>
          )}
        </div>
      )}

      {/* Checkout / upgrade prompt */}
      <div className="bg-card border rounded-lg p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Mejorar plan</h2>
        {hasStripe || hasMercadoPago ? (
          <p className="text-sm text-muted-foreground">
            Checkout disponible. Contacta a tu responsable de cuenta para iniciar el proceso.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Para mejorar tu plan o aumentar créditos, contactá al equipo en{" "}
            <a href="mailto:hola@crmproai.com" className="text-primary hover:underline">
              hola@crmproai.com
            </a>.
          </p>
        )}
      </div>

      {/* Invoices */}
      {invoices.length > 0 && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Facturas</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Nro.</th>
                <th className="px-4 py-3 text-left">Descripción</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{inv.number ?? inv.id.slice(0, 8)}</td>
                  <td className="px-4 py-3 truncate max-w-xs">{inv.description}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    {inv.currency} {(inv.amount_cents / 100).toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 text-xs font-medium ${STATUS_COLORS[inv.status] ?? ""}`}>
                    {inv.status}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(inv.created_at).toLocaleDateString("es-AR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* No invoices yet */}
      {invoices.length === 0 && (
        <div className="bg-card border rounded-lg p-6 text-center">
          <p className="text-muted-foreground text-sm">Sin facturas registradas aún.</p>
        </div>
      )}

      {/* Recent payments */}
      {payments.length > 0 && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pagos recientes</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Método</th>
                <th className="px-4 py-3 text-right">Monto</th>
                <th className="px-4 py-3 text-right">Créditos</th>
                <th className="px-4 py-3 text-left">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-muted-foreground">{p.method}</td>
                  <td className="px-4 py-3 text-right font-mono">{p.currency} {(p.amount_cents / 100).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-blue-500">
                    {p.credits_granted > 0 ? `+${p.credits_granted.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString("es-AR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
