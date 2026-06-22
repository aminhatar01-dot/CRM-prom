import Link from "next/link";
import { Archive, Pencil, RefreshCw } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import {
  archiveKnowledgeDocument,
  reindexKnowledgeDocument
} from "@/app/actions/knowledge";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

type DocumentDetail = {
  id: string;
  title: string;
  content: string;
  category: string;
  active: boolean;
  source_type: string;
  indexing_status: string;
  indexing_error: string | null;
  chunk_count: number;
  embedding_model: string | null;
  indexed_at: string | null;
  updated_at: string;
};

export default async function KnowledgeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: document } = await supabase
    .from("knowledge_documents")
    .select("id, title, content, category, active, source_type, indexing_status, indexing_error, chunk_count, embedding_model, indexed_at, updated_at")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .maybeSingle<DocumentDetail>();

  if (!document) return <section className="p-6">Documento no encontrado.</section>;

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{document.title}</h1>
          <p className="text-sm text-muted-foreground">{document.category} · {document.indexing_status}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={reindexKnowledgeDocument}>
            <input type="hidden" name="id" value={document.id} />
            <Button type="submit" variant="outline">
              <RefreshCw className="size-4" />
              Reindexar
            </Button>
          </form>
          <Button asChild variant="outline">
            <Link href={`/knowledge/${document.id}/edit`}>
              <Pencil className="size-4" />
              Editar
            </Link>
          </Button>
          <form action={archiveKnowledgeDocument}>
            <input type="hidden" name="id" value={document.id} />
            <Button type="submit" variant="outline">
              <Archive className="size-4" />
              Archivar
            </Button>
          </form>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Card>
          <CardHeader>
            <CardTitle>Contenido</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap text-sm leading-6">{document.content}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Indexacion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Row label="Estado" value={document.indexing_status} />
            <Row label="Activo" value={document.active ? "Si" : "No"} />
            <Row label="Origen" value={document.source_type} />
            <Row label="Chunks" value={String(document.chunk_count)} />
            <Row label="Modelo" value={document.embedding_model ?? "Pendiente"} />
            <Row
              label="Indexado"
              value={document.indexed_at ? new Date(document.indexed_at).toLocaleString("es-AR") : "Pendiente"}
            />
            {document.indexing_error ? (
              <p className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                {document.indexing_error}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}:</span> {value}
    </p>
  );
}

