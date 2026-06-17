import Link from "next/link";
import { notFound } from "next/navigation";
import { Play, Pencil } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { scheduleManualAutomationRun } from "@/app/actions/automations";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

type AutomationRule = {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  status: string;
  conditions: Record<string, unknown>;
  trigger_config: Record<string, unknown>;
  automation_actions: Array<{
    id: string;
    action_type: string;
    config: Record<string, unknown>;
    enabled: boolean;
    position: number;
  }> | null;
};

type AutomationRun = {
  id: string;
  status: string;
  trigger_type: string;
  context: Record<string, unknown>;
  result: Record<string, unknown>;
  error_message: string | null;
  scheduled_for: string;
  started_at: string | null;
  completed_at: string | null;
};

export default async function AutomationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: rule } = await supabase
    .from("automation_rules")
    .select("id, name, description, trigger_type, status, conditions, trigger_config, automation_actions(id, action_type, config, enabled, position)")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .single<AutomationRule>();

  if (!rule) notFound();

  const { data: runs } = await supabase
    .from("automation_runs")
    .select("id, status, trigger_type, context, result, error_message, scheduled_for, started_at, completed_at")
    .eq("organization_id", organization.id)
    .eq("rule_id", id)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<AutomationRun[]>();

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{rule.name}</h1>
          <p className="text-sm text-muted-foreground">{rule.description ?? "Automatizacion sin descripcion."}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/automations/${rule.id}/edit`}>
              <Pencil className="size-4" />
              Editar
            </Link>
          </Button>
          <form action={scheduleManualAutomationRun}>
            <input type="hidden" name="rule_id" value={rule.id} />
            <input type="hidden" name="trigger_type" value={rule.trigger_type} />
            <input type="hidden" name="return_to" value={`/automations/${rule.id}`} />
            <input
              type="hidden"
              name="context"
              value={JSON.stringify({ organization_id: organization.id })}
            />
            <Button type="submit">
              <Play className="size-4" />
              Ejecutar manual
            </Button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHeader>
            <CardTitle>Configuracion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-md border px-2 py-1">{rule.trigger_type}</span>
              <span className="rounded-md border px-2 py-1">{rule.status}</span>
            </div>
            <JsonBlock title="Condiciones" value={rule.conditions} />
            <JsonBlock title="Trigger" value={rule.trigger_config} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Acciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {(rule.automation_actions ?? [])
              .sort((a, b) => a.position - b.position)
              .map((action) => (
                <div key={action.id} className="rounded-md border p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="font-medium">{action.action_type}</p>
                    <span className="rounded-md border px-2 py-1 text-xs">{action.enabled ? "enabled" : "disabled"}</span>
                  </div>
                  <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(action.config, null, 2)}</pre>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Historial de ejecuciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(runs ?? []).map((run) => (
            <div key={run.id} className="grid gap-3 rounded-md border p-3 text-sm md:grid-cols-[180px_1fr]">
              <div>
                <p className="font-medium">{run.status}</p>
                <p className="text-xs text-muted-foreground">{new Date(run.scheduled_for).toLocaleString("es-AR")}</p>
                {run.error_message ? <p className="mt-2 text-xs text-destructive">{run.error_message}</p> : null}
              </div>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify({ context: run.context, result: run.result }, null, 2)}
              </pre>
            </div>
          ))}
          {runs?.length === 0 ? <p className="text-sm text-muted-foreground">Todavia no hay ejecuciones.</p> : null}
        </CardContent>
      </Card>
    </section>
  );
}

function JsonBlock({ title, value }: { title: string; value: Record<string, unknown> }) {
  return (
    <div>
      <p className="mb-2 font-medium">{title}</p>
      <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(value, null, 2)}</pre>
    </div>
  );
}
