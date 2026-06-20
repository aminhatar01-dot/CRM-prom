import Link from "next/link";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

type AssistantRow = {
  id: string;
  name: string;
  description: string | null;
  tone: string;
  active: boolean;
  channel_id: string | null;
  created_at: string;
};

export default async function AssistantsPage() {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: assistants } = await supabase
    .from("ai_assistants")
    .select("id, name, description, tone, active, channel_id, created_at")
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .returns<AssistantRow[]>();

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Asistentes IA</h1>
          <p className="text-sm text-muted-foreground">Configura prompts y prueba sugerencias antes de usarlas en Inbox.</p>
        </div>
        <Button asChild>
          <Link href="/assistants/new">
            <Plus className="size-4" />
            Nuevo asistente
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(assistants ?? []).map((assistant) => (
          <Card key={assistant.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{assistant.name}</CardTitle>
                <Sparkles className="size-4 text-primary" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="line-clamp-2 text-muted-foreground">{assistant.description ?? "Sin descripcion"}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-md border px-2 py-1">{assistant.tone}</span>
                <span className="rounded-md border px-2 py-1">{assistant.channel_id ?? "todos"}</span>
                <span className="rounded-md border px-2 py-1">{assistant.active ? "active" : "inactive"}</span>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/assistants/${assistant.id}`}>Abrir</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
        {assistants?.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Todavia no hay asistentes.</CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
