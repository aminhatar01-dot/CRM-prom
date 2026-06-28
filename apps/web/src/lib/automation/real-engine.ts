import type { SupabaseClient } from "@supabase/supabase-js";
import { AIOrchestrator } from "@crm-pro-ai/ai/orchestrator";
import { VariableExtractor } from "@crm-pro-ai/ai/variable-extractor";
import {
  WhatsAppCloudError,
  WhatsAppCloudService,
} from "@crm-pro-ai/integrations/whatsapp-cloud-service";
import {
  autoReplyLimitFallback,
  conditionsMatch,
  decideAutoSend,
  detectHumanEscalationIntent,
  isAutoReplyAllowed,
  isWithinWhatsAppWindow,
  type AutomationContext,
} from "@crm-pro-ai/automation/engine";
import type { AutomationTriggerType } from "@crm-pro-ai/automation/rules";
import {
  buildConversationAIContext,
  mapAssistant,
  type AssistantRow,
} from "@/lib/ai/context";
import {
  buildConversationVariableContext,
  mapVariable,
  type VariableRow,
} from "@/lib/ai/variable-context";
import {
  enforceAIRateLimit,
  getAIRuntimeConfig,
  summarizeAIInput,
  usageMetadata,
} from "@/lib/ai/runtime";
import { loadAvailableAITools } from "@/lib/ai/tools";
import { selectAssistantForConversation } from "@/lib/ai/assistant-routing";
import { getServerEnv } from "@/lib/env";
import { getWhatsAppAccessToken } from "@/lib/whatsapp/token-store";
import {
  createQuoteFromConversation,
  formatQuoteMessage,
  resolveSimplePriceFromConversation,
} from "@/lib/quotes/service";
import { agentConfigSchema } from "@crm-pro-ai/ai/agent-config";

type EventInput = {
  organizationId: string;
  trigger: AutomationTriggerType;
  eventId: string;
  conversationId?: string | null;
  leadId?: string | null;
  contactId?: string | null;
  messageId?: string | null;
  smartTagId?: string | null;
  variableId?: string | null;
  ownerId?: string | null;
  actorUserId?: string | null;
  metadata?: Record<string, unknown>;
};

type RuleRow = {
  id: string;
  organization_id: string;
  name: string;
  trigger_type: AutomationTriggerType;
  status: string;
  conditions: Record<string, unknown>;
  trigger_config: Record<string, unknown>;
  auto_send: boolean;
  auto_reply_limit: number;
  auto_reply_window_minutes: number;
};

type ActionRow = {
  action_type: string;
  config: Record<string, unknown>;
  enabled: boolean;
  position: number;
};

type LoadedContext = AutomationContext & {
  contact_id?: string | null;
  message_id?: string | null;
  last_inbound_at?: string | null;
};

export async function dispatchAutomationEvent(
  supabase: SupabaseClient,
  event: EventInput,
) {
  const { data: rules, error } = await supabase
    .from("automation_rules")
    .select(
      "id, organization_id, name, trigger_type, status, conditions, trigger_config, auto_send, auto_reply_limit, auto_reply_window_minutes",
    )
    .eq("organization_id", event.organizationId)
    .eq("trigger_type", event.trigger)
    .eq("status", "active")
    .eq("enabled", true)
    .returns<RuleRow[]>();

  if (error)
    throw new Error(`Automation rules could not be loaded: ${error.message}`);

  const results = [];
  for (const rule of rules ?? []) {
    results.push(await createAndExecuteRun(supabase, rule, event));
  }
  return results;
}

async function createAndExecuteRun(
  supabase: SupabaseClient,
  rule: RuleRow,
  event: EventInput,
) {
  const context = await loadContext(supabase, event);
  const idempotencyKey = `${event.trigger}:${event.eventId}:${rule.id}`;
  const { data: run, error } = await supabase
    .from("automation_runs")
    .insert({
      organization_id: event.organizationId,
      rule_id: rule.id,
      trigger_type: event.trigger,
      status: "pending",
      idempotency_key: idempotencyKey,
      conversation_id: event.conversationId,
      lead_id: event.leadId ?? context.lead_id,
      contact_id: event.contactId ?? context.contact_id,
      message_id: event.messageId,
      initiated_by: event.actorUserId,
      context: {
        ...context,
        ...event.metadata,
        smart_tag_id: event.smartTagId,
        variable_id: event.variableId,
      },
    })
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error?.code === "23505") return { status: "duplicate", ruleId: rule.id };
  if (error || !run)
    throw new Error(
      `Automation run could not be created: ${error?.message ?? "unknown"}`,
    );

  return executeRealAutomationRun(supabase, run.id, rule, context);
}

