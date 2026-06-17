import Link from "next/link";
import { Pencil, Play } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { testIntegrationTool } from "@/app/actions/integrations";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

type IntegrationRow = {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  active: boolean;
  integration_tools: Array<{
    id: string;
    name: string;
    description: string | null;
    type: string;
    method: string | null;
    url: string | null;
    active: boolean;
    body_schema: Record<string, unknown>;
    config: Record<string, unknown>;
  }> | null;
};

type RunRow = {
  id: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
};

export default async function IntegrationDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const [{ data: integration }, { data: runs }] = await Promise.all([
    supabase
      .from("integrations")
      .select("id, name, description, kind, active, integration_tools(id, name, description, type, method, url, active, body_schema, config)")
      .eq("id", id)
      .eq("organization_id", organization.id)
      .single<IntegrationRow>(),
    supabase
      .from("integration_tool_runs")
      .select("id, status, input, output, error_message, duration_ms, created_at")
      .eq("organization_id", organization.id)
      .eq("integration_id", id)
      .order("created_at", { ascending: false })
      .limit(10)
      .returns<RunRow[]>()
  ]);

  if (!integration) return <section className="p-6">Integracion no encontrada.</section>;
  const firstTool = integration.integration_tools?.[0];

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{integration.name}</h1>
          <p className="text-sm text-muted-foreground">{integration.description ?? "Sin descripcion"}</p>
        </div>
        {integration.kind === "custom_connect" && firstTool ? (
          <Button asChild variant="outline">
            <Link href={`/integrations/${integration.id}/edit`}>
              <Pencil className="size-4" />
              Editar
            </Link>
          </Button>
        ) : null}
      </div>
      {query.status ? <p className="mb-4 rounded-md bg-muted p-3 text-sm">Ultima prueba: {query.status}</p> : null}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Herramientas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(integration.integration_tools ?? []).map((tool) => (
              <div key={tool.id} className="rounded-md border p-3 text-sm">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{tool.name}</p>
                    <p className="text-xs text-muted-foreground">{tool.description ?? "Sin descripcion"}</p>
                  </div>
                  <span className="rounded-md border px-2 py-1 text-xs">{tool.active ? "active" : "inactive"}</span>
                </div>
                <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify({ type: tool.type, method: tool.method, url: tool.url, input: tool.type === "google_sheets" ? { query: "string" } : tool.body_schema, config: tool.config }, null, 2)}
                </pre>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Probar herramienta</CardTitle>
          </CardHeader>
          <CardContent>
            {firstTool ? (
              <form action={testIntegrationTool} className="grid gap-3">
                <input type="hidden" name="integration_id" value={integration.id} />
                <input type="hidden" name="tool_id" value={firstTool.id} />
                <textarea
                  name="input"
                  defaultValue={JSON.stringify(firstTool.type === "google_sheets" ? { query: "Ana" } : { query: "demo" }, null, 2)}
                  className="min-h-36 rounded-md border bg-background px-3 py-2 font-mono text-sm"
                />
                <Button type="submit">
                  <Play className="size-4" />
                  Probar herramienta
                </Button>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">No hay herramienta configurada.</p>
            )}
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Logs de ejecucion</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(runs ?? []).map((run) => (
            <div key={run.id} className="grid gap-3 rounded-md border p-3 text-sm md:grid-cols-[160px_1fr]">
              <div>
                <p className="font-medium">{run.status}</p>
                <p className="text-xs text-muted-foreground">{new Date(run.created_at).toLocaleString("es-AR")}</p>
                <p className="text-xs text-muted-foreground">{run.duration_ms ?? 0} ms</p>
                {run.error_message ? <p className="mt-2 text-xs text-destructive">{run.error_message}</p> : null}
              </div>
              <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify({ input: run.input, output: run.output }, null, 2)}</pre>
            </div>
          ))}
          {runs?.length === 0 ? <p className="text-sm text-muted-foreground">Todavia no hay ejecuciones.</p> : null}
        </CardContent>
      </Card>
    </section>
  );
}
