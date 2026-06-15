import Link from "next/link";
import { Pencil } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

type VariableDetail = {
  id: string;
  name: string;
  key: string;
  description: string | null;
  type: string;
  extraction_prompt: string;
  active: boolean;
  required: boolean;
  options: string[] | null;
};

type ExtractionLog = {
  id: string;
  extracted: boolean;
  confidence: number | null;
  reason: string | null;
  created_at: string;
};

export default async function VariableDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const [{ data: variable }, { data: logs }] = await Promise.all([
    supabase
      .from("variables")
      .select("id, name, key, description, type, extraction_prompt, active, required, options")
      .eq("id", id)
      .eq("organization_id", organization.id)
      .single<VariableDetail>(),
    supabase
      .from("variable_extraction_logs")
      .select("id, extracted, confidence, reason, created_at")
      .eq("variable_id", id)
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<ExtractionLog[]>()
  ]);

  if (!variable) return <section className="p-6">Variable no encontrada.</section>;

  return (
    <section className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{variable.name}</h1>
          <p className="text-sm text-muted-foreground">{variable.key} · {variable.type}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/variables/${variable.id}/edit`}>
            <Pencil className="size-4" />
            Editar
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Configuracion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p><span className="text-muted-foreground">Estado:</span> {variable.active ? "active" : "inactive"}</p>
            <p><span className="text-muted-foreground">Requerida:</span> {variable.required ? "si" : "no"}</p>
            <p><span className="text-muted-foreground">Descripcion:</span> {variable.description ?? "Sin descripcion"}</p>
            <p><span className="text-muted-foreground">Opciones:</span> {(variable.options ?? []).join(", ") || "n/a"}</p>
            <div>
              <p className="text-muted-foreground">Prompt</p>
              <pre className="mt-1 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{variable.extraction_prompt}</pre>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ultimas extracciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(logs ?? []).map((log) => (
              <div key={log.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{log.extracted ? "Extraida" : "Sin valor"} · {log.confidence ?? 0}</p>
                <p className="text-muted-foreground">{log.reason ?? "Sin razon"}</p>
              </div>
            ))}
            {logs?.length === 0 ? <p className="text-sm text-muted-foreground">Sin logs todavia.</p> : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
