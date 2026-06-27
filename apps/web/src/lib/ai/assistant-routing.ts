import type { SupabaseClient } from "@supabase/supabase-js";
import { agentConfigSchema } from "@crm-pro-ai/ai/agent-config";
import { routeAssistant, type AssistantRoutingDecision } from "@crm-pro-ai/ai/assistant-router";
import type { AssistantRow } from "@/lib/ai/context";
import { searchKnowledge } from "@/lib/knowledge/service";

export async function selectAssistantForConversation({
  supabase,
  organizationId,
  conversationId,
  assistants,
  message,
  channel
}: {
  supabase: SupabaseClient;
  organizationId: string;
  conversationId: string;
  assistants: AssistantRow[];
  message?: string;
  channel?: string;
}): Promise<{ assistant: AssistantRow | null; decision: AssistantRoutingDecision | null }> {
  if (assistants.length === 0) return { assistant: null, decision: null };
  let latestMessage = message;
  let conversationChannel = channel;
  if (!latestMessage || !conversationChannel) {
    const [{ data: conversation }, { data: inbound }] = await Promise.all([
      supabase.from("conversations").select("channel").eq("id", conversationId).eq("organization_id", organizationId).maybeSingle<{ channel: string }>(),
      supabase.from("messages").select("body").eq("conversation_id", conversationId).eq("organization_id", organizationId)
        .eq("direction", "inbound").is("archived_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle<{ body: string }>()
    ]);
    latestMessage ??= inbound?.body ?? "";
    conversationChannel ??= conversation?.channel ?? "manual";
  }

  const { data: lastLog } = await supabase.from("ai_logs").select("assistant_id")
    .eq("organization_id", organizationId).eq("conversation_id", conversationId).eq("status", "success")
    .not("assistant_id", "is", null).order("created_at", { ascending: false }).limit(1).maybeSingle<{ assistant_id: string | null }>();
  let categories: string[] = [];
  try {
    const knowledge = latestMessage.trim() ? await searchKnowledge({ organizationId, query: latestMessage, limit: 3 }) : [];
    categories = Array.from(new Set(knowledge.map((source) => source.category)));
  } catch {
    categories = [];
  }

  const decision = routeAssistant({
    candidates: assistants.map((assistant) => {
      const config = agentConfigSchema.safeParse(assistant.agent_config);
      return {
        id: assistant.id,
        name: assistant.name,
        channelId: assistant.channel_id,
        role: config.success ? config.data.role : assistant.description ?? undefined,
        industry: config.success ? config.data.industry : undefined,
        primaryIntent: config.success ? config.data.primary_intent : "general",
        topics: config.success ? config.data.topics : [],
        excludedTopics: config.success ? config.data.excluded_topics : [],
        knowledgeCategories: config.success ? config.data.knowledge_categories : [],
        priority: config.success ? config.data.routing_priority : 50,
        isDefault: config.success ? config.data.is_default : false
      };
    }),
    channel: conversationChannel,
    message: latestMessage,
    lastAssistantId: lastLog?.assistant_id,
    relevantKnowledgeCategories: categories
  });
  return {
    assistant: assistants.find((assistant) => assistant.id === decision?.assistantId) ?? assistants[0] ?? null,
    decision
  };
}
