"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  automationActionSchema,
  automationRuleSchema,
  automationTriggerTypes,
  taskSchema
} from "@crm-pro-ai/automation/rules";
import { executeAutomationRun, type SupabaseLike } from "@/lib/automation/runner";
import { executeRealAutomationRun, sendDraft } from "@/lib/automation/real-engine";
import { actionErrorCode, addQueryParam } from "@/lib/action-errors";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

function value(formData: FormData, key: string) {
  const formValue = formData.get(key);
  return typeof formValue === "string" ? formValue : "";
}

function parseJson(valueToParse: string, fallback: unknown) {
  try {
    return JSON.parse(valueToParse);
  } catch {
    return fallback;
  }
}

function automationPayload(formData: FormData, organizationId: string) {
  const channel = value(formData, "condition_channel");
  const leadStatus = value(formData, "condition_lead_status");
  const parsedConditions = parseJson(value(formData, "conditions"), {}) as Record<string, unknown>;
  const quickAction = value(formData, "quick_action_type");
  const quickValue = value(formData, "quick_action_value");
  const actions = quickAction
    ? [{
        type: quickAction,
        enabled: true,
        config: quickActionConfig(quickAction, quickValue)
      }]
    : parseJson(value(formData, "actions_json"), []);
  return {
    organization_id: organizationId,
    name: value(formData, "name"),
    description: value(formData, "description") || null,
    trigger_type: value(formData, "trigger_type"),
    status: value(formData, "status") || "draft",
    auto_send: formData.get("auto_send") === "on",
    auto_reply_limit: Number(value(formData, "auto_reply_limit") || 5),
    auto_reply_window_minutes: Number(value(formData, "auto_reply_window_minutes") || 30),
    trigger_config: parseJson(value(formData, "trigger_config"), {}),
    conditions: {
      ...parsedConditions,
      ...(channel ? { channel } : {}),
      ...(leadStatus ? { lead_status: leadStatus } : {})
    },
    actions
  };
}

function quickActionConfig(action: string, valueToUse: string) {
  if (action === "create_task") return { title: valueToUse || "Seguimiento automatico" };
  if (action === "generate_ai_draft" || action === "send_message") {
    return { instruction: valueToUse || "Redactar el siguiente paso comercial." };
  }
  if (action === "change_lead_status") return { status: valueToUse };
  if (action === "assign_smart_tag") return { tag_id: valueToUse };
  if (action === "extract_variable" || action === "update_variable") return { variable_id: valueToUse };
  if (action === "notify_internal") return { title: valueToUse || "Automatizacion ejecutada" };
  if (action === "create_activity") return { description: valueToUse };
  return {};
}

export async function createAutomationRule(formData: FormData) {
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const parsed = automationRuleSchema.safeParse(automationPayload(formData, organization.id));

  if (!parsed.success) redirect("/automations/new?error=invalid");

  const { actions, ...rule } = parsed.data;
  const { data, error } = await supabase
    .from("automation_rules")
    .insert({
      ...rule,
      enabled: rule.status === "active"
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !data) redirect(`/automations/new?error=${actionErrorCode(error)}`);

  const actionsError = await insertActions({
    supabase,
    organizationId: organization.id,
    ruleId: data.id,
    actions
  });
  if (actionsError) {
    await supabase.from("automation_rules").delete().eq("id", data.id).eq("organization_id", organization.id);
    redirect(`/automations/new?error=${actionErrorCode(actionsError)}`);
  }
  await audit("create_automation_rule", "automation_rules", data.id, organization.id);

  revalidatePath("/automations");
  redirect(`/automations/${data.id}`);
}

export async function updateAutomationRule(formData: FormData) {
  const id = value(formData, "id");
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const parsed = automationRuleSchema.safeParse(automationPayload(formData, organization.id));

  if (!parsed.success) redirect(`/automations/${id}/edit?error=invalid`);

  const { actions, ...rule } = parsed.data;
  const { data: updated, error } = await supabase
    .from("automation_rules")
    .update({
      ...rule,
      enabled: rule.status === "active"
    })
    .eq("id", id)
    .eq("organization_id", organization.id)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) redirect(`/automations/${id}/edit?error=${actionErrorCode(error)}`);
  if (!updated) redirect(`/automations/${id}/edit?error=not-found`);

  const { data: previousActions } = await supabase
    .from("automation_actions")
    .select("action_type, config, enabled, position")
    .eq("rule_id", id)
    .eq("organization_id", organization.id)
    .order("position");
  const { error: deleteError } = await supabase
    .from("automation_actions")
    .delete()
    .eq("rule_id", id)
    .eq("organization_id", organization.id);
  if (deleteError) redirect(`/automations/${id}/edit?error=${actionErrorCode(deleteError)}`);

  const actionsError = await insertActions({
    supabase,
    organizationId: organization.id,
    ruleId: id,
    actions
  });
  if (actionsError) {
    if (previousActions?.length) {
      await supabase.from("automation_actions").insert(
        previousActions.map((action) => ({
          organization_id: organization.id,
          rule_id: id,
          ...action
        })),
      );
    }
    redirect(`/automations/${id}/edit?error=${actionErrorCode(actionsError)}`);
  }
  await audit("update_automation_rule", "automation_rules", id, organization.id);

  revalidatePath("/automations");
  revalidatePath(`/automations/${id}`);
  redirect(`/automations/${id}`);
}

