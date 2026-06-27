"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assistantFormSchema, assistantTestSchema } from "@crm-pro-ai/ai/assistant";
import {
  agentConfigSchema,
  agentPlaybooksSchema,
  buildAgentRuntime,
  linesToList
} from "@crm-pro-ai/ai/agent-config";
import { AIOrchestrator } from "@crm-pro-ai/ai/orchestrator";
import { requireUser } from "@/lib/auth";
import { actionErrorCode } from "@/lib/action-errors";
import { buildConversationAIContext, mapAssistant, type AssistantRow } from "@/lib/ai/context";
import { enforceAIRateLimit, getAIRuntimeConfig, summarizeAIInput, usageMetadata } from "@/lib/ai/runtime";
import { loadAvailableAITools } from "@/lib/ai/tools";
import { getActiveOrganization } from "@/lib/organization";

const assistantIdSchema = z.object({
  id: z.string().uuid()
});

function value(formData: FormData, key: string) {
  const formValue = formData.get(key);
  return typeof formValue === "string" ? formValue : "";
}

function assistantPayload(formData: FormData) {
  const agentConfig = agentConfigSchema.parse({
    agent_name: value(formData, "agent_name"),
    role: value(formData, "role"),
    industry: value(formData, "industry"),
    business_description: value(formData, "business_description"),
    sells: value(formData, "sells"),
    services: value(formData, "services"),
    products: value(formData, "products"),
    primary_goal: value(formData, "primary_goal"),
    formality: value(formData, "formality"),
    response_length: value(formData, "response_length"),
    emoji_usage: value(formData, "emoji_usage"),
    commercial_pace: value(formData, "commercial_pace"),
    communication_style: value(formData, "communication_style"),
    always_ask: linesToList(value(formData, "always_ask")),
    never_invent: linesToList(value(formData, "never_invent")),
    human_topics: linesToList(value(formData, "human_topics")),
    create_task_when: linesToList(value(formData, "create_task_when")),
    create_opportunity_when: linesToList(value(formData, "create_opportunity_when")),
    create_appointment_when: linesToList(value(formData, "create_appointment_when")),
    pause_ai_when: linesToList(value(formData, "pause_ai_when")),
    auto_reply_when: linesToList(value(formData, "auto_reply_when")),
    draft_only_when: linesToList(value(formData, "draft_only_when")),
    knowledge_topics: linesToList(value(formData, "knowledge_topics"))
  });
  const playbooks = agentPlaybooksSchema.parse(
    [
      ["first_contact", "Primer contacto"],
      ["follow_up", "Seguimiento"],
      ["sales", "Ventas"],
      ["support", "Soporte"],
      ["collections", "Cobranza"],
      ["scheduling", "Agenda"],
      ["reservations", "Reservas"],
      ["quote", "Presupuesto"],
      ["after_sales", "Postventa"]
    ].map(([key, name]) => ({
      key,
      name,
      instructions: value(formData, `playbook_${key}`),
      enabled: formData.get(`playbook_${key}_enabled`) === "on"
    })).filter((playbook) => playbook.instructions || playbook.enabled),
  );
  const generated = buildAgentRuntime(agentConfig, playbooks);
  return {
    name: agentConfig.agent_name,
    description: agentConfig.business_description || null,
    prompt: generated.prompt,
    objective: generated.objective,
    tone: generated.tone,
    rules: generated.rules.join("\n") || "No inventar datos del negocio.",
    fallback_message: value(formData, "fallback_message"),
    active: formData.get("active") === "on",
    channel_id: value(formData, "channel_id") || null,
    auto_reply_enabled: formData.get("auto_reply_enabled") === "on",
    agent_config: agentConfig,
    playbooks
  };
}

