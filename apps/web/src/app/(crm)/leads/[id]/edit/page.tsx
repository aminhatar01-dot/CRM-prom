import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization, getAssignableMembers } from "@/lib/organization";
import { LeadForm } from "../../_components/lead-form";

export default async function EditLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const [{ data: lead }, members] = await Promise.all([
    supabase
      .from("leads")
      .select("id, first_name, last_name, email, phone, company, source, status, owner_id, notes")
      .eq("id", id)
      .eq("organization_id", organization.id)
      .is("archived_at", null)
      .single(),
    getAssignableMembers(supabase, organization.id)
  ]);

  if (!lead) return <section className="p-6">Lead no encontrado.</section>;

  return (
    <section className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Editar lead</CardTitle>
        </CardHeader>
        <CardContent>
          <LeadForm lead={lead} members={members} />
        </CardContent>
      </Card>
    </section>
  );
}
