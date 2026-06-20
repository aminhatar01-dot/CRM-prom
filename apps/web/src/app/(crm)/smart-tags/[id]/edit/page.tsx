import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { SmartTagForm } from "../../_components/smart-tag-form";

export default async function EditSmartTagPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: tag } = await supabase
    .from("tags")
    .select("id, name, color, description, classification_prompt, active, auto_pause_assistant, notify_team")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .single();

  if (!tag) return <section className="p-6">Smart Tag no encontrado.</section>;

  return (
    <section className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Editar Smart Tag</CardTitle>
        </CardHeader>
        <CardContent>
          <SmartTagForm tag={tag} />
        </CardContent>
      </Card>
    </section>
  );
}
