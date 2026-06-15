import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { leadSearchSchema, leadStatuses } from "@crm-pro-ai/database/crm";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader } from "@crm-pro-ai/ui/card";
import { Input } from "@crm-pro-ai/ui/input";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

type LeadRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  owner_id: string | null;
  created_at: string;
};

export default async function LeadsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = leadSearchSchema.parse(await searchParams);
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  let query = supabase
    .from("leads")
    .select("id, first_name, last_name, email, phone, company, status, owner_id, created_at")
    .eq("organization_id", organization.id)
    .order("created_at", { ascending: false });

  if (params.status !== "all") {
    query = query.eq("status", params.status);
  }

  if (params.q) {
    const term = params.q.replaceAll(",", " ").trim();
    query = query.or(
      `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`,
    );
  }

  const { data: leads } = await query.returns<LeadRow[]>();

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Leads</h1>
          <p className="text-sm text-muted-foreground">Gestiona oportunidades y responsables.</p>
        </div>
        <Button asChild>
          <Link href="/leads/new">
            <Plus className="size-4" />
            Nuevo lead
          </Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <form className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input name="q" defaultValue={params.q} className="pl-9" placeholder="Buscar nombre, email o telefono" />
            </div>
            <select
              name="status"
              defaultValue={params.status}
              className="h-10 rounded-md border bg-background px-3 text-sm"
            >
              <option value="all">Todos</option>
              {leadStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              Filtrar
            </Button>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-y bg-muted/60 text-left text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Lead</th>
                  <th className="px-6 py-3 font-medium">Contacto</th>
                  <th className="px-6 py-3 font-medium">Estado</th>
                  <th className="px-6 py-3 font-medium">Responsable</th>
                </tr>
              </thead>
              <tbody>
                {(leads ?? []).map((lead) => (
                  <tr key={lead.id} className="border-b">
                    <td className="px-6 py-4">
                      <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                        {[lead.first_name, lead.last_name].filter(Boolean).join(" ")}
                      </Link>
                      <p className="text-xs text-muted-foreground">{lead.company ?? "Sin empresa"}</p>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      <p>{lead.email ?? "Sin email"}</p>
                      <p>{lead.phone ?? "Sin telefono"}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="rounded-md bg-secondary px-2 py-1 text-xs">{lead.status}</span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {lead.owner_id ? lead.owner_id.slice(0, 8) : "Sin asignar"}
                    </td>
                  </tr>
                ))}
                {leads?.length === 0 ? (
                  <tr>
                    <td className="px-6 py-8 text-center text-muted-foreground" colSpan={4}>
                      No hay leads para estos filtros.
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