export async function executeRealAutomationRun(
  supabase: SupabaseClient,
  runId: string,
  suppliedRule?: RuleRow,
  suppliedContext?: LoadedContext,
) {
  const { data: run } = await supabase
    .from("automation_runs")
    .select(
      "id, organization_id, rule_id, trigger_type, context, conversation_id, lead_id, contact_id, message_id",
    )
    .eq("id", runId)
    .single<{
      id: string;
      organization_id: string;
      rule_id: string;
      trigger_type: AutomationTriggerType;
      context: LoadedContext;
      conversation_id: string | null;
      lead_id: string | null;
      contact_id: string | null;
      message_id: string | null;
    }>();
  if (!run) throw new Error("Automation run not found.");

  const rule =
    suppliedRule ??
    (await loadRule(supabase, run.organization_id, run.rule_id));
  const context = suppliedContext ?? run.context;
  await supabase
    .from("automation_runs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .eq("organization_id", run.organization_id);

  try {
    if (!conditionsMatch(rule.conditions, context)) {
      await finish(supabase, run, "cancelled", {
        matched: false,
        reason: "conditions_not_met",
      });
      return { status: "cancelled", runId };
    }

    const { data: actions } = await supabase
      .from("automation_actions")
      .select("action_type, config, enabled, position")
      .eq("organization_id", run.organization_id)
      .eq("rule_id", rule.id)
      .eq("enabled", true)
      .order("position")
      .returns<ActionRow[]>();

    const actionResults = [];
    for (const action of actions ?? []) {
      actionResults.push(
        await executeAction(supabase, rule, run, context, action),
      );
    }

    await finish(supabase, run, "completed", {
      matched: true,
      actions: actionResults,
    });
    await supabase
      .from("automation_rules")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", rule.id)
      .eq("organization_id", run.organization_id);
    return { status: "completed", runId, actions: actionResults };
  } catch (error) {
    const message = safeError(error);
    await supabase
      .from("automation_runs")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", run.id)
      .eq("organization_id", run.organization_id);
    return { status: "failed", runId, error: message };
  }
}

async function executeAction(
  supabase: SupabaseClient,
  rule: RuleRow,
  run: {
    id: string;
    organization_id: string;
    conversation_id: string | null;
    lead_id: string | null;
    contact_id: string | null;
    message_id: string | null;
  },
  context: LoadedContext,
  action: ActionRow,
) {
  const logBase = {
    organization_id: run.organization_id,
    rule_id: rule.id,
    run_id: run.id,
    action_type: action.action_type,
    input: sanitizeRecord(action.config),
  };
  try {
    let output: Record<string, unknown>;
    if (action.action_type === "create_task") {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          organization_id: run.organization_id,
          lead_id: run.lead_id,
          conversation_id: run.conversation_id,
          owner_id: action.config.owner_id ?? context.owner_id ?? null,
          title: action.config.title ?? "Seguimiento automatico",
          description: action.config.description ?? `Creado por ${rule.name}`,
          due_at: action.config.due_at ?? null,
        })
        .select("id")
        .single<{ id: string }>();
      if (error) throw error;
      output = { task_id: data.id };
    } else if (action.action_type === "assign_smart_tag") {
      const tagId = stringConfig(action.config.tag_id, "tag_id");
      if (run.lead_id) {
        const { error } = await supabase.from("lead_tags").upsert(
          {
            organization_id: run.organization_id,
            lead_id: run.lead_id,
            tag_id: tagId,
          },
          { onConflict: "lead_id,tag_id" },
        );
        if (error) throw error;
      }
      if (run.conversation_id) {
        const { error } = await supabase.from("conversation_smart_tags").upsert(
          {
            organization_id: run.organization_id,
            conversation_id: run.conversation_id,
            tag_id: tagId,
            assignment_source: "automation",
          },
          { onConflict: "conversation_id,tag_id" },
        );
        if (error) throw error;
      }
      output = { tag_id: tagId };
    } else if (action.action_type === "change_lead_status") {
      if (!run.lead_id) throw new Error("Lead context is required.");
      const status = stringConfig(action.config.status, "status");
      const { error } = await supabase
        .from("leads")
        .update({ status })
        .eq("id", run.lead_id)
        .eq("organization_id", run.organization_id);
      if (error) throw error;
      output = { lead_id: run.lead_id, status };
    } else if (action.action_type === "create_activity") {
      const { data, error } = await supabase
        .from("audit_logs")
        .insert({
          organization_id: run.organization_id,
          action: action.config.action ?? "automation_activity",
          entity_table: run.conversation_id ? "conversations" : "leads",
          entity_id: run.conversation_id ?? run.lead_id,
          metadata: {
            source: "automation",
            rule_id: rule.id,
            run_id: run.id,
            description: action.config.description ?? null,
          },
        })
        .select("id")
        .single<{ id: string }>();
      if (error) throw error;
      output = { audit_log_id: data.id };
    } else if (action.action_type === "notify_internal") {
      const { data, error } = await supabase
        .from("internal_notifications")
        .insert({
          organization_id: run.organization_id,
          user_id: action.config.user_id ?? context.owner_id ?? null,
          title: action.config.title ?? "Automatizacion ejecutada",
          body: action.config.body ?? rule.name,
          entity_table: run.conversation_id ? "conversations" : "leads",
          entity_id: run.conversation_id ?? run.lead_id,
          metadata: { rule_id: rule.id, run_id: run.id },
        })
        .select("id")
        .single<{ id: string }>();
      if (error) throw error;
      output = { notification_id: data.id };
    } else if (action.action_type === "extract_variable") {
      output = await extractVariable(supabase, run, action.config);
    } else if (
      action.action_type === "generate_ai_draft" ||
      action.action_type === "send_message"
    ) {
      output = await generateDraft(supabase, rule, run, context, action.config);
    } else if (action.action_type === "pause_ai") {
      if (!run.conversation_id)
        throw new Error("Conversation context is required.");
      const { error } = await supabase
        .from("conversations")
        .update({ ai_status: "paused", ai_paused: true })
        .eq("id", run.conversation_id)
        .eq("organization_id", run.organization_id);
      if (error) throw error;
      output = { conversation_id: run.conversation_id, paused: true };
    } else if (action.action_type === "update_variable") {
      output = await updateVariable(supabase, run, action.config);
    } else if (
      action.action_type === "create_quote" ||
      action.action_type === "send_quote_draft"
    ) {
      if (!run.conversation_id)
        throw new Error("Conversation context is required to create a quote.");
      const result = await createQuoteFromConversation({
        organizationId: run.organization_id,
        conversationId: run.conversation_id,
      });
      if (result.status === "clarification") {
        output = {
          blocked: true,
          reason: result.reason,
          clarification: result.message,
        };
      } else if (action.action_type === "send_quote_draft") {
        const { data: quote } = await supabase
          .from("quotes")
          .select("id,quote_number,currency,total,expires_at,commercial_terms")
          .eq("id", result.quoteId)
          .eq("organization_id", run.organization_id)
          .single<{
            id: string;
            quote_number: string;
            currency: string;
            total: number;
            expires_at: string | null;
            commercial_terms: string | null;
          }>();
        const { data: items } = await supabase
          .from("quote_items")
          .select("name,quantity,unit_price,line_total")
          .eq("quote_id", result.quoteId)
          .eq("organization_id", run.organization_id)
          .order("position");
        if (!quote || !items?.length)
          throw new Error("The generated quote could not be loaded.");
        const body = formatQuoteMessage(quote, items ?? []);
        const { data: draft, error } = await supabase
          .from("automation_drafts")
          .insert({
            organization_id: run.organization_id,
            rule_id: rule.id,
            run_id: run.id,
            conversation_id: run.conversation_id,
            source_message_id: run.message_id,
            body,
            status: "pending",
            auto_send_requested: false,
            metadata: {
              quote_id: result.quoteId,
              quote_number: result.quoteNumber,
            },
          })
          .select("id")
          .single<{ id: string }>();
        if (error || !draft)
          throw error ?? new Error("The quote draft could not be created.");
        output = {
          quote_id: result.quoteId,
          draft_id: draft.id,
          auto_send: false,
        };
      } else
        output = {
          quote_id: result.quoteId,
          quote_number: result.quoteNumber,
          status: "pending_approval",
        };
    } else if (action.action_type === "mark_quote_sent") {
      const quoteId =
        typeof action.config.quote_id === "string"
          ? action.config.quote_id
          : null;
      if (!quoteId) throw new Error("quote_id is required.");
      const { error } = await supabase
        .from("quotes")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", quoteId)
        .eq("organization_id", run.organization_id);
      if (error) throw error;
      output = { quote_id: quoteId, status: "sent" };
    } else if (action.action_type === "notify_quote_accepted") {
      const quoteId =
        typeof action.config.quote_id === "string"
          ? action.config.quote_id
          : null;
      const { data, error } = await supabase
        .from("internal_notifications")
        .insert({
          organization_id: run.organization_id,
          user_id: context.owner_id ?? null,
          title: "Cotizacion aceptada",
          body: "Una cotizacion requiere seguimiento comercial.",
          entity_table: "quotes",
          entity_id: quoteId,
          metadata: { rule_id: rule.id, run_id: run.id, quote_id: quoteId },
        })
        .select("id")
        .single<{ id: string }>();
      if (error) throw error;
      output = { notification_id: data.id };
    } else {
      output = { skipped: true, reason: "unsupported_action" };
    }

    await supabase.from("automation_execution_logs").insert({
      ...logBase,
      status: output.blocked
        ? "blocked"
        : output.skipped
          ? "skipped"
          : "completed",
      output: sanitizeRecord(output),
      model: output.model ?? null,
      token_usage: output.token_usage ?? {},
    });
    return { type: action.action_type, ...output };
  } catch (error) {
    const message = safeError(error);
    await supabase.from("automation_execution_logs").insert({
      ...logBase,
      status: "failed",
      error_message: message,
    });
    throw error;
  }
}