export async function createAssistant(formData: FormData) {
  let payload: ReturnType<typeof assistantPayload>;
  try {
    payload = assistantPayload(formData);
  } catch {
    redirect("/assistants/new?error=invalid");
  }
  const { agent_config, playbooks, ...runtimePayload } = payload;
  const parsed = assistantFormSchema.safeParse(runtimePayload);
  if (!parsed.success) redirect("/assistants/new?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data, error } = await supabase
    .from("ai_assistants")
    .insert({
      ...parsed.data,
      agent_config,
      playbooks,
      organization_id: organization.id,
      rules: parsed.data.rules ? parsed.data.rules.split("\n").filter(Boolean) : [],
      enabled: parsed.data.active
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) redirect(`/assistants/new?error=${actionErrorCode(error)}`);

  await writeAudit(supabase, user.id, organization.id, "create_assistant", data.id);
  revalidatePath("/assistants");
  redirect(`/assistants/${data.id}`);
}

export async function updateAssistant(formData: FormData) {
  const id = value(formData, "id");
  const parsedId = assistantIdSchema.safeParse({ id });
  let payload: ReturnType<typeof assistantPayload>;
  try {
    payload = assistantPayload(formData);
  } catch {
    redirect(`/assistants/${id}/edit?error=invalid`);
  }
  const { agent_config, playbooks, ...runtimePayload } = payload;
  const parsed = assistantFormSchema.safeParse(runtimePayload);
  if (!parsed.success || !parsedId.success) redirect(`/assistants/${id}/edit?error=invalid`);

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: updated, error } = await supabase
    .from("ai_assistants")
    .update({
      ...parsed.data,
      agent_config,
      playbooks,
      rules: parsed.data.rules ? parsed.data.rules.split("\n").filter(Boolean) : [],
      enabled: parsed.data.active
    })
    .eq("id", id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) redirect(`/assistants/${id}/edit?error=${actionErrorCode(error)}`);
  if (!updated) redirect(`/assistants/${id}/edit?error=not-found`);

  await writeAudit(supabase, user.id, organization.id, "update_assistant", id);
  revalidatePath("/assistants");
  revalidatePath(`/assistants/${id}`);
  redirect(`/assistants/${id}`);
}

export async function runAssistantTest(formData: FormData) {
  const parsed = assistantTestSchema.safeParse({
    assistant_id: value(formData, "assistant_id"),
    conversation_id: value(formData, "conversation_id") || null,
    input: value(formData, "input")
  });
  if (!parsed.success) redirect(`/assistants?error=invalid-test`);

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: assistantRow } = await supabase
    .from("ai_assistants")
    .select("id, organization_id, name, description, prompt, objective, tone, rules, fallback_message, active, channel_id, auto_reply_enabled")
    .eq("id", parsed.data.assistant_id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .single<AssistantRow>();

  if (!assistantRow) redirect(`/assistants/${parsed.data.assistant_id}?error=missing`);

  const runtime = getAIRuntimeConfig();
  const assistant = mapAssistant(assistantRow);
  const context = await buildConversationAIContext({
    supabase,
    organizationId: organization.id,
    organizationName: organization.name,
    assistant,
    conversationId: parsed.data.conversation_id,
    userInput: parsed.data.input
  });
  context.availableTools = await loadAvailableAITools(supabase, organization.id);
  const orchestrator = new AIOrchestrator({
    ...runtime
  });

  let testId = "";
  try {
    await enforceAIRateLimit(supabase, organization.id);
    const result = await orchestrator.generateReply(context);
    await supabase.from("ai_logs").insert({
      organization_id: organization.id,
      assistant_id: parsed.data.assistant_id,
      conversation_id: parsed.data.conversation_id,
      provider: "openai",
      model: result.model,
      mode: result.mode,
      input: summarizeAIInput(result.input),
      output: result.output,
      status: "success",
      metadata: usageMetadata(result.usage, {
        source: "assistant_test",
        response_id: result.responseId,
        context_summary: summarizeAIInput(result.input),
        knowledge_sources: result.sources,
        knowledge_sufficient: result.knowledgeSufficient
      })
    });
    const { data: test } = await supabase
      .from("ai_assistant_tests")
      .insert({
        organization_id: organization.id,
        assistant_id: parsed.data.assistant_id,
        conversation_id: parsed.data.conversation_id,
        input: parsed.data.input,
        output: result.output,
        status: "success",
        metadata: usageMetadata(result.usage, {
          mode: result.mode,
          model: result.model,
          knowledge_sources: result.sources,
          knowledge_sufficient: result.knowledgeSufficient
        })
      })
      .select("id")
      .single<{ id: string }>();
    testId = test?.id ?? "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI generation failed";
    await supabase.from("ai_logs").insert({
      organization_id: organization.id,
      assistant_id: parsed.data.assistant_id,
      conversation_id: parsed.data.conversation_id,
      provider: "openai",
      model: runtime.model,
      mode: runtime.demoMode ? "demo" : "openai",
      input: { input: parsed.data.input },
      status: "error",
      error_message: message
    });

    redirect(`/assistants/${parsed.data.assistant_id}?error=ai`);
  }
  redirect(`/assistants/${parsed.data.assistant_id}?test=${testId}`);
}

export async function suggestConversationReply(formData: FormData) {
  const parsed = z
    .object({
      conversation_id: z.string().uuid(),
      assistant_id: z.string().uuid().optional().nullable()
    })
    .safeParse({
      conversation_id: value(formData, "conversation_id"),
      assistant_id: value(formData, "assistant_id") || null
    });
  if (!parsed.success) redirect("/inbox?error=invalid-ai");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  let assistantQuery = supabase
    .from("ai_assistants")
    .select("id, organization_id, name, description, prompt, objective, tone, rules, fallback_message, active, channel_id, auto_reply_enabled")
    .eq("organization_id", organization.id)
    .eq("active", true)
    .is("archived_at", null)
    .limit(1);

  if (parsed.data.assistant_id) {
    assistantQuery = assistantQuery.eq("id", parsed.data.assistant_id);
  }

  const { data: assistants } = await assistantQuery.returns<AssistantRow[]>();
  const assistantRow = assistants?.[0];
  if (!assistantRow) redirect(`/inbox?conversation=${parsed.data.conversation_id}&error=no-assistant`);

  const runtime = getAIRuntimeConfig();
  const assistant = mapAssistant(assistantRow);
  const context = await buildConversationAIContext({
    supabase,
    organizationId: organization.id,
    organizationName: organization.name,
    assistant,
    conversationId: parsed.data.conversation_id
  });
  context.availableTools = await loadAvailableAITools(supabase, organization.id);
  const orchestrator = new AIOrchestrator({
    ...runtime
  });

  let aiLogId = "";
  try {
    await enforceAIRateLimit(supabase, organization.id);
    const result = await orchestrator.generateReply(context);
    const { data: log } = await supabase
      .from("ai_logs")
      .insert({
        organization_id: organization.id,
        assistant_id: assistantRow.id,
        conversation_id: parsed.data.conversation_id,
        provider: "openai",
        model: result.model,
        mode: result.mode,
      input: summarizeAIInput(result.input),
        output: result.output,
        status: "success",
        metadata: usageMetadata(result.usage, {
          source: "inbox_suggestion",
          response_id: result.responseId,
          context_summary: summarizeAIInput(result.input),
          human_confirmation_required: true,
          knowledge_sources: result.sources,
          knowledge_sufficient: result.knowledgeSufficient
        })
      })
      .select("id")
      .single<{ id: string }>();

    aiLogId = log?.id ?? "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI suggestion failed";
    await supabase.from("ai_logs").insert({
      organization_id: organization.id,
      assistant_id: assistantRow.id,
      conversation_id: parsed.data.conversation_id,
      provider: "openai",
      model: runtime.model,
      mode: runtime.demoMode ? "demo" : "openai",
      input: summarizeAIInput({ context: context.userInput ?? "conversation" }),
      status: "error",
      error_message: message,
      metadata: { source: "inbox_suggestion", human_confirmation_required: true }
    });
    redirect(`/inbox?conversation=${parsed.data.conversation_id}&error=ai-suggestion`);
  }
  revalidatePath("/inbox");
  redirect(`/inbox?conversation=${parsed.data.conversation_id}&ai_log=${aiLogId}`);
}

export async function archiveAssistant(formData: FormData) {
  const parsed = assistantIdSchema.safeParse({ id: value(formData, "id") });
  if (!parsed.success) redirect("/assistants?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data, error } = await supabase
    .from("ai_assistants")
    .update({ archived_at: new Date().toISOString(), active: false, enabled: false })
    .eq("id", parsed.data.id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) redirect(`/assistants?error=${actionErrorCode(error)}`);
  if (!data) redirect("/assistants?error=not-found");

  await writeAudit(supabase, user.id, organization.id, "archive_assistant", parsed.data.id);
  revalidatePath("/assistants");
  redirect("/assistants?success=archived");
}

async function writeAudit(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  userId: string,
  organizationId: string,
  action: string,
  entityId: string,
) {
  await supabase.from("audit_logs").insert({
    organization_id: organizationId,
    actor_user_id: userId,
    action,
    entity_table: "ai_assistants",
    entity_id: entityId
  });
}
