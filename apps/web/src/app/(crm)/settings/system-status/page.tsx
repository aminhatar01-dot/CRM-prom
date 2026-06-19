import { CheckCircle2, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { roleCapabilities } from "@/lib/permissions/roles";
import { getHealthStatus } from "@/lib/system/health";

export default async function SystemStatusPage() {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const health = getHealthStatus();
  const capabilities = roleCapabilities(organization.role);

  if (!capabilities.manageSettings) {
    redirect("/dashboard");
  }

  const { count: integrationRunsCount } = await supabase
    .from("integration_tool_runs")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organization.id);

  const items = [
    { label: "Env vars requeridas", ok: health.env.ok, detail: health.env.issues.join("; ") || "OK" },
    { label: "Service role server-side", ok: health.features.serviceRoleConfigured, detail: health.features.serviceRoleConfigured ? "Configurado" : "Pendiente" },
    { label: "WhatsApp", ok: health.features.whatsappConfigured, detail: health.features.whatsappConfigured ? "Configurado" : "Sandbox pendiente" },
    { label: "Cron", ok: health.features.cronConfigured, detail: health.features.cronConfigured ? "CRON_SECRET configurado" : "Pendiente" },
    { label: "IA", ok: true, detail: health.features.ai === "openai" ? "OpenAI activo" : "Modo demo" },
    { label: "Rol actual", ok: capabilities.useInbox, detail: `${organization.role} - settings=${capabilities.manageSettings ? "yes" : "no"}` },
    { label: "Integration tool runs", ok: true, detail: `${integrationRunsCount ?? 0} runs registrados` }
  ];

  return (
    <section className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-normal">System Status</h1>
        <p className="text-sm text-muted-foreground">Diagnostico interno para deploy y operacion del MVP.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Healthcheck</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusLine label="Estado" ok={health.status === "ok"} detail={health.status} />
            <StatusLine label="Timestamp" ok detail={health.timestamp} />
            <StatusLine label="Missing env" ok={health.env.missing.length === 0} detail={health.env.missing.join(", ") || "none"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Checks de produccion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item) => (
              <StatusLine key={item.label} {...item} />
            ))}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function StatusLine({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" /> : <ShieldAlert className="mt-0.5 size-4 text-amber-600" />}
      <div>
        <p className="font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
