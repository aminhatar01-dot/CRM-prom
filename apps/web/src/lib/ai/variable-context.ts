import type { SupabaseClient } from "@supabase/supabase-js";
import type { VariableDefinition, VariableExtractionContext } from "@crm-pro-ai/ai/variables";

export type VariableRow = {
  id: string;
  organization_id: string;
  name: string;
  key: string;
  description: string | null;
  type: VariableDefinition["type"];
  extraction_prompt: string;
  active: boolean;
  required: boolean;
  options: string[] | null;
};

type ConversationRow = {
  id: string;
  channel: string;
  status: string;
  lead_id: string | null;
  leads: {
    id: string;
    first_name: string;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    status: string | null;
    notes: string | null;
  } | null;
  contacts: {
    first_name: string;
    last_name: string | null;
    email: string | null;
    phone: string | null;
    company: string | null;
    notes: string | null;
  } | null;
};

type LeadRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string | null;
  notes: string | null;
};

type MessageRow = {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
};

export function mapVariable(row: VariableRow): VariableDefinition {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    key: row.key,
    description: row.description,
    type: row.type,
    extraction_prompt: row.extraction_prompt,
    active: row.active,
    required: row.required,
    options: row.options ?? []
  };
}

export async function buildConversationVariableContext({
  supabase,
  organizationId,
  conversationId
}: {
  supabase: SupabaseClient;
  organizationId: string;
  conversationId: string;
}): Promise<{ context: VariableExtractionContext; leadId: string | null }> {
  const [{ data: conversation }, { data: messages }] = await Promise.all([
    supabase
      .from("conversations")
      .select(
        "id, channel, status, lead_id, leads(id, first_name, last_name, email, phone, company, status, notes), contacts(first_name, last_name, email, phone, company, notes)",
      )
      .eq("organization_id", organizationId)
      .eq("id", conversationId)
      .single<ConversationRow>(),
    supabase
      .from("messages")
      .select("id, direction, body")
      .eq("organization_id", organizationId)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(12)
      .returns<MessageRow[]>()
  ]);

  const lead = conversation?.leads
    ? mapLead(conversation.leads)
    : conversation?.contacts
      ? {
          name: [conversation.contacts.first_name, conversation.contacts.last_name].filter(Boolean).join(" "),
          email: conversation.contacts.email,
          phone: conversation.contacts.phone,
          company: conversation.contacts.company,
          notes: conversation.contacts.notes
        }
      : undefined;

  return {
    leadId: conversation?.lead_id ?? null,
    context: {
      lead,
      conversation: conversation
        ? {
            id: conversation.id,
            channel: conversation.channel,
            status: conversation.status
          }
        : undefined,
      messages: (messages ?? []).reverse()
    }
  };
}

export async function buildLeadVariableContext({
  supabase,
  organizationId,
  leadId
}: {
  supabase: SupabaseClient;
  organizationId: string;
  leadId: string;
}): Promise<VariableExtractionContext> {
  const { data: lead } = await supabase
    .from("leads")
    .select("id, first_name, last_name, email, phone, company, status, notes")
    .eq("organization_id", organizationId)
    .eq("id", leadId)
    .single<LeadRow>();

  return {
    lead: lead ? mapLead(lead) : undefined,
    messages: []
  };
}

function mapLead(lead: LeadRow) {
  return {
    id: lead.id,
    name: [lead.first_name, lead.last_name].filter(Boolean).join(" "),
    email: lead.email,
    phone: lead.phone,
    company: lead.company,
    status: lead.status,
    notes: lead.notes
  };
}