export async function scheduleManualAutomationRun(formData: FormData) {
  const ruleId = value(formData, "rule_id");
  const returnTo = value(formData, "return_to") || `/automations/${ruleId}`;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const triggerType = value(formData, "trigger_type");
  const context = parseJson(value(formData, "context"), {});

  if (!automationTriggerTypes.includes(triggerType as (typeof automationTriggerTypes)[number])) {
    redirect(`${returnTo}?error=invalid-trigger`);
  }

  const { data, error } = await supabase
    .from("automation_runs")
    .insert({
      organization_id: organization.id,
      rule_id: ruleId,
      trigger_type: triggerType,
      status: "pending",
      context: {
        ...context,
        organization_id: organization.id
      },
      scheduled_for: new Date().toISOString()
    })
    .select("id, organization_id, rule_id, trigger_type, context")
    .single<{
      id: string;
      organization_id: string;
      rule_id: string | null;
      trigger_type: (typeof automationTriggerTypes)[number];
      context: { organization_id: string };
    }>();

  if (error || !data) redirect(addQueryParam(returnTo, "error", actionErrorCode(error)));

  await executeAutomationRun(supabase as unknown as SupabaseLike, data, true);
  await audit("manual_automation_run", "automation_runs", data.id, organization.id);

  revalidatePath("/automations");
  revalidatePath(`/automations/${ruleId}`);
  redirect(`${returnTo}?run=1`);
}

export async function testAutomationWithConversation(formData: FormData) {
  const ruleId = value(formData, "rule_id");
  const conversationId = value(formData, "conversation_id");
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const parsed = z.object({
    ruleId: z.string().uuid(),
    conversationId: z.string().uuid()
  }).safeParse({ ruleId, conversationId });
  if (!parsed.success) redirect(`/automations/${ruleId}?error=invalid-test`);

  const { data: conversation } = await supabase.from("conversations")
    .select("id, lead_id, contact_id")
    .eq("id", conversationId).eq("organization_id", organization.id)
    .maybeSingle<{ id: string; lead_id: string | null; contact_id: string | null }>();
  if (!conversation) redirect(`/automations/${ruleId}?error=conversation-not-found`);
  const { data: latestMessage } = await supabase.from("messages").select("id")
    .eq("organization_id", organization.id).eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle<{ id: string }>();
  const { data: rule } = await supabase.from("automation_rules").select("trigger_type")
    .eq("id", ruleId).eq("organization_id", organization.id)
    .single<{ trigger_type: (typeof automationTriggerTypes)[number] }>();
  if (!rule) redirect(`/automations/${ruleId}?error=not-found`);

  const { data: run, error } = await supabase.from("automation_runs").insert({
    organization_id: organization.id,
    rule_id: ruleId,
    trigger_type: rule.trigger_type,
    status: "pending",
    conversation_id: conversation.id,
    lead_id: conversation.lead_id,
    contact_id: conversation.contact_id,
    message_id: latestMessage?.id,
    initiated_by: user.id,
    idempotency_key: `manual-test:${ruleId}:${conversation.id}:${Date.now()}`,
    context: {
      organization_id: organization.id,
      conversation_id: conversation.id,
      lead_id: conversation.lead_id,
      contact_id: conversation.contact_id,
      message_id: latestMessage?.id
    }
  }).select("id").single<{ id: string }>();
  if (error || !run) redirect(`/automations/${ruleId}?error=${actionErrorCode(error)}`);
  await executeRealAutomationRun(supabase, run.id);
  revalidatePath(`/automations/${ruleId}`);
  revalidatePath("/inbox");
  redirect(`/automations/${ruleId}?test=1`);
}

export async function updateAutomationStatus(formData: FormData) {
  const ruleId = value(formData, "rule_id");
  const status = value(formData, "status");
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  if (!["active", "paused"].includes(status)) redirect(`/automations/${ruleId}?error=invalid-status`);
  await supabase.from("automation_rules").update({
    status,
    enabled: status === "active"
  }).eq("id", ruleId).eq("organization_id", organization.id);
  await audit("update_automation_status", "automation_rules", ruleId, organization.id, { status });
  revalidatePath("/automations");
  revalidatePath(`/automations/${ruleId}`);
  redirect(`/automations/${ruleId}?status=${status}`);
}

