import type { SupabaseClient } from "@supabase/supabase-js";
import type { AIContext, AIMessageContext, AssistantConfig } from "@crm-pro-ai/ai/assistant";

export type AssistantRow = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  prompt: string;
  objective: string | null;
  tone: "professional" | "friendly" | "direct" | "warm";
  rules: unknown;
  fallback_message: string;
  active: boolean;
  channel_id: string | null;
  auto_reply_enabled: boolean;
};

type ConversationContextRow = {
  id: string;
  lead_id: string | null;
  contact_id: string | null;
  channel: string;
  status: string;
  ai_status: string;
  metadata?: Record<string, unknown> | null;
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
  channel: string;
  status: string;
  created_at: string;
};

export function mapAssistant(row: AssistantRow): AssistantConfig {
  return {
    organization_id: row.organization_id,
    name: row.name,
    description: row.description,
    prompt: row.prompt,
    objective: row.objective,
    tone: row.tone,
    rules: Array.isArray(row.rules) ? row.rules.join("\n") : typeof row.rules === "string" ? row.rules : JSON.stringify(row.rules ?? []),
    fallback_message: row.fallback_message,
    active: row.active,
    channel_id: row.channel_id,
    auto_reply_enabled: row.auto_reply_enabled
  };
}

export async function buildConversationAIContext({
  supabase,
  organizationId,
  organizationName,
  assistant,
  conversationId,
  userInput
}: {
  supabase: SupabaseClient;
  organizationId: string;
  organizationName: string;
  assistant: AssistantConfig;
  conversationId?: string | null;
  userInput?: string;
}): Promise<AIContext> {
  if (!conversationId) {
    return {
      organizationName,
      assistant,
      messages: [],
      userInput
    };
  }

  const [{ data: conversation }, { data: messages }] = await Promise.all([
    supabase
      .from("conversations")
      .select(
        "id, lead_id, contact_id, channel, status, ai_status, leads(first_name, last_name, email, phone, company, status, notes), contacts(first_name, last_name, email, phone, company, notes)",
      )
      .eq("id", conversationId)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .single<ConversationContextRow>(),
    supabase
      .from("messages")
      .select("direction, body, channel, status, created_at")
      .eq("conversation_id", conversationId)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(12)
      .returns<MessageRow[]>()
  ]);

  const person = conversation?.contacts
    ? {
        kind: "contact" as const,
        name: [conversation.contacts.first_name, conversation.contacts.last_name].filter(Boolean).join(" "),
        email: conversation.contacts.email,
        phone: conversation.contacts.phone,
        company: conversation.contacts.company,
        notes: conversation.contacts.notes
      }
    : conversation?.leads
      ? {
          kind: "lead" as const,
          name: [conversation.leads.first_name, conversation.leads.last_name].filter(Boolean).join(" "),
          email: conversation.leads.email,
          phone: conversation.leads.phone,
          company: conversation.leads.company,
          status: conversation.leads.status,
          notes: conversation.leads.notes
        }
      : undefined;

  const [{ data: assignedTags }, { data: leadVariables }, { data: conversationVariables }] = await Promise.all([
    conversation?.lead_id
      ? supabase
          .from("lead_tags")
          .select("tags(name, color, description)")
          .eq("organization_id", organizationId)
          .eq("lead_id", conversation.lead_id)
      : Promise.resolve({ data: [] }),
    conversation?.lead_id
      ? supabase
          .from("lead_variables")
          .select("value, confidence, variables(key, name)")
          .eq("organization_id", organizationId)
          .eq("lead_id", conversation.lead_id)
      : Promise.resolve({ data: [] }),
    supabase
      .from("conversation_variables")
      .select("value, confidence, variables(key, name)")
      .eq("organization_id", organizationId)
      .eq("conversation_id", conversationId)
  ]);

  const variableRows = [...(leadVariables ?? []), ...(conversationVariables ?? [])] as unknown as Array<{
    value: unknown;
    confidence: number | null;
    variables: { key: string; name: string } | Array<{ key: string; name: string }> | null;
  }>;
  const variablesByKey = new Map<string, { key: string; name: string; value: unknown; confidence: number | null }>();
  for (const row of variableRows) {
    const definition = Array.isArray(row.variables) ? row.variables[0] : row.variables;
    if (!definition) continue;
    variablesByKey.set(definition.key, {
      key: definition.key,
      name: definition.name,
      value: row.value,
      confidence: row.confidence
    });
  }
  const smartTags = (assignedTags ?? [])
    .map((row) => {
      const related = row.tags as unknown as
        | { name: string; color?: string; description?: string | null }
        | Array<{ name: string; color?: string; description?: string | null }>
        | null;
      return Array.isArray(related) ? related[0] : related;
    })
    .filter(
      (tag): tag is { name: string; color?: string; description?: string | null } =>
        Boolean(tag),
    );

  return {
    organizationName,
    assistant,
    conversation: conversation
      ? {
          id: conversation.id,
          channel: conversation.channel,
          status: conversation.status,
          ai_status: conversation.ai_status
        }
      : undefined,
    person,
    messages: ((messages ?? []).reverse() as AIMessageContext[]),
    smartTags,
    variables: Array.from(variablesByKey.values()),
    userInput
  };
}
