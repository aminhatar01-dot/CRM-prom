import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

type VariableRow = {
  id: string;
  name: string;
  key: string;
  type: string;
  description: string | null;
  active: boolean;
  required: boolean;
};

export default async function VariablesPage() {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: variables } = await supabase
    .from("variables")
    .select("id, name, key, type, description, active, required")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .returns<VariableRow[]>();

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Variables Inteligentes</h1>
          <p className="text-sm text-muted-foreground">Extrae datos estructurados desde leads y conversaciones.</p>
        </div>
        <Button asChild>
          <Link href="/variables/new">
            <Plus className="size-4" />
            Nueva variable
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(variables ?? []).map((variable) => (
          <Card key={variable.id}>
            <CardHeader>
              <CardTitle>{variable.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="text-muted-foreground">{variable.description ?? "Sin descripcion"}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-md border px-2 py-1">{variable.key}</span>
                <span className="rounded-md border px-2 py-1">{variable.type}</span>
                <span className="rounded-md border px-2 py-1">{variable.active ? "active" : "inactive"}</span>
                {variable.required ? <span className="rounded-md border px-2 py-1">required</span> : null}
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/variables/${variable.id}`}>Abrir</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
        {variables?.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Todavia no hay variables.</CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
