import Link from "next/link";
import { MessageSquarePlus, Pencil, UserRoundCheck } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { createConversation, convertLeadToContact } from "@/app/actions/crm";
import { assignSmartTag } from "@/app/actions/smart-tags";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

type LeadDetail = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  status: string;
  owner_id: string | null;
  notes: string | null;
  contact_id: string | null;
};

type SmartTagOption = {
  id: string;
  name: string;
  color: string;
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const [{ data: lead }, { data: smartTags }, { data: assignedTags }] = await Promise.all([
    supabase
      .from("leads")
      .select("id, first_name, last_name, email, phone, company, source, status, owner_id, notes, contact_id")
      .eq("id", id)
      .eq("organization_id", organization.id)
      .single<LeadDetail>(),
    supabase
      .from("tags")
      .select("id, name, color")
      .eq("organization_id", organization.id)
      .eq("active", true)
      .order("name")
      .returns<SmartTagOption[]>(),
    supabase
      .from("lead_tags")
      .select("tags(id, name, color)")
      .eq("organization_id", organization.id)
      .eq("lead_id", id)
      .returns<Array<{ tags: SmartTagOption | null }>>()
  ]);

  if (!lead) {
    return <section className="p-6">Lead no encontrado.</section>;
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">
            {[lead.first_name, lead.last_name].filter(Boolean).join(" ")}
          </h1>
          <p className="text-sm text-muted-foreground">{lead.company ?? "Sin empresa"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/leads/${lead.id}/edit`}>
              <Pencil className="size-4" />
              Editar
            </Link>
          </Button>
          <form action={createConversation}>
            <input type="hidden" name="lead_id" value={lead.id} />
            <input type="hidden" name="channel" value="manual" />
            <input type="hidden" name="status" value="abierta" />
            <input type="hidden" name="ai_status" value="human" />
            <input type="hidden" name="return_to" value={`/leads/${lead.id}`} />
            <Button type="submit" variant="outline">
              <MessageSquarePlus className="size-4" />
              Conversacion
            </Button>
          </form>
          {!lead.contact_id ? (
            <form action={convertLeadToContact}>
              <input type="hidden" name="lead_id" value={lead.id} />
              <Button type="submit">
                <UserRoundCheck className="size-4" />
                Convertir
              </Button>
            </form>
          ) : null}
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <InfoCard title="Estado" value={lead.status} />
        <InfoCard title="Email" value={lead.email ?? "Sin email"} />
        <InfoCard title="Telefono" value={lead.phone ?? "Sin telefono"} />
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Detalle</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <p><span className="text-muted-foreground">Origen:</span> {lead.source ?? "Sin origen"}</p>
          <p><span className="text-muted-foreground">Responsable:</span> {lead.owner_id ?? "Sin asignar"}</p>
          <p><span className="text-muted-foreground">Observaciones:</span> {lead.notes ?? "Sin observaciones"}</p>
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Smart Tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {(assignedTags ?? []).map((item) =>
              item.tags ? (
                <span key={item.tags.id} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
                  <span className="size-2 rounded-full" style={{ backgroundColor: item.tags.color }} />
                  {item.tags.name}
                </span>
              ) : null,
            )}
            {assignedTags?.length === 0 ? <p className="text-sm text-muted-foreground">Sin tags asignados.</p> : null}
          </div>
          <form action={assignSmartTag} className="flex flex-wrap gap-2">
            <input type="hidden" name="lead_id" value={lead.id} />
            <input type="hidden" name="return_to" value={`/leads/${lead.id}`} />
            <select name="tag_id" className="h-10 rounded-md border bg-background px-3 text-sm" required>
              <option value="">Seleccionar tag</option>
              {(smartTags ?? []).map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {tag.name}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">Asignar tag</Button>
          </form>
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
