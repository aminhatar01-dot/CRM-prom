import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { VariableForm } from "../../_components/variable-form";

export default async function EditVariablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: variable } = await supabase
    .from("variables")
    .select("id, name, key, description, type, extraction_prompt, active, required, options")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .single();

  if (!variable) return <section className="p-6">Variable no encontrada.</section>;

  return (
    <section className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Editar variable</CardTitle>
        </CardHeader>
        <CardContent>
          <VariableForm variable={variable} />
        </CardContent>
      </Card>
    </section>
  );
}