async function generateDraft(
  supabase: SupabaseClient,
  rule: RuleRow,
  run: {
    id: string;
    organization_id: string;
    conversation_id: string | null;
    message_id: string | null;
  },
  context: LoadedContext,
  config: Record<string, unknown>,
) {
  if (!run.conversation_id || !run.message_id) {
    return { skipped: true, reason: "minimum_context_missing" };
  }
  const { data: triggerMessage } = await supabase
    .from("messages")
    .select("direction, sender_type, body, channel")
    .eq("id", run.message_id)
    .eq("organization_id", run.organization_id)
    .maybeSingle<{
      direction: string;
      sender_type: string | null;
      body: string;
      channel: string;
    }>();
  if (
    triggerMessage?.direction !== "inbound" ||
    triggerMessage.sender_type === "assistant"
  ) {
    return { skipped: true, reason: "inbound_contact_message_required" };
  }
  const { data: organization } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", run.organization_id)
    .single<{ name: string }>();
  let assistantQuery = supabase
    .from("ai_assistants")
    .select(
      "id, organization_id, name, description, prompt, objective, tone, rules, fallback_message, active, channel_id, auto_reply_enabled, agent_config",
    )
    .eq("organization_id", run.organization_id)
    .eq("active", true)
    .is("archived_at", null)
    .limit(50);
  const shouldAutoRoute = config.auto_route !== false;
  if (config.assistant_id && !shouldAutoRoute)
    assistantQuery = assistantQuery.eq("id", config.assistant_id);
  const { data: assistants } = await assistantQuery.returns<AssistantRow[]>();
  const selection =
    shouldAutoRoute || !config.assistant_id
      ? await selectAssistantForConversation({
          supabase,
          organizationId: run.organization_id,
          conversationId: run.conversation_id,
          assistants: assistants ?? [],
          message: triggerMessage.body,
          channel: triggerMessage.channel,
        })
      : { assistant: assistants?.[0] ?? null, decision: null };
  const assistantRow = selection.assistant;
  if (!assistantRow) return { skipped: true, reason: "assistant_missing" };

  await enforceAIRateLimit(supabase, run.organization_id);
  const aiContext = await buildConversationAIContext({
    supabase,
    organizationId: run.organization_id,
    organizationName: organization?.name ?? "CRM",
    assistant: mapAssistant(assistantRow),
    conversationId: run.conversation_id,
    userInput:
      typeof config.instruction === "string" ? config.instruction : undefined,
  });
  aiContext.availableTools = await loadAvailableAITools(
    supabase,
    run.organization_id,
  );
  const result = await new AIOrchestrator(getAIRuntimeConfig()).generateReply(
    aiContext,
  );
  const assistantConfig = agentConfigSchema.safeParse(
    assistantRow.agent_config,
  );
  const capabilities = assistantConfig.success ? assistantConfig.data : null;
  const routedIntent = selection.decision?.detectedIntent ?? "general";
  let responseBody = result.output;
  let commercialResolution: Record<string, unknown> | null = null;
  if (routedIntent === "price") {
    if (!capabilities?.can_answer_prices) {
      responseBody = assistantRow.fallback_message;
      commercialResolution = {
        status: "blocked",
        reason: "assistant_price_capability_disabled",
      };
    } else {
      const price = await resolveSimplePriceFromConversation({
        organizationId: run.organization_id,
        conversationId: run.conversation_id,
        defaultCurrency: capabilities.default_currency,
        knowledgeCategories: capabilities.quote_knowledge_categories,
      });
      responseBody = price.message;
      commercialResolution = price;
    }
  } else if (routedIntent === "quote") {
    if (!capabilities?.can_create_quotes) {
      responseBody = assistantRow.fallback_message;
      commercialResolution = {
        status: "blocked",
        reason: "assistant_quote_capability_disabled",
      };
    } else {
      const quote = await createQuoteFromConversation({
        organizationId: run.organization_id,
        conversationId: run.conversation_id,
        defaultCurrency: capabilities.default_currency,
        commercialTerms: capabilities.default_commercial_terms,
        knowledgeCategories: capabilities.quote_knowledge_categories,
      });
      commercialResolution = quote;
      if (quote.status === "clarification") responseBody = quote.message;
      else {
        const { data: createdQuote } = await supabase
          .from("quotes")
          .select(
            "quote_number,currency,total,expires_at,commercial_terms,public_token",
          )
          .eq("id", quote.quoteId)
          .eq("organization_id", run.organization_id)
          .single<{
            quote_number: string;
            currency: string;
            total: number;
            expires_at: string | null;
            commercial_terms: string | null;
            public_token: string;
          }>();
        const { data: items } = await supabase
          .from("quote_items")
          .select("name,quantity,unit_price,line_total")
          .eq("quote_id", quote.quoteId)
          .eq("organization_id", run.organization_id)
          .order("position");
        if (createdQuote && items?.length) {
          const baseUrl = getServerEnv().NEXT_PUBLIC_APP_URL?.replace(
            /\/$/,
            "",
          );
          responseBody = formatQuoteMessage(
            createdQuote,
            items,
            capabilities.can_send_quotes && baseUrl
              ? `${baseUrl}/q/${createdQuote.public_token}`
              : undefined,
          );
          commercialResolution = { ...quote, total: createdQuote.total };
        }
      }
    }
  }
  const { data: conversationControl } = await supabase
    .from("conversations")
    .select("id, ai_status, ai_paused, owner_id")
    .eq("id", run.conversation_id)
    .eq("organization_id", run.organization_id)
    .maybeSingle<{
      id: string;
      ai_status: string;
      ai_paused: boolean | null;
      owner_id: string | null;
    }>();
  const latestInbound = [...aiContext.messages]
    .reverse()
    .find((message) => message.direction === "inbound");
  const sensitiveIntent = detectHumanEscalationIntent(
    latestInbound?.body ?? "",
  );
  let autoSendDecision = decideAutoSend({
    ruleAutoSend: rule.auto_send,
    assistantAutoReplyEnabled: assistantRow.auto_reply_enabled,
    conversationAiStatus: conversationControl?.ai_status,
    conversationPaused: conversationControl?.ai_paused,
    knowledgeSufficient: result.knowledgeSufficient,
    sensitiveIntent,
  });
  if (
    autoSendDecision.allowed &&
    routedIntent === "price" &&
    (!capabilities?.can_auto_send_simple_prices ||
      commercialResolution?.status !== "exact")
  ) {
    autoSendDecision = {
      allowed: false,
      reason: "price_auto_send_not_allowed",
    };
  }
  if (autoSendDecision.allowed && routedIntent === "quote") {
    const total =
      typeof commercialResolution?.total === "number"
        ? commercialResolution.total
        : null;
    const maximum = capabilities?.quote_auto_send_max_amount ?? null;
    const amountAllowed =
      total !== null && maximum !== null && total <= maximum;
    if (
      !capabilities?.can_auto_send_full_quotes ||
      capabilities?.quote_requires_human_approval !== false ||
      !amountAllowed
    ) {
      autoSendDecision = {
        allowed: false,
        reason: capabilities?.quote_requires_human_approval
          ? "quote_human_approval_required"
          : "quote_auto_send_not_allowed",
      };
    }
  }
  const { data: aiLog } = await supabase
    .from("ai_logs")
    .insert({
      organization_id: run.organization_id,
      assistant_id: assistantRow.id,
      conversation_id: run.conversation_id,
      provider: "openai",
      model: result.model,
      mode: result.mode,
      input: summarizeAIInput(result.input),
      output: responseBody,
      status: "success",
      metadata: usageMetadata(result.usage, {
        source: "automation_draft",
        rule_id: rule.id,
        run_id: run.id,
        human_confirmation_required: !autoSendDecision.allowed,
        auto_send_decision: autoSendDecision,
        knowledge_sources: result.sources,
        knowledge_sufficient: result.knowledgeSufficient,
        assistant_routing: selection.decision,
        commercial_resolution: commercialResolution,
      }),
    })
    .select("id")
    .single<{ id: string }>();

  const { data: draft, error } = await supabase
    .from("automation_drafts")
    .insert({
      organization_id: run.organization_id,
      rule_id: rule.id,
      run_id: run.id,
      conversation_id: run.conversation_id,
      message_id: run.message_id,
      assistant_id: assistantRow.id,
      body: responseBody,
      status: "pending",
      auto_send_requested: rule.auto_send,
      model: result.model,
      mode: result.mode,
      token_usage: {
        ...usageMetadata(result.usage).usage,
        knowledge_sources: result.sources,
        knowledge_sufficient: result.knowledgeSufficient,
        auto_send_decision: autoSendDecision,
        assistant_routing: selection.decision,
        commercial_resolution: commercialResolution,
      },
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw error;

  let autoSendResult: Record<string, unknown> = {
    attempted: false,
    decision: autoSendDecision,
  };
  if (autoSendDecision.allowed) {
    autoSendResult = await autoSendDraft(
      supabase,
      rule,
      run.organization_id,
      draft.id,
      run.conversation_id,
      responseBody,
      context,
    );
  } else if (
    rule.auto_send &&
    ["human_escalation_required", "knowledge_insufficient"].includes(
      autoSendDecision.reason,
    )
  ) {
    await escalateToHuman(
      supabase,
      run,
      rule,
      autoSendDecision.reason,
      conversationControl?.owner_id ?? context.owner_id ?? null,
    );
  }
  return {
    draft_id: draft.id,
    ai_log_id: aiLog?.id,
    model: result.model,
    mode: result.mode,
    token_usage: usageMetadata(result.usage).usage,
    decision: autoSendDecision,
    auto_send: autoSendResult,
  };
}

async function autoSendDraft(
  supabase: SupabaseClient,
  rule: RuleRow,
  organizationId: string,
  draftId: string,
  conversationId: string,
  body: string,
  context: LoadedContext,
) {
  if (!isWithinWhatsAppWindow(context.last_inbound_at)) {
    await supabase
      .from("automation_drafts")
      .update({
        status: "blocked",
        error_message: "WhatsApp 24-hour window is closed.",
      })
      .eq("id", draftId)
      .eq("organization_id", organizationId);
    return { attempted: true, blocked: true, reason: "whatsapp_window_closed" };
  }
  if (context.message_id) {
    const { count: inboundReplyCount } = await supabase
      .from("automation_drafts")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("message_id", context.message_id)
      .eq("status", "sent")
      .eq("auto_send_requested", true);
    if ((inboundReplyCount ?? 0) > 0) {
      const fallback = autoReplyLimitFallback("inbound_already_replied");
      await supabase
        .from("automation_drafts")
        .update({
          status: fallback.status,
          error_message: fallback.errorMessage,
        })
        .eq("id", draftId)
        .eq("organization_id", organizationId);
      return {
        attempted: false,
        pending: true,
        reason: "inbound_already_replied",
      };
    }
  }
  const since = new Date(
    Date.now() - rule.auto_reply_window_minutes * 60_000,
  ).toISOString();
  const { count } = await supabase
    .from("automation_drafts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("conversation_id", conversationId)
    .eq("status", "sent")
    .eq("auto_send_requested", true)
    .gte("created_at", since);
  const conversationCount = count ?? 0;
  if (conversationCount >= rule.auto_reply_limit) {
    const fallback = autoReplyLimitFallback("conversation_limit");
    await supabase
      .from("automation_drafts")
      .update({
        status: fallback.status,
        error_message: fallback.errorMessage,
      })
      .eq("id", draftId)
      .eq("organization_id", organizationId);
    return { attempted: false, pending: true, reason: "conversation_limit" };
  }
  const hourly = new Date(Date.now() - 60 * 60_000).toISOString();
  const { count: orgCount } = await supabase
    .from("automation_drafts")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "sent")
    .eq("auto_send_requested", true)
    .gte("created_at", hourly);
  const allowance = isAutoReplyAllowed({
    conversationSent: conversationCount,
    organizationSent: orgCount ?? 0,
    conversationLimit: rule.auto_reply_limit,
  });
  if (!allowance.allowed) {
    const reason =
      allowance.reason === "organization_rate_limit"
        ? "organization_rate_limit"
        : "conversation_limit";
    const fallback = autoReplyLimitFallback(reason);
    await supabase
      .from("automation_drafts")
      .update({
        status: fallback.status,
        error_message: fallback.errorMessage,
      })
      .eq("id", draftId)
      .eq("organization_id", organizationId);
    return { attempted: false, pending: true, reason };
  }
  return sendDraft(
    supabase,
    organizationId,
    draftId,
    conversationId,
    body,
    null,
  );
}

async function escalateToHuman(
  supabase: SupabaseClient,
  run: {
    id: string;
    organization_id: string;
    conversation_id: string | null;
    lead_id?: string | null;
  },
  rule: RuleRow,
  reason: string,
  ownerId: string | null,
) {
  if (!run.conversation_id) return;

  const title =
    reason === "knowledge_insufficient"
      ? "Revisar respuesta IA sin suficiente base interna"
      : "Revisar conversacion sensible antes de responder";
  await supabase
    .from("conversations")
    .update({
      ai_status: "human",
      ai_paused: true,
    })
    .eq("id", run.conversation_id)
    .eq("organization_id", run.organization_id);
  await supabase.from("tasks").insert({
    organization_id: run.organization_id,
    lead_id: run.lead_id ?? null,
    conversation_id: run.conversation_id,
    owner_id: ownerId,
    title,
    description: `Automatizacion ${rule.name}: ${reason}`,
    due_at: new Date().toISOString(),
  });
  await supabase.from("internal_notifications").insert({
    organization_id: run.organization_id,
    user_id: ownerId,
    title,
    body: "Se genero un borrador, pero el agente automatico lo dejo para revision humana.",
    entity_table: "conversations",
    entity_id: run.conversation_id,
    metadata: {
      source: "controlled_ai_agent",
      rule_id: rule.id,
      run_id: run.id,
      reason,
    },
  });
  await supabase.from("audit_logs").insert({
    organization_id: run.organization_id,
    action: "automation_ai_escalated_to_human",
    entity_table: "conversations",
    entity_id: run.conversation_id,
    metadata: {
      rule_id: rule.id,
      run_id: run.id,
      reason,
    },
  });
}

export async function sendDraft(
  supabase: SupabaseClient,
  organizationId: string,
  draftId: string,
  conversationId: string,
  body: string,
  approvedBy: string | null,
) {
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, channel, external_contact_id, contacts(phone), leads(phone)")
    .eq("id", conversationId)
    .eq("organization_id", organizationId)
    .single<{
      id: string;
      channel: string;
      external_contact_id: string | null;
      contacts: { phone: string | null } | null;
      leads: { phone: string | null } | null;
    }>();
  if (!conversation || conversation.channel !== "whatsapp") {
    const message = "WhatsApp conversation not found.";
    await markDraftFailed(supabase, organizationId, draftId, message);
    throw new Error(message);
  }
  const recipient =
    conversation.external_contact_id ??
    conversation.contacts?.phone ??
    conversation.leads?.phone;
  if (!recipient) {
    const message = "Recipient phone is missing.";
    await markDraftFailed(supabase, organizationId, draftId, message);
    throw new Error(message);
  }
  const { data: setting } = await supabase
    .from("whatsapp_channel_settings")
    .select("id, phone_number_id, connection_method")
    .eq("organization_id", organizationId)
    .eq("enabled", true)
    .limit(1)
    .maybeSingle<{
      id: string;
      phone_number_id: string;
      connection_method: string;
    }>();
  if (!setting) {
    const message = "WhatsApp channel is not configured.";
    await markDraftFailed(supabase, organizationId, draftId, message);
    throw new Error(message);
  }
  const token = await getWhatsAppAccessToken({
    organizationId,
    channelSettingId: setting.id,
    connectionMethod: setting.connection_method,
  });
  if (!token) {
    const message = "WhatsApp access token is unavailable.";
    await markDraftFailed(supabase, organizationId, draftId, message);
    throw new Error(message);
  }
  const { data: message, error: messageError } = await supabase
    .from("messages")
    .insert({
      organization_id: organizationId,
      conversation_id: conversationId,
      direction: "outbound",
      sender_type: approvedBy ? "user" : "assistant",
      sender_user_id: approvedBy,
      body,
      channel: "whatsapp",
      status: "pending",
      metadata: { automation_draft_id: draftId, auto_send: !approvedBy },
    })
    .select("id")
    .single<{ id: string }>();
  if (messageError) {
    await markDraftFailed(
      supabase,
      organizationId,
      draftId,
      safeError(messageError),
    );
    throw messageError;
  }
  try {
    const response = await new WhatsAppCloudService({
      accessToken: token,
      phoneNumberId: setting.phone_number_id,
      graphApiVersion: getServerEnv().WHATSAPP_GRAPH_API_VERSION,
      appSecret: getServerEnv().WHATSAPP_APP_SECRET,
    }).sendText({ to: recipient, body });
    const externalId = response.messages?.[0]?.id;
    await supabase
      .from("messages")
      .update({
        status: "sent",
        external_message_id: externalId,
        metadata: {
          automation_draft_id: draftId,
          auto_send: !approvedBy,
          whatsapp_response: response,
        },
      })
      .eq("id", message.id)
      .eq("organization_id", organizationId);
    await supabase
      .from("automation_drafts")
      .update({
        status: "sent",
        approved_by: approvedBy,
        approved_at: approvedBy ? new Date().toISOString() : null,
        sent_message_id: message.id,
      })
      .eq("id", draftId)
      .eq("organization_id", organizationId);
    await supabase.from("whatsapp_events").insert({
      organization_id: organizationId,
      direction: "outbound",
      event_type: "text",
      whatsapp_message_id: externalId,
      conversation_id: conversationId,
      message_id: message.id,
      phone_number_id: setting.phone_number_id,
      contact_wa_id: recipient,
      payload: response,
    });
    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      actor_user_id: approvedBy,
      action: approvedBy ? "approve_automation_draft" : "automation_auto_send",
      entity_table: "automation_drafts",
      entity_id: draftId,
      metadata: { conversation_id: conversationId, message_id: message.id },
    });
    return { attempted: true, sent: true, message_id: message.id };
  } catch (error) {
    const messageText = safeWhatsAppError(error);
    await supabase
      .from("messages")
      .update({
        status: "failed",
        metadata: { automation_draft_id: draftId, error: messageText },
      })
      .eq("id", message.id)
      .eq("organization_id", organizationId);
    await supabase
      .from("automation_drafts")
      .update({
        status: "failed",
        error_message: messageText,
        sent_message_id: message.id,
      })
      .eq("id", draftId)
      .eq("organization_id", organizationId);
    await supabase.from("whatsapp_events").insert({
      organization_id: organizationId,
      direction: "error",
      event_type: "send_failed",
      conversation_id: conversationId,
      message_id: message.id,
      phone_number_id: setting.phone_number_id,
      contact_wa_id: recipient,
      payload: safeWhatsAppPayload(error),
      error_message: messageText,
    });
    throw error;
  }
}

