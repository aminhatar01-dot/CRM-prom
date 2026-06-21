"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { SmartTagClassifier } from "@crm-pro-ai/ai/smart-tag-classifier";
import {
  smartTagAssignmentSchema,
  smartTagSchema,
  smartTagUpdateSchema
} from "@crm-pro-ai/ai/smart-tags";
import { requireUser } from "@/lib/auth";
import { actionErrorCode } from "@/lib/action-errors";
import { enforceAIRateLimit, getAIRuntimeConfig, summarizeAIInput, usageMetadata } from "@/lib/ai/runtime";
import { getActiveOrganization } from "@/lib/organization";
import {
  buildSmartTagConversationContext,
  mapSmartTag,
  type TagRow
} from "@/lib/ai/smart-tag-context";

function value(formData: FormData, key: string) {
  const formValue = formData.get(key);
  return typeof formValue === "string" ? formValue : "";
}

function smartTagPayload(formData: FormData) {
  return {
    name: value(formData, "name"),
    color: value(formData, "color") || "#0f766e",
    description: value(formData, "description") || null,
    classification_prompt: value(formData, "classification_prompt"),
    active: formData.get("active") === "on",
    auto_pause_assistant: formData.get("auto_pause_assistant") === "on",
    notify_team: formData.get("notify_team") === "on"
  };
}

