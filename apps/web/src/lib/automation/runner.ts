import {
  prepareAutomationOperations,
  nextRunStatus,
  type AutomationContext,
  type PreparedOperation
} from "@crm-pro-ai/automation/engine";
import type { AutomationAction, AutomationRule, AutomationTriggerType } from "@crm-pro-ai/automation/rules";

export type SupabaseLike = {
  from: (table: string) => {
    select: (columns?: string) => SupabaseQuery;
    insert: (payload: unknown) => SupabaseQuery;
    update: (payload: unknown) => SupabaseQuery;
    upsert: (payload: unknown, options?: unknown) => SupabaseQuery;
  };
};

type SupabaseQuery = {
  eq: (column: string, value: unknown) => SupabaseQuery;
  in: (column: string, value: unknown[]) => SupabaseQuery;
  lte: (column: string, value: string) => SupabaseQuery;
  order: (column: string, options?: unknown) => SupabaseQuery;
  limit: (count: number) => SupabaseQuery;
  single: <T = unknown>() => Promise<{ data: T | null; error: Error | null }>;
  maybeSingle: <T = unknown>() => Promise<{ data: T | null; error: Error | null }>;
  returns: <T = unknown>() => Promise<{ data: T | null; error: Error | null }>;
};

export type AutomationRunRow = {
  id: string;
  organization_id: string;
  rule_id: string | null;
  trigger_type: AutomationTriggerType;
  context: AutomationContext;
};

type AutomationRuleRow = Omit<AutomationRule, "actions"> & {
  id: string;
  enabled: boolean;
};

type AutomationActionRow = AutomationAction & {
  id: string;
  action_type?: AutomationAction["type"];
};

export async function runPendingAutomations(supabase: SupabaseLike, now = new Date()) {
  const { data: runs } = await supabase
    .from("automation_runs")
    .select("id, organization_id, rule_id, trigger_type, context")
    .eq("status", "pending")
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(25)
    .returns<AutomationRunRow[]>();

  const results = [];
  for (const run of runs ?? []) {
    results.push(await executeAutomationRun(supabase, run));
  }

  return results;
}

export async function executeAutomationRun(supabase: SupabaseLike, run: AutomationRunRow, manual = false) {
  await supabase
    .from("automation_runs")
    .update({ status: "running", started_at: new Date().toISOString() })
    .eq("id", run.id)
    .eq("organization_id", run.organization_id);

  try {
    if (!run.rule_id) throw new Error("Automation run does not reference a rule");

    const { data: rule } = await supabase
      .from("automation_rules")
      .select("id, organization_id, name, description, trigger_type, status, trigger_config, conditions, enabled")
      .eq("id", run.rule_id)
      .eq("organization_id", run.organization_id)
      .single<AutomationRuleRow>();

    if (!rule) throw new Error("Automation rule not found");
    if (!manual && rule.status !== "active") {
      await finishRun(supabase, run, "cancelled", { skipped: true, reason: "rule_not_active" });
      return { runId: run.id, status: "cancelled", operations: [] };
    }

    const { data: actionRows } = await supabase
      .from("automation_actions")
      .select("id, action_type, config, enabled")
      .eq("organization_id", run.organization_id)
      .eq("rule_id", rule.id)
      .order("position", { ascending: true })
      .returns<AutomationActionRow[]>();

    const actions = (actionRows ?? []).map((action) => ({
      type: action.action_type ?? action.type,
      config: action.config,
      enabled: action.enabled
    }));
    const operations = prepareAutomationOperations({
      rule,
      actions,
      context: { ...run.context, organization_id: run.organization_id },
      manual
    });

    for (const operation of operations) {
      await applyOperation(supabase, operation);
    }

    const status = nextRunStatus(operations);
    await finishRun(supabase, run, status, { operations });
    await supabase
      .from("automation_rules")
      .update({ last_run_at: new Date().toISOString() })
      .eq("id", rule.id)
      .eq("organization_id", run.organization_id);

    return { runId: run.id, status, operations };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown automation error";
    await supabase
      .from("automation_runs")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString()
      })
      .eq("id", run.id)
      .eq("organization_id", run.organization_id);
    return { runId: run.id, status: "failed", error: message, operations: [] };
  }
}

async function applyOperation(supabase: SupabaseLike, operation: PreparedOperation) {
  if (operation.type === "send_message") return;
  if (operation.type === "create_task") await supabase.from("tasks").insert(operation.payload);
  if (operation.type === "notify_internal") await supabase.from("internal_notifications").insert(operation.payload);
  if (operation.type === "pause_ai") {
    await supabase
      .from("conversations")
      .update({ ai_status: "paused", ai_paused: true })
      .eq("organization_id", operation.payload.organization_id)
      .eq("id", operation.payload.conversation_id);
  }
  if (operation.type === "assign_smart_tag") {
    if (operation.payload.lead_id && operation.payload.tag_id) {
      await supabase.from("lead_tags").upsert(
        {
          organization_id: operation.payload.organization_id,
          lead_id: operation.payload.lead_id,
          tag_id: operation.payload.tag_id
        },
        { onConflict: "lead_id,tag_id" },
      );
    }
    if (operation.payload.conversation_id && operation.payload.tag_id) {
      await supabase.from("conversation_smart_tags").upsert(
        {
          organization_id: operation.payload.organization_id,
          conversation_id: operation.payload.conversation_id,
          tag_id: operation.payload.tag_id,
          assignment_source: "automation"
        },
        { onConflict: "conversation_id,tag_id" },
      );
    }
  }
  if (operation.type === "update_variable") {
    const payload = {
      organization_id: operation.payload.organization_id,
      variable_id: operation.payload.variable_id,
      value: operation.payload.value,
      confidence: operation.payload.confidence,
      extracted_at: new Date().toISOString()
    };
    if (operation.payload.lead_id) {
      await supabase.from("lead_variables").upsert(
        { ...payload, lead_id: operation.payload.lead_id },
        { onConflict: "lead_id,variable_id" },
      );
    }
    if (operation.payload.conversation_id) {
      await supabase.from("conversation_variables").upsert(
        { ...payload, conversation_id: operation.payload.conversation_id },
        { onConflict: "conversation_id,variable_id" },
      );
    }
  }
}

async function finishRun(
  supabase: SupabaseLike,
  run: AutomationRunRow,
  status: "completed" | "cancelled",
  result: Record<string, unknown>,
) {
  await supabase
    .from("automation_runs")
    .update({
      status,
      result,
      completed_at: new Date().toISOString()
    })
    .eq("id", run.id)
    .eq("organization_id", run.organization_id);
}
