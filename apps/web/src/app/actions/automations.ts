"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  automationActionSchema,
  automationRuleSchema,
  automationTriggerTypes,
  taskSchema
} from "@crm-pro-ai/automation/rules";
import { executeAutomationRun, type SupabaseLike } from "@/lib/automation/runner";
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
  const actions = parseJson(value(formData, "actions_json"), []);
  return {
    organization_id: organizationId,
    name: value(formData, "name"),
    description: value(formData, "description") || null,
    trigger_type: value(formData, "trigger_type"),
    status: value(formData, "status") || "draft",
    trigger_config: parseJson(value(formData, "trigger_config"), {}),
    conditions: parseJson(value(formData, "conditions"), {}),
    actions
  };
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
