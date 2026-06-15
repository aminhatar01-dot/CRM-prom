import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization, getAssignableMembers } from "@/lib/organization";
import { ContactForm } from "../../_components/contact-form";

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const [{ data: contact }, members] = await Promise.all([
    supabase
      .from("contacts")
      .select("id, first_name, last_name, email, phone, company, location, owner_id, notes")
      .eq("id", id)
      .eq("organization_id", organization.id)
      .single(),
    getAssignableMembers(supabase, organization.id)
  ]);

  if (!contact) return <section className="p-6">Contacto no encontrado.</section>;

  return (
    <section className="mx-auto max-w-3xl px-4 py-6 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>Editar contacto</CardTitle>
        </CardHeader>
        <CardContent>
          <ContactForm contact={contact} members={members} />
        </CardContent>
      </Card>
    </section>
  );
}
