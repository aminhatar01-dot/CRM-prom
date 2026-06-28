import { CheckCircle2, XCircle, Clock, AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { Button } from "@crm-pro-ai/ui/button";
import { getOperationsDashboard, retryDeadLetterJobAction, cancelJobAction } from "@/app/actions/operations";
import { roleCapabilities } from "@/lib/permissions/roles";

const SEVERITY_CONFIG = {
  info:     { label: "Info",     color: "text-blue-600",   bg: "bg-blue-50"   },
  warning:  { label: "Warning",  color: "text-yellow-600", bg: "bg-yellow-50" },
  error:    { label: "Error",    color: "text-red-600",    bg: "bg-red-50"    },
  critical: { label: "Crítico",  color: "text-red-800",    bg: "bg-red-100"   },
} as const;

const SOURCE_LABELS: Record<string, string> = {
  whatsapp:   "WhatsApp",
  ai:         "IA",
  integration: "Integración",
  automation: "Automatización",
  knowledge:  "Conocimiento",
  quote:      "Cotización",
  billing:    "Billing",
  job:        "Cola de trabajos",
  system:     "Sistema",
  webhook:    "Webhook",
  auth:       "Autenticación",
};

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const { stats, dlJobs, recentErrors, health, role } = await getOperationsDashboard();
  const capabilities = roleCapabilities(role);
  if (!capabilities.manageSettings) redirect("/dashboard");

  const healthOk = health.status === "ok";
  const dlCount = stats.dead_letter;

  return (
    <section className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-normal">Estado operativo</h1>
        <p className="text-sm text-muted-foreground">
          Cola de trabajos, errores recientes y métricas del sistema.
        </p>
      </div>

      {/* Alerts */}
      {sp.retried && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Trabajo reiniciado correctamente.
        </div>
      )}
      {sp.cancelled && (
        <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Trabajo cancelado.
        </div>
      )}
      {sp.error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {sp.error === "retry-failed"  && "Error al reintentar el trabajo."}
          {sp.error === "cancel-failed" && "Error al cancelar el trabajo."}
          {sp.error === "missing-job"   && "ID de trabajo faltante."}
          {!["retry-failed", "cancel-failed", "missing-job"].includes(sp.error) && "Ocurrió un error."}
        </div>
      )}

      {/* Healthcheck */}
      <Card className={`mb-6 border-l-4 ${healthOk ? "border-l-green-500" : "border-l-yellow-500"}`}>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            {healthOk
              ? <CheckCircle2 className="h-4 w-4 text-green-600" />
              : <AlertTriangle className="h-4 w-4 text-yellow-600" />
            }
            Sistema {healthOk ? "operativo" : "degradado"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">IA</span>
              <span className={health.features.ai === "openai" ? "text-green-600 font-medium" : "text-yellow-600"}>
                {health.features.ai === "openai" ? "OpenAI" : "Demo"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">WhatsApp</span>
              <span className={health.features.whatsappConfigured ? "text-green-600 font-medium" : "text-slate-400"}>
                {health.features.whatsappConfigured ? "Configurado" : "No configurado"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cron</span>
              <span className={health.features.cronConfigured ? "text-green-600 font-medium" : "text-slate-400"}>
                {health.features.cronConfigured ? "Activo" : "Sin configurar"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hub providers</span>
              <span className="font-medium">{health.features.integrationHubProviders}</span>
            </div>
            {health.jobQueue && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Trabajos DLQ</span>
                <span className={health.jobQueue.dead_letter > 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                  {health.jobQueue.dead_letter}
                </span>
              </div>
            )}
            {health.credits && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Créditos IA</span>
                <span className={health.credits.active ? "text-green-600 font-medium" : "text-yellow-600"}>
                  {health.credits.active ? "Activos" : "Sin orgs con créditos"}
                </span>
              </div>
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Última migración: {health.features.lastMigration}
          </p>
        </CardContent>
      </Card>

      {/* Job Queue stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {(
          [
            { key: "pending",     label: "Pendientes",   color: "text-blue-600" },
            { key: "running",     label: "En proceso",   color: "text-yellow-600" },
            { key: "completed",   label: "Completados",  color: "text-green-600" },
            { key: "failed",      label: "Fallidos",     color: "text-orange-600" },
            { key: "dead_letter", label: "Dead Letter",  color: "text-red-600" },
            { key: "cancelled",   label: "Cancelados",   color: "text-slate-400" },
          ] as const
        ).map(({ key, label, color }) => (
          <Card key={key} className="p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{stats[key]}</p>
          </Card>
        ))}
      </div>

      {/* Dead Letter Queue */}
      {dlCount > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <XCircle className="h-4 w-4 text-red-600" />
              Dead Letter Queue ({dlCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {dlJobs.map((job) => (
                <div key={job.id} className="rounded-md border border-red-100 bg-red-50 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{job.job_type}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {job.attempts} intentos &middot; {job.failed_at ? new Date(job.failed_at).toLocaleString("es-AR") : "—"}
                      </p>
                      {job.error_message && (
                        <p className="mt-1 line-clamp-2 text-xs text-red-700">{job.error_message}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <form action={retryDeadLetterJobAction}>
                        <input type="hidden" name="job_id" value={job.id} />
                        <Button type="submit" variant="outline" size="sm" className="gap-1 text-xs">
                          <RefreshCw className="h-3 w-3" />
                          Reintentar
                        </Button>
                      </form>
                      <form action={cancelJobAction}>
                        <input type="hidden" name="job_id" value={job.id} />
                        <Button type="submit" variant="outline" size="sm" className="gap-1 text-xs text-red-600 hover:bg-red-50">
                          <Trash2 className="h-3 w-3" />
                          Cancelar
                        </Button>
                      </form>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {dlCount === 0 && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="flex items-center gap-2 py-4 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4" />
            No hay trabajos en Dead Letter Queue.
          </CardContent>
        </Card>
      )}

      {/* Recent errors */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Errores recientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin errores recientes.</p>
          ) : (
            <div className="divide-y">
              {recentErrors.map((log) => {
                const cfg = SEVERITY_CONFIG[log.severity] ?? SEVERITY_CONFIG.error;
                return (
                  <div key={log.id} className="py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${cfg.color} ${cfg.bg}`}>
                        {cfg.label}
                      </span>
                      <span className="rounded border px-1.5 py-0.5 text-xs text-muted-foreground">
                        {SOURCE_LABELS[log.source] ?? log.source}
                      </span>
                      <span className="text-xs font-medium">{log.event_type}</span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("es-AR")}
                      </span>
                    </div>
                    {log.message && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{log.message}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
