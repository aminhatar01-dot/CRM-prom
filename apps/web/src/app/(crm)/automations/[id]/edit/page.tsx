import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { AutomationForm } from "../../_components/automation-form";

type AutomationRule = Parameters<typeof AutomationForm>[0]["rule"];

export default async function EditAutomationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: rule } = await supabase
    .from("automation_rules")
    .select("id, name, description, trigger_type, status, trigger_config, conditions, automation_actions(action_type, config, enabled)")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .single<AutomationRule>();

  if (!rule) notFound();

  return (
    <section className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Editar automatizacion</CardTitle>
        </CardHeader>
        <CardContent>
          <AutomationForm rule={rule} />
        </CardContent>
      </Card>
    </section>
  );
}
