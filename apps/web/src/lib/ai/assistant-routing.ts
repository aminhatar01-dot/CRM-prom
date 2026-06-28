import type { SupabaseClient } from "@supabase/supabase-js";
import { agentConfigSchema } from "@crm-pro-ai/ai/agent-config";
import {
  detectFunctionalIntent,
  routeAssistant,
  type AssistantRoutingDecision,
} from "@crm-pro-ai/ai/assistant-router";
import type { AssistantRow } from "@/lib/ai/context";
import { searchKnowledge } from "@/lib/knowledge/service";

export async function selectAssistantForConversation({
  supabase,
  organizationId,
  conversationId,
  assistants,
  message,
  channel,
}: {
  supabase: SupabaseClient;
  organizationId: string;
  conversationId: string;
  assistants: AssistantRow[];
  message?: string;
  channel?: string;
}): Promise<{
  assistant: AssistantRow | null;
  decision: AssistantRoutingDecision | null;
}> {
  if (assistants.length === 0) return { assistant: null, decision: null };
  let latestMessage = message;
  let conversationChannel = channel;
  if (!latestMessage || !conversationChannel) {
    const [{ data: conversation }, { data: inbound }] = await Promise.all([
      supabase
        .from("conversations")
        .select("channel")
        .eq("id", conversationId)
        .eq("organization_id", organizationId)
        .maybeSingle<{ channel: string }>(),
      supabase
        .from("messages")
        .select("body")
        .eq("conversation_id", conversationId)
        .eq("organization_id", organizationId)
        .eq("direction", "inbound")
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ body: string }>(),
    ]);
    latestMessage ??= inbound?.body ?? "";
    conversationChannel ??= conversation?.channel ?? "manual";
  }

  const { data: routingControl } = await supabase
    .from("conversations")
    .select(
      "assistant_routing_mode,forced_assistant_id,current_assistant_id,status,ai_status",
    )
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .maybeSingle<{
      assistant_routing_mode: string;
      forced_assistant_id: string | null;
      current_assistant_id: string | null;
      status: string;
      ai_status: string;
    }>();
  if (
    routingControl?.assistant_routing_mode === "manual" &&
    routingControl.forced_assistant_id
  ) {
    const forced =
      assistants.find(
        (assistant) => assistant.id === routingControl.forced_assistant_id,
      ) ?? null;
    return {
      assistant: forced,
      decision: forced
        ? {
            assistantId: forced.id,
            detectedIntent: detectFunctionalIntent(latestMessage),
            confidence: 1,
            reason: "Asistente fijado manualmente para esta conversacion.",
            previousAssistantId: routingControl.current_assistant_id,
            switchedAssistant:
              routingControl.current_assistant_id !== forced.id,
            usedDefault: false,
            scores: [
              {
                assistantId: forced.id,
                name: forced.name,
                score: 100,
                reasons: ["Seleccion manual"],
              },
            ],
          }
        : null,
    };
  }
  const { data: lastLog } = await supabase
    .from("ai_logs")
    .select("assistant_id,metadata")
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversationId)
    .eq("status", "success")
    .not("assistant_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{
      assistant_id: string | null;
      metadata: Record<string, unknown> | null;
    }>();
  let categories: string[] = [];
  try {
    const knowledge = latestMessage.trim()
      ? await searchKnowledge({
          organizationId,
          query: latestMessage,
          limit: 3,
        })
      : [];
    categories = Array.from(
      new Set(knowledge.map((source) => source.category)),
    );
  } catch {
    categories = [];
  }
  const { data: activeRules } = await supabase
    .from("automation_rules")
    .select("automation_actions(config,enabled)")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .eq("enabled", true)
    .eq("trigger_type", "message_received")
    .returns<
      Array<{
        automation_actions: Array<{
          config: Record<string, unknown>;
          enabled: boolean;
        }> | null;
      }>
    >();
  const automationAssistantIds = new Set(
    (activeRules ?? [])
      .flatMap((rule) => rule.automation_actions ?? [])
      .filter(
        (action) =>
          action.enabled && typeof action.config.assistant_id === "string",
      )
      .map((action) => action.config.assistant_id as string),
  );

  const decision = routeAssistant({
    candidates: assistants.map((assistant) => {
      const config = agentConfigSchema.safeParse(assistant.agent_config);
      return {
        id: assistant.id,
        name: assistant.name,
        channelId: assistant.channel_id,
        role: config.success
          ? config.data.role
          : (assistant.description ?? undefined),
        industry: config.success ? config.data.industry : undefined,
        primaryIntent: config.success ? config.data.primary_intent : "general",
        topics: config.success ? config.data.topics : [],
        excludedTopics: config.success ? config.data.excluded_topics : [],
        knowledgeCategories: config.success
          ? config.data.knowledge_categories
          : [],
        priority: config.success ? config.data.routing_priority : 50,
        isDefault: config.success ? config.data.is_default : false,
        automationPreferred: automationAssistantIds.has(assistant.id),
        capabilities: config.success
          ? {
              canAnswerPrices: config.data.can_answer_prices,
              canCreateQuotes: config.data.can_create_quotes,
              canSendQuotes: config.data.can_send_quotes,
            }
          : undefined,
      };
    }),
    channel: conversationChannel,
    message: latestMessage,
    lastAssistantId:
      routingControl?.current_assistant_id ?? lastLog?.assistant_id,
    previousIntent: previousRoutingIntent(lastLog?.metadata),
    isContinuation: isShortContinuation(latestMessage),
    relevantKnowledgeCategories: categories,
  });
  const assistant =
    assistants.find((item) => item.id === decision?.assistantId) ??
    assistants.find(
      (item) =>
        agentConfigSchema.safeParse(item.agent_config).success &&
        agentConfigSchema.parse(item.agent_config).is_default,
    ) ??
    assistants[0] ??
    null;
  if (assistant && decision) {
    await supabase
      .from("conversations")
      .update({
        current_assistant_id: assistant.id,
        assistant_routing_metadata: {
          ...decision,
          conversation_status: routingControl?.status,
          conversation_ai_status: routingControl?.ai_status,
        },
      })
      .eq("id", conversationId)
      .eq("organization_id", organizationId)
      .eq("assistant_routing_mode", "auto");
  }
  return { assistant, decision };
}

function previousRoutingIntent(
  metadata: Record<string, unknown> | null | undefined,
) {
  const routing = metadata?.assistant_routing;
  return routing &&
    typeof routing === "object" &&
    "detectedIntent" in routing &&
    typeof routing.detectedIntent === "string"
    ? routing.detectedIntent
    : null;
}
function isShortContinuation(message: string) {
  const words = message.trim().split(/\s+/).filter(Boolean);
  return (
    words.length > 0 &&
    words.length <= 4 &&
    ![
      "support",
      "quote",
      "price",
      "scheduling",
      "collections",
      "after_sales",
    ].includes(detectFunctionalIntent(message))
  );
}
