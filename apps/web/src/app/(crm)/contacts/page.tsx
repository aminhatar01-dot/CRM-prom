import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader } from "@crm-pro-ai/ui/card";
import { Input } from "@crm-pro-ai/ui/input";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

type ContactRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  owner_id: string | null;
};

export default async function ContactsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  let query = supabase
    .from("contacts")
    .select("id, first_name, last_name, email, phone, company, owner_id")
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (params.q) {
    const term = params.q.replaceAll(",", " ").trim();
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`,
    );
  }

  const { data: contacts } = await query.returns<ContactRow[]>();

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Contactos</h1>
          <p className="text-sm text-muted-foreground">Clientes y contactos consolidados.</p>
        </div>
        <Button asChild>
          <Link href="/contacts/new">
            <Plus className="size-4" />
            Nuevo contacto
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <form className="grid gap-3 md:grid-cols-[1fr_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input name="q" defaultValue={params.q ?? ""} className="pl-9" placeholder="Buscar contacto" />
            </div>
            <Button type="submit" variant="outline">
              Buscar
            </Button>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/60 text-left text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Contacto</th>
                  <th className="px-6 py-3 font-medium">Datos</th>
                  <th className="px-6 py-3 font-medium">Responsable</th>
                </tr>
              </thead>
              <tbody>
                {(contacts ?? []).map((contact) => (
                  <tr key={contact.id} className="border-b">
                    <td className="px-6 py-4">
                      <Link href={`/contacts/${contact.id}`} className="font-medium hover:underline">
                        {[contact.first_name, contact.last_name].filter(Boolean).join(" ")}
                      </Link>
                      <p className="text-xs text-muted-foreground">{contact.company ?? "Sin empresa"}</p>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <p>{contact.email ?? "Sin email"}</p>
                      <p>{contact.phone ?? "Sin telefono"}</p>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {contact.owner_id ? contact.owner_id.slice(0, 8) : "Sin asignar"}
                    </td>
                  </tr>
                ))}
                {contacts?.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-center text-muted-foreground" colSpan={3}>
                      No hay contactos para esta busqueda.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
