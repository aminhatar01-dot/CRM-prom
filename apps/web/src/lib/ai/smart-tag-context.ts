import type { SupabaseClient } from "@supabase/supabase-js";
import type { SmartTagClassificationContext, SmartTagDefinition } from "@crm-pro-ai/ai/smart-tags";

export type TagRow = {
  id: string;
  organization_id: string;
  name: string;
  color: string;
  description: string | null;
  classification_prompt: string | null;
  active: boolean;
  auto_pause_assistant: boolean;
  notify_team: boolean;
};

type ConversationRow = {
  id: string;
  channel: string;
  status: string;
  ai_status: string;
  lead_id: string | null;
  leads: {
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

type MessageRow = {
  direction: "inbound" | "outbound";
  body: string;
};

export function mapSmartTag(row: TagRow): SmartTagDefinition {
  return {
    id: row.id,
    organization_id: row.organization_id,
    name: row.name,
    color: row.color,
    description: row.description,
    classification_prompt:
      row.classification_prompt ?? `Clasificar cuando la conversacion coincida con ${row.name}.`,
    active: row.active,
    auto_pause_assistant: row.auto_pause_assistant,
    notify_team: row.notify_team
  };
}

export async function buildSmartTagConversationContext({
  supabase,
  organizationId,
  conversationId
}: {
  supabase: SupabaseClient;
  organizationId: string;
  conversationId: string;
}): Promise<{ context: SmartTagClassificationContext; leadId: string | null }> {
  const [{ data: conversation }, { data: messages }] = await Promise.all([
    supabase
      .from("conversations")
      .select(
        "id, channel, status, ai_status, lead_id, leads(first_name, last_name, email, phone, company, status, notes), contacts(first_name, last_name, email, phone, company, notes)",
      )
      .eq("organization_id", organizationId)
      .eq("id", conversationId)
      .single<ConversationRow>(),
    supabase
      .from("messages")
      .select("direction, body")
      .eq("organization_id", organizationId)
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(12)
      .returns<MessageRow[]>()
  ]);

  const lead = conversation?.leads
    ? {
        name: [conversation.leads.first_name, conversation.leads.last_name].filter(Boolean).join(" "),
        email: conversation.leads.email,
        phone: conversation.leads.phone,
        company: conversation.leads.company,
        status: conversation.leads.status,
        notes: conversation.leads.notes
      }
    : conversation?.contacts
      ? {
          name: [conversation.contacts.first_name, conversation.contacts.last_name].filter(Boolean).join(" "),
          email: conversation.contacts.email,
          phone: conversation.contacts.phone,
          company: conversation.contacts.company,
          status: null,
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
            status: conversation.status,
            ai_status: conversation.ai_status
          }
        : undefined,
      messages: (messages ?? []).reverse()
    }
  };
}
