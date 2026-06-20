import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { AssistantForm } from "../../_components/assistant-form";

export default async function EditAssistantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: assistant } = await supabase
    .from("ai_assistants")
    .select("id, name, description, prompt, objective, tone, rules, fallback_message, active, channel_id")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .single();

  if (!assistant) return <section className="p-6">Asistente no encontrado.</section>;

  return (
    <section className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Editar asistente IA</CardTitle>
        </CardHeader>
        <CardContent>
          <AssistantForm assistant={assistant} />
        </CardContent>
      </Card>
    </section>
  );
}
