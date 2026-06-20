import Link from "next/link";
import { Archive, Bell, Braces, MessageSquarePlus, Pencil, UserRoundCheck } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@crm-pro-ai/ui/card";
import { Input } from "@crm-pro-ai/ui/input";
import { createManualFollowUp } from "@/app/actions/automations";
import { archiveLead, createConversation, convertLeadToContact } from "@/app/actions/crm";
import { assignSmartTag } from "@/app/actions/smart-tags";
import { extractLeadVariables } from "@/app/actions/variables";
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

type LeadVariableRow = {
  value: unknown;
  confidence: number | null;
  extracted_at: string;
  variables: {
    id: string;
    name: string;
    key: string;
    type: string;
  } | null;
};

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_at: string | null;
};

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
};

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const [
    { data: lead },
    { data: smartTags },
    { data: assignedTags },
    { data: leadVariables },
    { data: tasks },
    { data: notifications }
  ] = await Promise.all([
    supabase
      .from("leads")
      .select("id, first_name, last_name, email, phone, company, source, status, owner_id, notes, contact_id")
      .eq("id", id)
      .eq("organization_id", organization.id)
      .is("archived_at", null)
      .single<LeadDetail>(),
    supabase
      .from("tags")
      .select("id, name, color")
      .eq("organization_id", organization.id)
      .eq("active", true)
      .is("archived_at", null)
      .order("name")
      .returns<SmartTagOption[]>(),
    supabase
      .from("lead_tags")
      .select("tags(id, name, color)")
      .eq("organization_id", organization.id)
      .eq("lead_id", id)
      .returns<Array<{ tags: SmartTagOption | null }>>(),
    supabase
      .from("lead_variables")
      .select("value, confidence, extracted_at, variables(id, name, key, type)")
      .eq("organization_id", organization.id)
      .eq("lead_id", id)
      .returns<LeadVariableRow[]>(),
    supabase
      .from("tasks")
      .select("id, title, description, status, due_at")
      .eq("organization_id", organization.id)
      .eq("lead_id", id)
      .eq("status", "pending")
      .order("due_at", { ascending: true, nullsFirst: false })
      .returns<TaskRow[]>(),
    supabase
      .from("internal_notifications")
      .select("id, title, body, created_at")
      .eq("organization_id", organization.id)
      .eq("entity_table", "leads")
      .eq("entity_id", id)
      .order("created_at", { ascending: false })
      .limit(5)
      .returns<NotificationRow[]>()
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
          <form action={archiveLead}>
            <input type="hidden" name="id" value={lead.id} />
            <input type="hidden" name="return_to" value="/leads" />
            <Button type="submit" variant="outline">
              <Archive className="size-4" />
              Archivar
            </Button>
          </form>
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
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Seguimientos y notificaciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={createManualFollowUp} className="grid gap-2 md:grid-cols-[1fr_180px_auto]">
            <input type="hidden" name="lead_id" value={lead.id} />
            <input type="hidden" name="return_to" value={`/leads/${lead.id}`} />
            <Input name="title" placeholder="Crear seguimiento manual" required />
            <Input name="due_at" type="datetime-local" />
            <Button type="submit" variant="outline">Crear tarea</Button>
          </form>
          <div className="grid gap-2 md:grid-cols-2">
            {(tasks ?? []).map((task) => (
              <div key={task.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{task.title}</p>
                <p className="text-muted-foreground">
                  {task.due_at ? new Date(task.due_at).toLocaleString("es-AR") : "Sin vencimiento"}
                </p>
              </div>
            ))}
            {(notifications ?? []).map((notification) => (
              <div key={notification.id} className="rounded-md border p-3 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <Bell className="size-4" />
                  {notification.title}
                </p>
                <p className="text-muted-foreground">{notification.body ?? "Notificacion interna"}</p>
              </div>
            ))}
            {(tasks ?? []).length === 0 && (notifications ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin seguimientos pendientes.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Variables Inteligentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={extractLeadVariables}>
            <input type="hidden" name="lead_id" value={lead.id} />
            <Button type="submit" variant="outline">
              <Braces className="size-4" />
              Actualizar variables con IA
            </Button>
          </form>
          <div className="grid gap-3 md:grid-cols-2">
            {(leadVariables ?? []).map((item) =>
              item.variables ? (
                <div key={item.variables.id} className="rounded-md border p-3 text-sm">
                  <p className="font-medium">{item.variables.name}</p>
                  <p className="text-muted-foreground">{formatVariableValue(item.value)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">confidence {item.confidence ?? 0}</p>
                </div>
              ) : null,
            )}
            {leadVariables?.length === 0 ? <p className="text-sm text-muted-foreground">Sin variables extraidas.</p> : null}
          </div>
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

function formatVariableValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}
