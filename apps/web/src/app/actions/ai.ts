"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { assistantFormSchema, assistantTestSchema } from "@crm-pro-ai/ai/assistant";
import { AIOrchestrator } from "@crm-pro-ai/ai/orchestrator";
import { requireUser } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { buildConversationAIContext, mapAssistant, type AssistantRow } from "@/lib/ai/context";
import { getActiveOrganization } from "@/lib/organization";

const assistantIdSchema = z.object({
  id: z.string().uuid()
});

function value(formData: FormData, key: string) {
  const formValue = formData.get(key);
  return typeof formValue === "string" ? formValue : "";
}

function assistantPayload(formData: FormData) {
  return {
    name: value(formData, "name"),
    description: value(formData, "description") || null,
    prompt: value(formData, "prompt"),
    objective: value(formData, "objective") || null,
    tone: value(formData, "tone"),
    rules: value(formData, "rules") || null,
    fallback_message: value(formData, "fallback_message"),
    active: formData.get("active") === "on",
    channel_id: value(formData, "channel_id") || null,
    auto_reply_enabled: false
  };
}

export async function createAssistant(formData: FormData) {
  const parsed = assistantFormSchema.safeParse(assistantPayload(formData));
  if (!parsed.success) redirect("/assistants/new?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data, error } = await supabase
    .from("ai_assistants")
    .insert({
      ...parsed.data,
      organization_id: organization.id,
      rules: parsed.data.rules ? parsed.data.rules.split("\n").filter(Boolean) : [],
      enabled: parsed.data.active
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) redirect("/assistants/new?error=create");

  revalidatePath("/assistants");
  redirect(`/assistants/${data.id}`);
}

export async function updateAssistant(formData: FormData) {
  const id = value(formData, "id");
  const parsedId = assistantIdSchema.safeParse({ id });
  const parsed = assistantFormSchema.safeParse(assistantPayload(formData));
  if (!parsed.success || !parsedId.success) redirect(`/assistants/${id}/edit?error=invalid`);

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { error } = await supabase
    .from("ai_assistants")
    .update({
      ...parsed.data,
      rules: parsed.data.rules ? parsed.data.rules.split("\n").filter(Boolean) : [],
      enabled: parsed.data.active
    })
    .eq("id", id)
    .eq("organization_id", organization.id);

  if (error) redirect(`/assistants/${id}/edit?error=update`);

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
    .single<AssistantRow>();

  if (!assistantRow) redirect(`/assistants/${parsed.data.assistant_id}?error=missing`);

  const env = getServerEnv();
  const assistant = mapAssistant(assistantRow);
  const context = await buildConversationAIContext({
    supabase,
    organizationId: organization.id,
    organizationName: organization.name,
    assistant,
    conversationId: parsed.data.conversation_id,
    userInput: parsed.data.input
  });
  const orchestrator = new AIOrchestrator({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    demoMode: env.AI_DEMO_MODE
  });

  try {
    const result = await orchestrator.generateReply(context);
    await supabase.from("ai_logs").insert({
      organization_id: organization.id,
      assistant_id: parsed.data.assistant_id,
      conversation_id: parsed.data.conversation_id,
      provider: "openai",
      model: result.model,
      mode: result.mode,
      input: result.input,
      output: result.output,
      status: "success"
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
        metadata: { mode: result.mode, model: result.model }
      })
      .select("id")
      .single<{ id: string }>();

    redirect(`/assistants/${parsed.data.assistant_id}?test=${test?.id ?? ""}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI generation failed";
    await supabase.from("ai_logs").insert({
      organization_id: organization.id,
      assistant_id: parsed.data.assistant_id,
      conversation_id: parsed.data.conversation_id,
      provider: "openai",
      model: env.OPENAI_MODEL,
      mode: env.OPENAI_API_KEY ? "openai" : "demo",
      input: { input: parsed.data.input },
      status: "error",
      error_message: message
    });

    redirect(`/assistants/${parsed.data.assistant_id}?error=ai`);
  }
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
    .limit(1);

  if (parsed.data.assistant_id) {
    assistantQuery = assistantQuery.eq("id", parsed.data.assistant_id);
  }

  const { data: assistants } = await assistantQuery.returns<AssistantRow[]>();
  const assistantRow = assistants?.[0];
  if (!assistantRow) redirect(`/inbox?conversation=${parsed.data.conversation_id}&error=no-assistant`);

  const env = getServerEnv();
  const assistant = mapAssistant(assistantRow);
  const context = await buildConversationAIContext({
    supabase,
    organizationId: organization.id,
    organizationName: organization.name,
    assistant,
    conversationId: parsed.data.conversation_id
  });
  const orchestrator = new AIOrchestrator({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_MODEL,
    demoMode: env.AI_DEMO_MODE
  });

  try {
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
        input: result.input,
        output: result.output,
        status: "success",
        metadata: { source: "inbox_suggestion" }
      })
      .select("id")
      .single<{ id: string }>();

    revalidatePath("/inbox");
    redirect(`/inbox?conversation=${parsed.data.conversation_id}&ai_log=${log?.id ?? ""}`);
  } catch {
    redirect(`/inbox?conversation=${parsed.data.conversation_id}&error=ai-suggestion`);
  }
}