export async function createSmartTag(formData: FormData) {
  const parsed = smartTagSchema.safeParse(smartTagPayload(formData));
  if (!parsed.success) redirect("/smart-tags/new?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data, error } = await supabase
    .from("tags")
    .insert({
      ...parsed.data,
      organization_id: organization.id,
      is_ai_generated: false
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) redirect(`/smart-tags/new?error=${actionErrorCode(error)}`);

  await audit("create_smart_tag", "tags", data.id, organization.id);
  revalidatePath("/smart-tags");
  redirect(`/smart-tags/${data.id}`);
}

export async function updateSmartTag(formData: FormData) {
  const parsed = smartTagUpdateSchema.safeParse({
    id: value(formData, "id"),
    ...smartTagPayload(formData)
  });
  if (!parsed.success) redirect(`/smart-tags/${value(formData, "id")}/edit?error=invalid`);

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { id, ...payload } = parsed.data;
  const { data: updated, error } = await supabase
    .from("tags")
    .update(payload)
    .eq("id", id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) redirect(`/smart-tags/${id}/edit?error=${actionErrorCode(error)}`);
  if (!updated) redirect(`/smart-tags/${id}/edit?error=not-found`);

  await audit("update_smart_tag", "tags", id, organization.id);
  revalidatePath("/smart-tags");
  revalidatePath(`/smart-tags/${id}`);
  redirect(`/smart-tags/${id}`);
}

export async function assignSmartTag(formData: FormData) {
  const parsed = smartTagAssignmentSchema.safeParse({
    tag_id: value(formData, "tag_id"),
    lead_id: value(formData, "lead_id") || null,
    conversation_id: value(formData, "conversation_id") || null
  });
  const returnTo = value(formData, "return_to") || "/smart-tags";
  if (!parsed.success) redirect(`${returnTo}?error=invalid-tag-assignment`);

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);

  if (parsed.data.lead_id) {
    await supabase.from("lead_tags").upsert(
      {
        organization_id: organization.id,
        lead_id: parsed.data.lead_id,
        tag_id: parsed.data.tag_id
      },
      { onConflict: "lead_id,tag_id" },
    );
  }

  if (parsed.data.conversation_id) {
    await supabase.from("conversation_smart_tags").upsert(
      {
        organization_id: organization.id,
        conversation_id: parsed.data.conversation_id,
        tag_id: parsed.data.tag_id,
        assigned_by: user.id,
        assignment_source: "manual"
      },
      { onConflict: "conversation_id,tag_id" },
    );
  }

  await audit("assign_smart_tag", "tags", parsed.data.tag_id, organization.id, {
    lead_id: parsed.data.lead_id,
    conversation_id: parsed.data.conversation_id
  });
  revalidatePath(returnTo);
  redirect(returnTo);
}

export async function analyzeConversationSmartTags(formData: FormData) {
  const conversationId = value(formData, "conversation_id");
  if (!conversationId) redirect("/inbox?error=invalid-smart-tag-analysis");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: tagRows } = await supabase
    .from("tags")
    .select("id, organization_id, name, color, description, classification_prompt, active, auto_pause_assistant, notify_team")
    .eq("organization_id", organization.id)
    .eq("active", true)
    .is("archived_at", null)
    .returns<TagRow[]>();

  const tags = (tagRows ?? []).map(mapSmartTag);
  if (tags.length === 0) redirect(`/inbox?conversation=${conversationId}&error=no-smart-tags`);
  const { context, leadId } = await buildSmartTagConversationContext({
    supabase,
    organizationId: organization.id,
    conversationId
  });
  const runtime = getAIRuntimeConfig();
  const classifier = new SmartTagClassifier(runtime);
  let classification;
  try {
    await enforceAIRateLimit(supabase, organization.id);
    classification = await classifier.classify(tags, context);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Smart Tag classification failed";
    await supabase.from("ai_logs").insert({
      organization_id: organization.id,
      conversation_id: conversationId,
      provider: "openai",
      model: runtime.model,
      mode: runtime.demoMode ? "demo" : "openai",
      input: { source: "smart_tag_classification" },
      status: "error",
      error_message: message
    });
    redirect(`/inbox?conversation=${conversationId}&error=ai-tags`);
  }
  const { data: aiLog } = await supabase
    .from("ai_logs")
    .insert({
      organization_id: organization.id,
      conversation_id: conversationId,
      provider: "openai",
      model: classification.model,
      mode: classification.mode,
      input: summarizeAIInput(classification.input),
      output: JSON.stringify(classification.results),
      status: "success",
      metadata: usageMetadata(classification.usage, {
        source: "smart_tag_classification",
        response_id: classification.responseId
      })
    })
    .select("id")
    .single<{ id: string }>();
  let matchedCount = 0;
  let paused = false;

  for (const result of classification.results) {
    const tag = tags.find((item) => item.id === result.tagId);
    if (!tag) continue;

    const { data: log } = await supabase
      .from("smart_tag_classification_logs")
      .insert({
        organization_id: organization.id,
        conversation_id: conversationId,
        lead_id: leadId,
        tag_id: tag.id,
        ai_log_id: aiLog?.id,
        mode: classification.mode,
        matched: result.matched,
        confidence: result.confidence,
        reason: result.reason,
        input: classification.input,
        output: result
      })
      .select("id")
      .single<{ id: string }>();

    if (result.matched) {
      matchedCount += 1;
      await supabase.from("conversation_smart_tags").upsert(
        {
          organization_id: organization.id,
          conversation_id: conversationId,
          tag_id: tag.id,
          assigned_by: user.id,
          assignment_source: classification.mode === "demo" ? "ai_demo" : "ai_openai"
        },
        { onConflict: "conversation_id,tag_id" },
      );

      if (leadId) {
        await supabase.from("lead_tags").upsert(
          {
            organization_id: organization.id,
            lead_id: leadId,
            tag_id: tag.id
          },
          { onConflict: "lead_id,tag_id" },
        );
      }

      if (tag.auto_pause_assistant && !paused) {
        await supabase
          .from("conversations")
          .update({ ai_status: "paused", ai_paused: true })
          .eq("organization_id", organization.id)
          .eq("id", conversationId);
        paused = true;
      }
    }

    await audit("classify_smart_tag", "smart_tag_classification_logs", log?.id, organization.id, {
      tag_id: tag.id,
      matched: result.matched
    });
  }

  revalidatePath("/inbox");
  redirect(`/inbox?conversation=${conversationId}&tags=${matchedCount}&paused=${paused ? "1" : "0"}`);
}

export async function archiveSmartTag(formData: FormData) {
  const id = value(formData, "id");
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) redirect("/smart-tags?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data, error } = await supabase
    .from("tags")
    .update({ archived_at: new Date().toISOString(), active: false })
    .eq("id", id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) redirect(`/smart-tags?error=${actionErrorCode(error)}`);
  if (!data) redirect("/smart-tags?error=not-found");

  await audit("archive_smart_tag", "tags", id, organization.id);
  revalidatePath("/smart-tags");
  redirect("/smart-tags?success=archived");
}

async function audit(
  action: string,
  entityTable: string,
  entityId: string | undefined,
  organizationId: string,
  metadata: Record<string, unknown> = {},
) {
  const { supabase, user } = await requireUser();
  await supabase.from("audit_logs").insert({
    organization_id: organizationId,
    actor_user_id: user.id,
    action,
    entity_table: entityTable,
    entity_id: entityId,
    metadata
  });
}
