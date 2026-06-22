import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { KnowledgeForm } from "../../_components/knowledge-form";

export default async function EditKnowledgeDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: document } = await supabase
    .from("knowledge_documents")
    .select("id, title, content, category, active")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .maybeSingle();

  if (!document) return <section className="p-6">Documento no encontrado.</section>;

  return (
    <section className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Editar documento</CardTitle>
        </CardHeader>
        <CardContent>
          <KnowledgeForm document={document} />
        </CardContent>
      </Card>
    </section>
  );
}

