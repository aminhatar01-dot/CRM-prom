import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@crm-pro-ai/ui/button";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization, getAssignableMembers } from "@/lib/organization";
import { PipelineBoard, type PipelineLead, type PipelineOwnerOption } from "./_components/pipeline-board";

type LeadRow = Omit<PipelineLead, "tags" | "lastActivityAt">;

type LeadTagRow = {
  lead_id: string;
  tags: {
    id: string;
    name: string;
    color: string;
  } | null;
};

type ConversationActivityRow = {
  lead_id: string | null;
  last_message_at: string | null;
  updated_at: string;
};

export default async function PipelinePage() {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const [{ data: leads, error }, { data: leadTags }, { data: activityRows }, members] = await Promise.all([
    supabase
      .from("leads")
      .select("id, first_name, last_name, email, phone, source, status, owner_id, created_at, updated_at")
      .eq("organization_id", organization.id)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .returns<LeadRow[]>(),
    supabase
      .from("lead_tags")
      .select("lead_id, tags(id, name, color)")
      .eq("organization_id", organization.id)
      .returns<LeadTagRow[]>(),
    supabase
      .from("conversations")
      .select("lead_id, last_message_at, updated_at")
      .eq("organization_id", organization.id)
      .not("lead_id", "is", null)
      .is("archived_at", null)
      .returns<ConversationActivityRow[]>(),
    getAssignableMembers(supabase, organization.id)
  ]);

  const tagsByLead = new Map<string, PipelineLead["tags"]>();
  for (const row of leadTags ?? []) {
    if (!row.tags) continue;
    const current = tagsByLead.get(row.lead_id) ?? [];
    current.push(row.tags);
    tagsByLead.set(row.lead_id, current);
  }

  const activityByLead = new Map<string, string>();
  for (const row of activityRows ?? []) {
    if (!row.lead_id) continue;
    const activity = row.last_message_at ?? row.updated_at;
    const current = activityByLead.get(row.lead_id);
    if (!current || new Date(activity).getTime() > new Date(current).getTime()) {
      activityByLead.set(row.lead_id, activity);
    }
  }

  const pipelineLeads: PipelineLead[] = (leads ?? []).map((lead) => ({
    ...lead,
    tags: tagsByLead.get(lead.id) ?? [],
    lastActivityAt: activityByLead.get(lead.id) ?? lead.updated_at
  }));

  const owners: PipelineOwnerOption[] = members.map((member) => ({
    id: member.user_id,
    label:
      member.user_id === user.id
        ? `Tu usuario (${member.role})`
        : `${member.role} · ${member.user_id.slice(0, 8)}`
  }));

  return (
    <section className="min-w-0 px-4 py-6 lg:px-6">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Mueve oportunidades entre etapas y conserva el estado en tiempo real.
          </p>
        </div>
        <Button asChild>
          <Link href="/leads/new">
            <Plus className="size-4" />
            Nuevo lead
          </Link>
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          No pudimos cargar el pipeline. Actualiza la pagina para intentarlo nuevamente.
        </p>
      ) : null}

      <PipelineBoard initialLeads={pipelineLeads} owners={owners} />
    </section>
  );
}
