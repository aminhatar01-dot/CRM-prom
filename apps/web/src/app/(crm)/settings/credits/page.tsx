import { AlertTriangle, CreditCard, TrendingUp, Zap } from "lucide-react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { getCreditsOverview, addCreditsManual } from "@/app/actions/credits";
import { roleCapabilities } from "@/lib/permissions/roles";

function fmt(n: number) {
  return new Intl.NumberFormat("es-AR").format(Math.round(n));
}

function fmtCost(n: number) {
  return `$${n.toFixed(4)} USD`;
}

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const { wallet, ledger, adjustments, role } = await getCreditsOverview();
  const sp = await searchParams;
  const capabilities = roleCapabilities(role);

  if (!capabilities.manageSettings) {
    redirect("/dashboard");
  }

  const isLow =
    wallet &&
    !wallet.is_admin_exempt &&
    wallet.available_credits < wallet.low_balance_threshold;

  const totalCreditsThisPeriod = ledger.reduce((s, r) => s + r.credits_charged, 0);
  const totalCostThisPeriod = ledger.reduce((s, r) => s + r.estimated_cost_usd, 0);

  return (
    <section className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-normal">Creditos IA</h1>
        <p className="text-sm text-muted-foreground">
          Saldo, consumo y movimientos de creditos de inteligencia artificial por organizacion.
        </p>
      </div>

      {sp.success === "credits-loaded" && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Creditos cargados correctamente.
        </div>
      )}
      {sp.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {sp.error === "invalid" && "Datos invalidos. Revisa el formulario."}
          {sp.error === "forbidden" && "No tenes permisos para cargar creditos."}
          {sp.error === "load-failed" && "Error al cargar creditos. Intenta de nuevo."}
          {!["invalid", "forbidden", "load-failed"].includes(sp.error) && "Ocurrio un error inesperado."}
        </div>
      )}

      {isLow && (
        <div className="mb-4 flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Saldo bajo ({fmt(wallet!.available_credits)} creditos disponibles). Carga creditos antes de que se agote
            para evitar interrupciones en las respuestas IA.
          </span>
        </div>
      )}

      {/* Wallet summary cards */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              Saldo disponible
            </CardTitle>
          </CardHeader>
          <CardContent>
            {wallet ? (
              <p className="text-2xl font-bold">
                {wallet.is_admin_exempt ? "Ilimitado" : fmt(wallet.available_credits)}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Sin billetera</p>
            )}
            {wallet && !wallet.is_admin_exempt && (
              <p className="text-xs text-muted-foreground">creditos</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Zap className="h-4 w-4" />
              Consumo reciente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmt(totalCreditsThisPeriod)}</p>
            <p className="text-xs text-muted-foreground">creditos ({ledger.length} llamadas)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Costo estimado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{fmtCost(totalCostThisPeriod)}</p>
            <p className="text-xs text-muted-foreground">ultimas 50 operaciones</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              Total cargado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{wallet ? fmt(wallet.lifetime_credits_loaded) : "—"}</p>
            <p className="text-xs text-muted-foreground">creditos historicos</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Ledger history */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Historial de consumo</CardTitle>
          </CardHeader>
          <CardContent>
            {ledger.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavia no hay operaciones de IA registradas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="pb-2 pr-3 font-medium">Fecha</th>
                      <th className="pb-2 pr-3 font-medium">Tipo</th>
                      <th className="pb-2 pr-3 font-medium">Modelo</th>
                      <th className="pb-2 pr-3 font-medium">Modo</th>
                      <th className="pb-2 pr-3 text-right font-medium">Tokens</th>
                      <th className="pb-2 pr-3 text-right font-medium">Creditos</th>
                      <th className="pb-2 text-right font-medium">Costo USD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {ledger.map((row) => (
                      <tr key={row.id} className="align-top">
                        <td className="py-2 pr-3 text-muted-foreground">
                          {new Date(row.created_at).toLocaleString("es-AR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })}
                        </td>
                        <td className="py-2 pr-3">{row.operation_type}</td>
                        <td className="py-2 pr-3 font-mono">{row.model}</td>
                        <td className="py-2 pr-3">
                          <span
                            className={
                              row.mode === "demo"
                                ? "text-muted-foreground"
                                : "text-foreground"
                            }
                          >
                            {row.mode}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right">{fmt(row.total_tokens)}</td>
                        <td className="py-2 pr-3 text-right font-medium">{row.credits_charged.toFixed(1)}</td>
                        <td className="py-2 text-right text-muted-foreground">
                          {fmtCost(row.estimated_cost_usd)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credit adjustments */}
        <Card>
          <CardHeader>
            <CardTitle>Movimientos de saldo</CardTitle>
          </CardHeader>
          <CardContent>
            {adjustments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin cargas ni ajustes registrados.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {adjustments.map((adj) => (
                  <li key={adj.id} className="flex items-start justify-between gap-2 border-b pb-2 last:border-0 last:pb-0">
                    <div>
                      <span className="font-medium capitalize">{adj.adjustment_type}</span>
                      <p className="text-xs text-muted-foreground">{adj.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(adj.created_at).toLocaleDateString("es-AR")}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 font-semibold ${adj.amount >= 0 ? "text-green-700" : "text-red-700"}`}
                    >
                      {adj.amount >= 0 ? "+" : ""}
                      {fmt(adj.amount)} cr
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Manual credit load form (admin/owner only) */}
        <Card>
          <CardHeader>
            <CardTitle>Cargar creditos</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={addCreditsManual} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="amount">
                  Cantidad de creditos
                </label>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  min={1}
                  max={1000000}
                  step={100}
                  required
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="1000"
                />
                <p className="mt-1 text-xs text-muted-foreground">1 credito ≈ 1000 tokens de OpenAI.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium" htmlFor="reason">
                  Motivo
                </label>
                <input
                  id="reason"
                  name="reason"
                  type="text"
                  required
                  maxLength={500}
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Carga inicial, pago cliente, ajuste..."
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
              >
                Cargar creditos
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
