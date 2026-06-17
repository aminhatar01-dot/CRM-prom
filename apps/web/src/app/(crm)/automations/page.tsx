import Link from "next/link";
import { Plus, Workflow } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

type AutomationRuleRow = {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  status: string;
  enabled: boolean;
  last_run_at: string | null;
  automation_actions: { id: string }[] | null;
};

export default async function AutomationsPage() {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: rules } = await supabase
    .from("automation_rules")
    .select("id, name, description, trigger_type, status, enabled, last_run_at, automation_actions(id)")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .returns<AutomationRuleRow[]>();

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Automatizaciones</h1>
          <p className="text-sm text-muted-foreground">Reglas seguras para tareas, seguimientos y acciones internas.</p>
        </div>
        <Button asChild>
          <Link href="/automations/new">
            <Plus className="size-4" />
            Nueva automatizacion
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(rules ?? []).map((rule) => (
          <Card key={rule.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{rule.name}</CardTitle>
                <Workflow className="size-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="line-clamp-2 text-muted-foreground">{rule.description ?? "Sin descripcion"}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-md border px-2 py-1">{rule.trigger_type}</span>
                <span className="rounded-md border px-2 py-1">{rule.status}</span>
                <span className="rounded-md border px-2 py-1">{rule.automation_actions?.length ?? 0} acciones</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Ultima ejecucion: {rule.last_run_at ? new Date(rule.last_run_at).toLocaleString("es-AR") : "nunca"}
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/automations/${rule.id}`}>Abrir</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
        {rules?.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Todavia no hay automatizaciones.</CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