async function markDraftFailed(
  supabase: SupabaseClient,
  organizationId: string,
  draftId: string,
  errorMessage: string,
) {
  await supabase
    .from("automation_drafts")
    .update({
      status: "failed",
      error_message: errorMessage,
    })
    .eq("id", draftId)
    .eq("organization_id", organizationId);
}

async function extractVariable(
  supabase: SupabaseClient,
  run: {
    organization_id: string;
    conversation_id: string | null;
    lead_id: string | null;
  },
  config: Record<string, unknown>,
) {
  if (!run.conversation_id)
    return { skipped: true, reason: "conversation_missing" };
  let query = supabase
    .from("variables")
    .select(
      "id, organization_id, name, key, description, type, extraction_prompt, active, required, options",
    )
    .eq("organization_id", run.organization_id)
    .eq("active", true)
    .is("archived_at", null);
  if (config.variable_id) query = query.eq("id", config.variable_id);
  const { data: rows } = await query.returns<VariableRow[]>();
  const variables = (rows ?? []).map(mapVariable);
  if (!variables.length) return { skipped: true, reason: "variables_missing" };
  const { context } = await buildConversationVariableContext({
    supabase,
    organizationId: run.organization_id,
    conversationId: run.conversation_id,
  });
  await enforceAIRateLimit(supabase, run.organization_id);
  const extraction = await new VariableExtractor(getAIRuntimeConfig()).extract(
    variables,
    context,
  );
  let count = 0;
  for (const result of extraction.results) {
    if (!result.extracted) continue;
    const payload = {
      organization_id: run.organization_id,
      variable_id: result.variableId,
      value: result.value,
      confidence: result.confidence,
      source_message_id: result.sourceMessageId,
      extracted_at: new Date().toISOString(),
    };
    await supabase.from("conversation_variables").upsert(
      {
        ...payload,
        conversation_id: run.conversation_id,
      },
      { onConflict: "conversation_id,variable_id" },
    );
    if (run.lead_id) {
      await supabase.from("lead_variables").upsert(
        {
          ...payload,
          lead_id: run.lead_id,
        },
        { onConflict: "lead_id,variable_id" },
      );
    }
    count += 1;
  }
  return {
    extracted: count,
    model: extraction.model,
    mode: extraction.mode,
    token_usage: usageMetadata(extraction.usage).usage,
  };
}