export async function approveAutomationDraft(formData: FormData) {
  const draftId = value(formData, "draft_id");
  const returnTo = value(formData, "return_to") || "/inbox";
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: draft } = await supabase.from("automation_drafts")
    .select("id, conversation_id, body, status")
    .eq("id", draftId).eq("organization_id", organization.id)
    .eq("status", "pending")
    .maybeSingle<{ id: string; conversation_id: string; body: string; status: string }>();
  if (!draft) redirect(addQueryParam(returnTo, "error", "draft-not-found"));

  const { data: reserved, error: reserveError } = await supabase.from("automation_drafts").update({
    status: "approved",
    approved_by: user.id,
    approved_at: new Date().toISOString()
  }).eq("id", draft.id)
    .eq("organization_id", organization.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle<{ id: string }>();
  if (reserveError || !reserved) {
    redirect(addQueryParam(returnTo, "error", reserveError ? actionErrorCode(reserveError) : "draft-not-found"));
  }

  try {
    await sendDraft(supabase, organization.id, draft.id, draft.conversation_id, draft.body, user.id);
  } catch (error) {
    redirect(addQueryParam(returnTo, "error", draftSendErrorCode(error)));
  }
  revalidatePath("/inbox");
  redirect(addQueryParam(returnTo, "draft", "sent"));
}

export async function discardAutomationDraft(formData: FormData) {
  const draftId = value(formData, "draft_id");
  const returnTo = value(formData, "return_to") || "/inbox";
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  await supabase.from("automation_drafts").update({
    status: "discarded",
    approved_by: user.id,
    approved_at: new Date().toISOString()
  }).eq("id", draftId).eq("organization_id", organization.id).eq("status", "pending");
  await audit("discard_automation_draft", "automation_drafts", draftId, organization.id);
  revalidatePath("/inbox");
  redirect(addQueryParam(returnTo, "draft", "discarded"));
}

export async function hideFailedAutomationDraft(formData: FormData) {
  const draftId = value(formData, "draft_id");
  const returnTo = value(formData, "return_to") || "/inbox";
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data, error } = await supabase.from("automation_drafts").update({
    status: "discarded",
    approved_by: user.id,
    approved_at: new Date().toISOString()
  }).eq("id", draftId)
    .eq("organization_id", organization.id)
    .in("status", ["failed", "blocked"])
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) redirect(addQueryParam(returnTo, "error", actionErrorCode(error)));
  if (!data) redirect(addQueryParam(returnTo, "error", "draft-not-found"));

  await audit("hide_failed_automation_draft", "automation_drafts", draftId, organization.id);
  revalidatePath("/inbox");
  redirect(addQueryParam(returnTo, "draft", "hidden"));
}

export async function createManualFollowUp(formData: FormData) {
  const returnTo = value(formData, "return_to") || "/leads";
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const dueAt = value(formData, "due_at");
  const parsed = taskSchema.safeParse({
    organization_id: organization.id,
    lead_id: value(formData, "lead_id") || null,
    conversation_id: value(formData, "conversation_id") || null,
    owner_id: value(formData, "owner_id") || null,
    title: value(formData, "title"),
    description: value(formData, "description") || null,
    due_at: dueAt ? new Date(dueAt).toISOString() : null
  });

  if (!parsed.success) redirect(`${returnTo}?error=invalid-follow-up`);

  const { error } = await supabase.from("tasks").insert({
    ...parsed.data,
    created_by: user.id
  });

  if (error) redirect(addQueryParam(returnTo, "error", actionErrorCode(error)));

  await audit("create_manual_follow_up", "tasks", undefined, organization.id, {
    lead_id: parsed.data.lead_id,
    conversation_id: parsed.data.conversation_id
  });
  revalidatePath(returnTo);
  redirect(`${returnTo}?follow_up=1`);
}

async function insertActions({
  supabase,
  organizationId,
  ruleId,
  actions
}: {
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"];
  organizationId: string;
  ruleId: string;
  actions: unknown[];
}) {
  const parsedActions = actions.map((action) => automationActionSchema.parse(action));
  const { error } = await supabase.from("automation_actions").insert(
    parsedActions.map((action, index) => ({
      organization_id: organizationId,
      rule_id: ruleId,
      action_type: action.type,
      config: action.config,
      enabled: action.enabled,
      position: index + 1
    })),
  );
  return error;
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

function draftSendErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("recipient phone")) return "draft-recipient-missing";
  if (message.includes("whatsapp channel") || message.includes("access token")) return "draft-whatsapp-config";
  if (message.includes("whatsapp cloud api")) return "draft-whatsapp-api";
  return "draft-send-failed";
}
