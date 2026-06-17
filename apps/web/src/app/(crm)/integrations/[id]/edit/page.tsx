import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { CustomConnectForm } from "../../_components/custom-connect-form";

type ToolRow = {
  id: string;
  integration_id: string;
  name: string;
  description: string | null;
  method: string | null;
  url: string | null;
  headers_schema: Record<string, unknown>;
  body_schema: Record<string, unknown>;
  response_schema: Record<string, unknown>;
  active: boolean;
  timeout_ms: number;
};

export default async function EditIntegrationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: tool } = await supabase
    .from("integration_tools")
    .select("id, integration_id, name, description, method, url, headers_schema, body_schema, response_schema, active, timeout_ms")
    .eq("organization_id", organization.id)
    .eq("integration_id", id)
    .eq("type", "custom_connect")
    .limit(1)
    .single<ToolRow>();

  if (!tool) return <section className="p-6">Herramienta no encontrada.</section>;

  return (
    <section className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Editar Custom Connect</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomConnectForm tool={tool} />
        </CardContent>
      </Card>
    </section>
  );
}
