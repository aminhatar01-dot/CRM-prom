import { CheckCircle2, Circle, Clock, AlertCircle, XCircle, ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { Button } from "@crm-pro-ai/ui/button";
import {
  getConnectionDetail,
  disconnectIntegrationConnection,
  testIntegrationConnection,
  deleteIntegrationConnection,
} from "@/app/actions/integration-hub";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { roleCapabilities } from "@/lib/permissions/roles";

const STATUS_CONFIG: Record<string, { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  connected:     { label: "Conectado",            color: "text-green-600",  Icon: CheckCircle2 },
  disconnected:  { label: "Desconectado",          color: "text-slate-400",  Icon: Circle },
  expired:       { label: "Expirado",              color: "text-yellow-600", Icon: Clock },
  requires_auth: { label: "Requiere autorización", color: "text-orange-500", Icon: AlertCircle },
  error:         { label: "Error",                 color: "text-red-600",    Icon: XCircle },
};

const EVENT_LABELS: Record<string, string> = {
  connected:          "Conectado",
  disconnected:       "Desconectado",
  refreshed:          "Token renovado",
  expired:            "Token expirado",
  error:              "Error",
  health_check:       "Prueba de conexion",
  health_ok:          "Conexion OK",
  synced:             "Sincronizado",
  tool_executed:      "Herramienta ejecutada",
  credential_stored:  "Credencial guardada",
  credential_rotated: "Credencial rotada",
};

export default async function ConnectionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const capabilities = roleCapabilities(organization.role);

  const detail = await getConnectionDetail(id);
  if (!detail) redirect("/integrations/hub?error=not-found");

  const { connection, logs } = detail;
  const cfg = STATUS_CONFIG[connection.status] ?? STATUS_CONFIG.disconnected;
  const { Icon } = cfg;

  return (
    <section className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
          <Link href="/integrations/hub">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Integration Hub
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-normal">{connection.display_name}</h1>
            <p className="text-sm text-muted-foreground">Proveedor: {connection.provider_key}</p>
          </div>
          <span className={`flex items-center gap-1.5 text-sm font-medium ${cfg.color}`}>
            <Icon className="h-4 w-4" />
            {cfg.label}
          </span>
        </div>
      </div>

      {sp.created && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Conexion creada. Para activarla, completa el proceso de autorizacion OAuth desde el proveedor.
        </div>
      )}
      {sp.tested && (
        <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Prueba de conexion registrada. Revisa el historial de eventos.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Connection info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Detalles de la conexion</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Row label="ID" value={connection.id} mono />
              <Row label="Proveedor" value={connection.provider_key} />
              <Row label="Estado" value={cfg.label} />
              {connection.external_account_id && (
                <Row label="Cuenta externa" value={connection.external_account_id} />
              )}
              {connection.external_account_name && (
                <Row label="Nombre de cuenta" value={connection.external_account_name} />
              )}
              {connection.scopes.length > 0 && (
                <Row label="Permisos" value={connection.scopes.join(", ")} />
              )}
              {connection.expires_at && (
                <Row label="Expira" value={new Date(connection.expires_at).toLocaleString("es-AR")} />
              )}
              {connection.last_refreshed_at && (
                <Row label="Ultima renovacion" value={new Date(connection.last_refreshed_at).toLocaleString("es-AR")} />
              )}
              {connection.last_sync_at && (
                <Row label="Ultima sync" value={new Date(connection.last_sync_at).toLocaleString("es-AR")} />
              )}
              {connection.last_error && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase">Ultimo error</p>
                  <p className="mt-0.5 text-red-600">{connection.last_error}</p>
                </div>
              )}
              <Row label="Creada" value={new Date(connection.created_at).toLocaleString("es-AR")} />
            </CardContent>
          </Card>

          {/* Tools */}
          <Card>
            <CardHeader>
              <CardTitle>Herramientas disponibles ({connection.tools.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {connection.tools.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin herramientas registradas.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {connection.tools.map((tool) => (
                    <li key={tool.id} className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
                      <div>
                        <p className="font-medium">{tool.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{tool.tool_key}</p>
                      </div>
                      <span
                        className={`text-xs font-medium ${tool.enabled ? "text-green-600" : "text-slate-400"}`}
                      >
                        {tool.enabled ? "habilitada" : "deshabilitada"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Event log */}
          <Card>
            <CardHeader>
              <CardTitle>Historial de eventos</CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin eventos registrados.</p>
              ) : (
                <ul className="divide-y text-xs">
                  {logs.map((log) => (
                    <li key={log.id} className="py-2 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-medium">{EVENT_LABELS[log.event_type] ?? log.event_type}</span>
                        <span className="shrink-0 text-muted-foreground">
                          {new Date(log.created_at).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </div>
                      {log.message && <p className="mt-0.5 text-muted-foreground">{log.message}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        {capabilities.manageIntegrations && (
          <div className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle>Acciones</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <form action={testIntegrationConnection}>
                  <input type="hidden" name="connection_id" value={connection.id} />
                  <button
                    type="submit"
                    className="w-full rounded-md border px-3 py-2 text-sm hover:bg-muted focus:outline-none"
                  >
                    Probar conexion
                  </button>
                </form>

                <p className="text-xs text-muted-foreground">
                  Para conectar: completa el proceso OAuth desde el panel de tu proveedor y actualiza el estado manualmente mientras la integracion OAuth directa esta en desarrollo.
                </p>

                {connection.status === "connected" && (
                  <form action={disconnectIntegrationConnection}>
                    <input type="hidden" name="connection_id" value={connection.id} />
                    <button
                      type="submit"
                      className="w-full rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-800 hover:bg-yellow-100 focus:outline-none"
                    >
                      Desconectar
                    </button>
                  </form>
                )}

                <form action={deleteIntegrationConnection}>
                  <input type="hidden" name="connection_id" value={connection.id} />
                  <button
                    type="submit"
                    className="w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 hover:bg-red-100 focus:outline-none"
                  >
                    Eliminar conexion
                  </button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase">{label}</p>
      <p className={`mt-0.5 ${mono ? "font-mono text-xs" : ""}`}>{value}</p>
    </div>
  );
}
