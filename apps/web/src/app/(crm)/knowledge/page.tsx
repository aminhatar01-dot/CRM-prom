import Link from "next/link";
import { BookOpen, Plus } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

type DocumentRow = {
  id: string;
  title: string;
  category: string;
  active: boolean;
  indexing_status: string;
  chunk_count: number;
  indexed_at: string | null;
};

export default async function KnowledgePage() {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: documents } = await supabase
    .from("knowledge_documents")
    .select("id, title, category, active, indexing_status, chunk_count, indexed_at")
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .returns<DocumentRow[]>();

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Base de conocimiento</h1>
          <p className="text-sm text-muted-foreground">Informacion interna recuperable por los asistentes de esta organizacion.</p>
        </div>
        <Button asChild>
          <Link href="/knowledge/new">
            <Plus className="size-4" />
            Nuevo documento
          </Link>
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(documents ?? []).map((document) => (
          <Card key={document.id}>
            <CardHeader>
              <CardTitle className="flex items-start justify-between gap-3 text-base">
                <span>{document.title}</span>
                <BookOpen className="size-4 shrink-0 text-muted-foreground" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-md border px-2 py-1">{document.category}</span>
                <span className="rounded-md border px-2 py-1">{document.active ? "activo" : "inactivo"}</span>
                <span className={statusClass(document.indexing_status)}>{document.indexing_status}</span>
              </div>
              <p className="text-muted-foreground">
                {document.chunk_count} chunks
                {document.indexed_at ? ` · ${new Date(document.indexed_at).toLocaleString("es-AR")}` : ""}
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href={`/knowledge/${document.id}`}>Abrir</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
        {documents?.length === 0 ? (
          <Card>
            <CardContent className="flex min-h-40 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
              <BookOpen className="size-6" />
              <p>No hay documentos. Crea el primero para que la IA pueda responder con datos del negocio.</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </section>
  );
}

function statusClass(status: string) {
  const tone =
    status === "indexed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "failed"
        ? "border-red-200 bg-red-50 text-red-800"
        : "border-amber-200 bg-amber-50 text-amber-800";
  return `rounded-md border px-2 py-1 ${tone}`;
}

