import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization, getAssignableMembers } from "@/lib/organization";
import { LeadForm } from "../_components/lead-form";

export default async function NewLeadPage() {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const members = await getAssignableMembers(supabase, organization.id);

  return (
    <section className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Crear lead</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadForm members={members} />
        </CardContent>
      </Card>
    </section>
  );
}
