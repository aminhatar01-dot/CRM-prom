import { redirect } from "next/navigation";
import { getPlansAndCredits, purchaseCredits } from "@/app/actions/billing";
import { isStripeConfigured, isMercadoPagoConfigured } from "@/lib/billing/providers";
import type { CreditPackage } from "@/lib/billing/checkout";

export default async function BuyCreditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp      = await searchParams;
  const success = sp.success === "1";
  const error   = sp.error ? decodeURIComponent(sp.error) : null;

  const { packages, wallet, checkoutSessions } = await getPlansAndCredits();
  const hasProvider = isStripeConfigured() || isMercadoPagoConfigured();

  const availableCredits = (wallet?.available_credits as number | undefined) ?? 0;
  const isLow = availableCredits < 100;

  const recentPurchases = (checkoutSessions as Array<{ session_type: string; status: string; credits_amount: number; created_at: string; id: string }>)
    .filter((s) => s.session_type === "credit_purchase")
    .slice(0, 5);

  async function handlePurchase(formData: FormData) {
    "use server";
    try {
      const result = await purchaseCredits(formData);
      if (result.checkoutUrl) {
        redirect(result.checkoutUrl);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error";
      redirect(`/settings/credits/buy?error=${encodeURIComponent(msg)}`);
    }
    redirect("/settings/credits/buy?success=1");
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Comprar creditos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Agrega creditos IA adicionales a tu cuenta.
        </p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">
          {hasProvider
            ? "Redirigiendo al checkout..."
            : "Solicitud registrada. El equipo acreditara los creditos al confirmar el pago."}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 text-sm">{error}</div>
      )}

      {/* Current balance */}
      <div className="bg-card border rounded-lg p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Creditos disponibles</h2>
        <div className="flex items-baseline gap-3">
          <div className={`text-4xl font-bold font-mono ${isLow ? "text-red-500" : "text-green-500"}`}>
            {availableCredits.toLocaleString()}
          </div>
          <div className="text-muted-foreground text-sm">creditos</div>
        </div>
        {isLow && (
          <div className="mt-2 text-sm text-red-600">
            Tus creditos estan bajos. Compra un paquete para continuar usando la IA.
          </div>
        )}
      </div>

      {/* Provider notice */}
      {!hasProvider && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg px-4 py-3 text-sm">
          El checkout automatico no esta configurado. Al comprar un paquete, se registrara la solicitud y el equipo procesara el pago manualmente. Nos pondremos en contacto a la brevedad.
        </div>
      )}

      {/* Credit packages */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Paquetes disponibles</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(packages as CreditPackage[]).map((pkg) => (
            <div key={pkg.id} className="bg-card border rounded-lg p-5 space-y-4">
              <div>
                <div className="text-lg font-bold">{pkg.name}</div>
                <div className="text-3xl font-bold font-mono text-primary mt-1">
                  {pkg.credits.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">creditos</div>
              </div>
              <div className="text-2xl font-semibold">
                {pkg.currency} {(pkg.price_cents / 100).toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">
                {((pkg.price_cents / pkg.credits) * 100).toFixed(2)} centavos por credito
              </div>
              <form action={handlePurchase}>
                <input type="hidden" name="package_id" value={pkg.id} />
                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {hasProvider ? "Comprar ahora" : "Solicitar paquete"}
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>

      {/* Recent purchases */}
      {recentPurchases.length > 0 && (
        <div className="bg-card border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Compras recientes</h2>
          </div>
          <table className="w-full text-sm">
            <thead className="text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-right">Creditos</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3 text-left">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentPurchases.map((s) => (
                <tr key={s.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    +{s.credits_amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <PurchaseStatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString("es-AR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tip */}
      <p className="text-xs text-muted-foreground">
        Los creditos se acreditan automaticamente al confirmar el pago. En modo manual, el equipo los acreditara en las proximas horas habiles.
      </p>
    </div>
  );
}

function PurchaseStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:   "text-yellow-700 bg-yellow-50 border-yellow-200",
    completed: "text-green-700 bg-green-50 border-green-200",
    expired:   "text-gray-600 bg-gray-50 border-gray-200",
    cancelled: "text-red-700 bg-red-50 border-red-200",
  };
  const labels: Record<string, string> = {
    pending:   "Pendiente",
    completed: "Completado",
    expired:   "Expirado",
    cancelled: "Cancelado",
  };
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded border ${styles[status] ?? "bg-gray-50 border-gray-200 text-gray-700"}`}>
      {labels[status] ?? status}
    </span>
  );
}
