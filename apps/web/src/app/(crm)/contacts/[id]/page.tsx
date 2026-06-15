import Link from "next/link";
import { MessageSquarePlus, Pencil } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { createConversation } from "@/app/actions/crm";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

type ContactDetail = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  location: string | null;
  owner_id: string | null;
  notes: string | null;
};

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, company, location, owner_id, notes")
    .eq("id", id)
    .eq("organization_id", organization.id)
    .single<ContactDetail>();

  if (!contact) return <section className="p-6">Contacto no encontrado.</section>;

  return (
    <section className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">
            {[contact.first_name, contact.last_name].filter(Boolean).join(" ")}
          </h1>
          <p className="text-sm text-muted-foreground">{contact.company ?? "Sin empresa"}</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href={`/contacts/${contact.id}/edit`}>
              <Pencil className="size-4" />
              Editar
            </Link>
          </Button>
          <form action={createConversation}>
            <input type="hidden" name="contact_id" value={contact.id} />
            <input type="hidden" name="channel" value="manual" />
            <input type="hidden" name="status" value="abierta" />
            <input type="hidden" name="ai_status" value="human" />
            <input type="hidden" name="return_to" value={`/contacts/${contact.id}`} />
            <Button type="submit">
              <MessageSquarePlus className="size-4" />
              Conversacion
            </Button>
          </form>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard title="Email" value={contact.email ?? "Sin email"} />
        <InfoCard title="Telefono" value={contact.phone ?? "Sin telefono"} />
        <InfoCard title="Ubicacion" value={contact.location ?? "Sin ubicacion"} />
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Detalle</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <p><span className="text-muted-foreground">Responsable:</span> {contact.owner_id ?? "Sin asignar"}</p>
          <p><span className="text-muted-foreground">Notas:</span> {contact.notes ?? "Sin notas"}</p>
        </CardContent>
      </Card>
    </section>
  );
}

function InfoCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent className="font-medium">{value}</CardContent>
    </Card>
  );
}
