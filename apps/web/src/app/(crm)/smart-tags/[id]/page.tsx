import Link from "next/link";
import { Archive, Pencil } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

type SmartTagDetail = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  classification_prompt: string | null;
  active: boolean;
  auto_pause_assistant: boolean;
  notify_team: boolean;
};

type ClassificationLog = {
  id: string;
  matched: boolean;
  confidence: number | null;
  reason: string | null;
  created_at: string;
};

export default async function SmartTagDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const [{ data: tag }, { data: logs }] = await Promise.all([
    supabase
      .from("tags")
      .select("id, name, color, description, classification_prompt, active, auto_pause_assistant, notify_team")
      .eq("id", id)
      .eq("organization_id", organization.id)
      .is("archived_at", null)
      .single<SmartTagDetail>(),
    supabase
      .from("smart_tag_classification_logs")
      .select("id, matched, confidence, reason, created_at")
      .eq("tag_id", id)
      .eq("organization_id", organization.id)
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<ClassificationLog[]>()
  ]);

  if (!tag) return <section className="p-6">Smart Tag no encontrado.</section>;

  return (
    <section className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="size-4 rounded-full border" style={{ backgroundColor: tag.color }} />
            <h1 className="text-2xl font-semibold tracking-normal">{tag.name}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{tag.description ?? "Sin descripcion"}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/smart-tags/${tag.id}/edit`}>
              <Pencil className="size-4" />
              Editar
            </Link>
          </Button>
          <form action={archiveSmartTag}>
            <input type="hidden" name="id" value={tag.id} />
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
          <CardContent className="space-y-3 text-sm">
            <p><span className="text-muted-foreground">Estado:</span> {tag.active ? "active" : "inactive"}</p>
            <p><span className="text-muted-foreground">Pausa IA:</span> {tag.auto_pause_assistant ? "si" : "no"}</p>
            <p><span className="text-muted-foreground">Notifica:</span> {tag.notify_team ? "si" : "no"}</p>
            <div>
              <p className="text-muted-foreground">Prompt</p>
              <pre className="mt-1 whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{tag.classification_prompt}</pre>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Ultimas clasificaciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(logs ?? []).map((log) => (
              <div key={log.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{log.matched ? "Match" : "Sin match"} · {log.confidence ?? 0}</p>
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
import { archiveSmartTag } from "@/app/actions/smart-tags";