async function updateVariable(
  supabase: SupabaseClient,
  run: {
    organization_id: string;
    conversation_id: string | null;
    lead_id: string | null;
  },
  config: Record<string, unknown>,
) {
  const variableId = stringConfig(config.variable_id, "variable_id");
  const payload = {
    organization_id: run.organization_id,
    variable_id: variableId,
    value: config.value ?? null,
    confidence: Number(config.confidence ?? 1),
    extracted_at: new Date().toISOString(),
  };
  if (run.conversation_id)
    await supabase.from("conversation_variables").upsert(
      {
        ...payload,
        conversation_id: run.conversation_id,
      },
      { onConflict: "conversation_id,variable_id" },
    );
  if (run.lead_id)
    await supabase.from("lead_variables").upsert(
      {
        ...payload,
        lead_id: run.lead_id,
      },
      { onConflict: "lead_id,variable_id" },
    );
  return { variable_id: variableId, updated: true };
}

async function loadContext(
  supabase: SupabaseClient,
  event: EventInput,
): Promise<LoadedContext> {
  let channel: string | null = null;
  let leadId = event.leadId ?? null;
  let contactId = event.contactId ?? null;
  let ownerId = event.ownerId ?? null;
  let leadStatus: string | null = null;
  let lastInboundAt: string | null = null;
  let aiStatus: string | null = null;
  let aiPaused: boolean | null = null;
  if (event.conversationId) {
    const { data: conversation } = await supabase
      .from("conversations")
      .select("channel, lead_id, contact_id, owner_id, ai_status, ai_paused")
      .eq("id", event.conversationId)
      .eq("organization_id", event.organizationId)
      .single<{
        channel: string;
        lead_id: string | null;
        contact_id: string | null;
        owner_id: string | null;
        ai_status: string | null;
        ai_paused: boolean | null;
      }>();
    channel = conversation?.channel ?? null;
    leadId = leadId ?? conversation?.lead_id ?? null;
    contactId = contactId ?? conversation?.contact_id ?? null;
    ownerId = ownerId ?? conversation?.owner_id ?? null;
    aiStatus = conversation?.ai_status ?? null;
    aiPaused = conversation?.ai_paused ?? null;
    const { data: inbound } = await supabase
      .from("messages")
      .select("created_at")
      .eq("organization_id", event.organizationId)
      .eq("conversation_id", event.conversationId)
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ created_at: string }>();
    lastInboundAt = inbound?.created_at ?? null;
  }
  if (leadId) {
    const { data: lead } = await supabase
      .from("leads")
      .select("status, owner_id")
      .eq("id", leadId)
      .eq("organization_id", event.organizationId)
      .maybeSingle<{ status: string; owner_id: string | null }>();
    leadStatus = lead?.status ?? null;
    ownerId = ownerId ?? lead?.owner_id ?? null;
  }
  return {
    organization_id: event.organizationId,
    conversation_id: event.conversationId,
    lead_id: leadId,
    contact_id: contactId,
    message_id: event.messageId,
    owner_id: ownerId,
    channel,
    ai_status: aiStatus,
    ai_paused: aiPaused,
    lead_status: leadStatus,
    smart_tag_id: event.smartTagId,
    variable_id: event.variableId,
    last_inbound_at: lastInboundAt,
  };
}

