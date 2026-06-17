import Link from "next/link";
import { Plug, Plus, Table2 } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

type IntegrationRow = {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  active: boolean;
  integration_tools: { id: string }[] | null;
};

export default async function IntegrationsPage() {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: integrations } = await supabase
    .from("integrations")
    .select("id, name, description, kind, active, integration_tools(id)")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .returns<IntegrationRow[]>();

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Integraciones</h1>
          <p className="text-sm text-muted-foreground">Herramientas externas disponibles para asistentes IA en modo test/manual.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/integrations/google-sheets">
              <Table2 className="size-4" />
              Google Sheets
            </Link>
          </Button>
          <Button asChild>
            <Link href="/integrations/new">
              <Plus className="size-4" />
              Custom Connect
            </Link>
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(integrations ?? []).map((integration) => (
          <Card key={integration.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{integration.name}</CardTitle>
                <Plug className="size-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="line-clamp-2 text-muted-foreground">{integration.description ?? "Sin descripcion"}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-md border px-2 py-1">{integration.kind}</span>
                <span className="rounded-md border px-2 py-1">{integration.active ? "active" : "inactive"}</span>
                <span className="rounded-md border px-2 py-1">{integration.integration_tools?.length ?? 0} tools</span>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/integrations/${integration.id}`}>Abrir</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
        {integrations?.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Todavia no hay integraciones.</CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
