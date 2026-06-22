import Link from "next/link";
import { Archive, BookOpen, Pencil, Play } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { Input } from "@crm-pro-ai/ui/input";
import { Label } from "@crm-pro-ai/ui/label";
import { archiveAssistant, runAssistantTest } from "@/app/actions/ai";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

type AssistantDetail = {
  id: string;
  name: string;
  description: string | null;
  prompt: string;
  objective: string | null;
  tone: string;
  rules: string[] | null;
  fallback_message: string;
  active: boolean;
  channel_id: string | null;
};

type AssistantTest = {
  id: string;
  input: string;
  output: string | null;
  status: string;
  created_at: string;
  metadata: Record<string, unknown> | null;
};

type ConversationOption = {
  id: string;
  channel: string;
  status: string;
  contacts: { first_name: string; last_name: string | null } | null;
  leads: { first_name: string; last_name: string | null } | null;
};

export default async function AssistantDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ test?: string; error?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const [{ data: assistant }, { data: tests }, { data: conversations }] = await Promise.all([
    supabase
      .from("ai_assistants")
      .select("id, name, description, prompt, objective, tone, rules, fallback_message, active, channel_id")
      .eq("id", id)
      .eq("organization_id", organization.id)
      .is("archived_at", null)
      .single<AssistantDetail>(),
    supabase
      .from("ai_assistant_tests")
      .select("id, input, output, status, created_at, metadata")
      .eq("assistant_id", id)
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<AssistantTest[]>(),
    supabase
      .from("conversations")
      .select("id, channel, status, contacts(first_name, last_name), leads(first_name, last_name)")
      .eq("organization_id", organization.id)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(20)
      .returns<ConversationOption[]>()
  ]);

  if (!assistant) return <section className="p-6">Asistente no encontrado.</section>;

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{assistant.name}</h1>
          <p className="text-sm text-muted-foreground">{assistant.description ?? "Sin descripcion"}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/assistants/${assistant.id}/edit`}>
              <Pencil className="size-4" />
              Editar
            </Link>
          </Button>
          <form action={archiveAssistant}>
            <input type="hidden" name="id" value={assistant.id} />
            <Button type="submit" variant="outline">
              <Archive className="size-4" />
              Archivar
            </Button>
          </form>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Configuracion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <Info label="Objetivo" value={assistant.objective ?? "Sin objetivo"} />
            <Info label="Tono" value={assistant.tone} />
            <Info label="Canal" value={assistant.channel_id ?? "todos"} />
            <Info label="Estado" value={assistant.active ? "active" : "inactive"} />
            <Info label="Fallback" value={assistant.fallback_message} />
            <div>
              <p className="text-muted-foreground">Reglas</p>
              <pre className="mt-1 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
                {(assistant.rules ?? []).join("\n") || "Sin reglas"}
              </pre>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Probar asistente</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={runAssistantTest} className="grid gap-4">
              <input type="hidden" name="assistant_id" value={assistant.id} />
              <div className="space-y-2">
                <Label htmlFor="conversation_id">Conversacion opcional</Label>
                <select id="conversation_id" name="conversation_id" className="h-10 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">Sin conversacion</option>
                  {(conversations ?? []).map((conversation) => (
                    <option key={conversation.id} value={conversation.id}>
                      {conversationName(conversation)} - {conversation.channel}/{conversation.status}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="input">Entrada de prueba</Label>
                <Input id="input" name="input" placeholder="El cliente pregunta por precios..." required />
              </div>
              {query.error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">No se pudo generar la prueba.</p> : null}
              {query.test ? <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">Prueba guardada.</p> : null}
              <Button type="submit">
                <Play className="size-4" />
                Generar prueba
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Ultimas pruebas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(tests ?? []).map((test) => (
            <div key={test.id} className="rounded-md border p-3 text-sm">
              <p className="font-medium">{test.input}</p>
              <p className="mt-2 text-muted-foreground">{test.output ?? "Sin salida"}</p>
              {knowledgeSources(test.metadata).length > 0 ? (
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <BookOpen className="size-3" />
                  {knowledgeSources(test.metadata).map((source) => source.title).join(", ")}
                </p>
              ) : (
                <p className="mt-2 text-xs text-amber-700">Sin informacion interna suficiente para esta prueba.</p>
              )}
            </div>
          ))}
          {tests?.length === 0 ? <p className="text-sm text-muted-foreground">Todavia no hay pruebas.</p> : null}
        </CardContent>
      </Card>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function conversationName(conversation: ConversationOption) {
  const person = conversation.contacts ?? conversation.leads;
  return [person?.first_name, person?.last_name].filter(Boolean).join(" ") || "Conversacion";
}

function knowledgeSources(metadata: Record<string, unknown> | null) {
  const sources = metadata?.knowledge_sources;
  if (!Array.isArray(sources)) return [];
  return sources.filter(
    (source): source is { documentId: string; title: string; score: number } =>
      typeof source === "object" &&
      source !== null &&
      typeof (source as Record<string, unknown>).documentId === "string" &&
      typeof (source as Record<string, unknown>).title === "string" &&
      typeof (source as Record<string, unknown>).score === "number",
  );
}