async function loadRule(
  supabase: SupabaseClient,
  organizationId: string,
  ruleId: string,
) {
  const { data } = await supabase
    .from("automation_rules")
    .select(
      "id, organization_id, name, trigger_type, status, conditions, trigger_config, auto_send, auto_reply_limit, auto_reply_window_minutes",
    )
    .eq("id", ruleId)
    .eq("organization_id", organizationId)
    .single<RuleRow>();
  if (!data) throw new Error("Automation rule not found.");
  return data;
}

async function finish(
  supabase: SupabaseClient,
  run: { id: string; organization_id: string },
  status: "completed" | "cancelled",
  result: Record<string, unknown>,
) {
  await supabase
    .from("automation_runs")
    .update({
      status,
      result,
      completed_at: new Date().toISOString(),
    })
    .eq("id", run.id)
    .eq("organization_id", run.organization_id);
}

function stringConfig(value: unknown, name: string) {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${name} is required.`);
  return value;
}

function sanitizeRecord(value: Record<string, unknown>) {
  const serialized = JSON.stringify(value);
  return serialized.length > 4_000
    ? { summary: `${serialized.slice(0, 3_900)}...`, truncated: true }
    : (JSON.parse(serialized) as Record<string, unknown>);
}

function safeError(error: unknown) {
  return (
    error instanceof Error ? error.message : "Automation action failed"
  ).slice(0, 500);
}

function safeWhatsAppError(error: unknown) {
  if (error instanceof WhatsAppCloudError) {
    const graphMessage = graphErrorMessage(error.payload);
    return graphMessage
      ? `WhatsApp Cloud API request failed (${error.status}): ${graphMessage}`.slice(
          0,
          500,
        )
      : `WhatsApp Cloud API request failed (${error.status}).`;
  }

  return safeError(error);
}

function safeWhatsAppPayload(error: unknown) {
  if (!(error instanceof WhatsAppCloudError)) return {};

  const payload = error.payload as {
    error?: {
      message?: string;
      type?: string;
      code?: number;
      error_subcode?: number;
    };
  };
  return {
    status: error.status,
    error: payload.error
      ? {
          message: payload.error.message,
          type: payload.error.type,
          code: payload.error.code,
          error_subcode: payload.error.error_subcode,
        }
      : undefined,
  };
}

function graphErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("error" in payload))
    return null;
  const error = (payload as { error?: { message?: unknown } }).error;
  return typeof error?.message === "string" ? error.message : null;
}
