import { CheckCircle2, Circle, Clock, AlertCircle, XCircle, Plus, Zap } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@crm-pro-ai/ui/card";
import { Button } from "@crm-pro-ai/ui/button";
import { getIntegrationHubOverview, createIntegrationConnection } from "@/app/actions/integration-hub";
import { roleCapabilities } from "@/lib/permissions/roles";
import { getAllProviderMetadata } from "@crm-pro-ai/integrations/provider-registry";

type StatusConfig = {
  label: string;
  color: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const STATUS_CONFIG: Record<string, StatusConfig> = {
  connected:      { label: "Conectado",           color: "text-green-600",  Icon: CheckCircle2 },
  disconnected:   { label: "Desconectado",         color: "text-slate-400",  Icon: Circle },
  expired:        { label: "Expirado",             color: "text-yellow-600", Icon: Clock },
  requires_auth:  { label: "Requiere autorización", color: "text-orange-500", Icon: AlertCircle },
  error:          { label: "Error",                color: "text-red-600",    Icon: XCircle },
};

const CATEGORY_LABELS: Record<string, string> = {
  messaging:    "Mensajería",
  social:       "Social",
  ecommerce:    "E-commerce",
  productivity: "Productividad",
  advertising:  "Publicidad",
  storage:      "Almacenamiento",
  other:        "Otros",
};

export default async function IntegrationHubPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const { connections, role } = await getIntegrationHubOverview();
  const capabilities = roleCapabilities(role);
  const allProviders = getAllProviderMetadata();

  if (!capabilities.manageIntegrations) {
    redirect("/dashboard");
  }

  const byCategory = allProviders.reduce<Record<string, typeof allProviders>>((acc, p) => {
    (acc[p.category] ??= []).push(p);
    return acc;
  }, {});

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Integration Hub</h1>
          <p className="text-sm text-muted-foreground">
            Conectá las cuentas externas de tu organización. Cada conexión puede exponer herramientas a los asistentes IA.
          </p>
        </div>
      </div>

      {/* Alerts */}
      {sp.disconnected && (
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Conexion desconectada correctamente.
        </div>
      )}
      {sp.deleted && (
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Conexion eliminada.
        </div>
      )}
      {sp.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {sp.error === "forbidden" && "No tienes permisos para gestionar integraciones."}
          {sp.error === "unknown-provider" && "Proveedor desconocido."}
          {sp.error === "create-failed" && "Error al crear la conexion. Intenta de nuevo."}
          {!["forbidden", "unknown-provider", "create-failed"].includes(sp.error) && "Ocurrio un error inesperado."}
        </div>
      )}

      {/* Active connections */}
      {connections.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-base font-medium">Mis conexiones ({connections.length})</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {connections.map((conn) => {
              const cfg = STATUS_CONFIG[conn.status] ?? STATUS_CONFIG.disconnected;
              const { Icon } = cfg;
              return (
                <Card key={conn.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-base font-semibold leading-tight">{conn.providerEmoji} {conn.display_name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{conn.providerName}</p>
                      </div>
                      <span className={`flex items-center gap-1 text-xs font-medium ${cfg.color}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {cfg.label}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col justify-between gap-3">
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {conn.external_account_name && (
                        <p>Cuenta: {conn.external_account_name}</p>
                      )}
                      <p>{conn.toolCount} herramienta{conn.toolCount !== 1 ? "s" : ""} disponible{conn.toolCount !== 1 ? "s" : ""}</p>
                      {conn.last_sync_at && (
                        <p>Ultima sync: {new Date(conn.last_sync_at).toLocaleDateString("es-AR")}</p>
                      )}
                      {conn.last_error && (
                        <p className="text-red-600 line-clamp-1">{conn.last_error}</p>
                      )}
                    </div>
                    <Button asChild variant="outline" size="sm" className="w-full">
                      <Link href={`/integrations/hub/${conn.id}`}>Ver detalles</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Provider catalog */}
      <div>
        <h2 className="mb-3 text-base font-medium">Proveedores disponibles</h2>
        {Object.entries(byCategory).map(([category, providers]) => (
          <div key={category} className="mb-6">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {CATEGORY_LABELS[category] ?? category}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {providers.map((provider) => {
                const orgConnections = connections.filter((c) => c.provider_key === provider.key);
                return (
                  <Card key={provider.key}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium leading-tight">
                            {provider.iconEmoji} {provider.name}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{provider.description}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span className="rounded border px-1.5 py-0.5 text-xs">{provider.authType}</span>
                        <span className="rounded border px-1.5 py-0.5 text-xs">
                          <Zap className="mr-0.5 inline h-3 w-3" />
                          {provider.toolCount} tools
                        </span>
                        {orgConnections.length > 0 && (
                          <span className="rounded border border-green-200 bg-green-50 px-1.5 py-0.5 text-xs text-green-700">
                            {orgConnections.length} conexión{orgConnections.length > 1 ? "es" : ""}
                          </span>
                        )}
                      </div>
                      {capabilities.manageIntegrations && (
                        <form action={createIntegrationConnection} className="mt-3 flex gap-2">
                          <input type="hidden" name="provider_key" value={provider.key} />
                          <input
                            name="display_name"
                            type="text"
                            required
                            maxLength={120}
                            placeholder={`${provider.name} principal`}
                            className="flex-1 rounded border px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          />
                          <button
                            type="submit"
                            className="flex items-center gap-1 rounded bg-primary px-2 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                          >
                            <Plus className="h-3 w-3" />
                            Agregar
                          </button>
                        </form>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
