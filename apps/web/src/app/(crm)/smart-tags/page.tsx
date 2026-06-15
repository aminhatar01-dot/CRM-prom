import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

type SmartTagRow = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  active: boolean;
  auto_pause_assistant: boolean;
  notify_team: boolean;
};

export default async function SmartTagsPage() {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: tags } = await supabase
    .from("tags")
    .select("id, name, color, description, active, auto_pause_assistant, notify_team")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false })
    .returns<SmartTagRow[]>();

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Smart Tags</h1>
          <p className="text-sm text-muted-foreground">Clasifica leads y conversaciones con reglas asistidas por IA.</p>
        </div>
        <Button asChild>
          <Link href="/smart-tags/new">
            <Plus className="size-4" />
            Nuevo tag
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(tags ?? []).map((tag) => (
          <Card key={tag.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{tag.name}</CardTitle>
                <span className="size-4 rounded-full border" style={{ backgroundColor: tag.color }} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p className="line-clamp-2 text-muted-foreground">{tag.description ?? "Sin descripcion"}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-md border px-2 py-1">{tag.active ? "active" : "inactive"}</span>
                {tag.auto_pause_assistant ? <span className="rounded-md border px-2 py-1">pausa IA</span> : null}
                {tag.notify_team ? <span className="rounded-md border px-2 py-1">notifica</span> : null}
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/smart-tags/${tag.id}`}>Abrir</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
        {tags?.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Todavia no hay Smart Tags.</CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}
