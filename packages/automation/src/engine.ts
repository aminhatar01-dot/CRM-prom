import {
  automationRunSchema,
  type AutomationAction,
  type AutomationRule,
  type AutomationRun,
} from "./rules";

export type AutomationContext = {
  organization_id: string;
  lead_id?: string | null;
  conversation_id?: string | null;
  owner_id?: string | null;
  channel?: string | null;
  lead_status?: string | null;
  smart_tag_id?: string | null;
  variable_id?: string | null;
  minutes_without_response?: number | null;
};

export type PreparedOperation =
  | { type: "create_task"; payload: Record<string, unknown> }
  | { type: "pause_ai"; payload: Record<string, unknown> }
  | { type: "assign_smart_tag"; payload: Record<string, unknown> }
  | { type: "update_variable"; payload: Record<string, unknown> }
  | { type: "notify_internal"; payload: Record<string, unknown> }
  | { type: "send_message"; payload: Record<string, unknown>; mocked: true; skipped: boolean };

export function parseJsonRecord(value: string, fallback: Record<string, unknown> = {}) {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : fallback;
  } catch {
    return fallback;
  }
}

export function conditionsMatch(conditions: Record<string, unknown>, context: AutomationContext) {
  if (conditions.channel && conditions.channel !== context.channel) return false;
  if (conditions.lead_status && conditions.lead_status !== context.lead_status) return false;
  if (conditions.smart_tag_id && conditions.smart_tag_id !== context.smart_tag_id) return false;
  if (conditions.variable_id && conditions.variable_id !== context.variable_id) return false;
  if (conditions.owner_id && conditions.owner_id !== context.owner_id) return false;

  const minimumIdle = Number(conditions.minutes_without_response ?? 0);
  if (minimumIdle > 0 && Number(context.minutes_without_response ?? 0) < minimumIdle) return false;

  return true;
}

export function canExecuteRule(rule: Pick<AutomationRule, "status" | "trigger_type" | "conditions">, context: AutomationContext, manual = false) {
  if (rule.trigger_type !== "manual" && !manual && rule.status !== "active") return false;
  if (manual && rule.status === "archived") return false;
  return conditionsMatch(rule.conditions, context);
}

export function scheduleAutomationRun(rule: AutomationRule, context: AutomationContext, scheduledFor = new Date()) {
  const run: AutomationRun = {
    organization_id: rule.organization_id,
    rule_id: null,
    trigger_type: rule.trigger_type,
    status: "pending",
    context,
    scheduled_for: scheduledFor.toISOString()
  };

  return automationRunSchema.parse(run);
}

export function prepareAutomationOperations({
  rule,
  actions,
  context,
  manual = false
}: {
  rule: Pick<AutomationRule, "status" | "organization_id">;
  actions: AutomationAction[];
  context: AutomationContext;
  manual?: boolean;
}) {
  assertSameTenant(rule.organization_id, context.organization_id);

  return actions
    .filter((action) => action.enabled)
    .map((action): PreparedOperation => {
      if (action.type === "send_message") {
        return {
          type: "send_message",
          mocked: true,
          skipped: rule.status !== "active" && !manual,
          payload: {
            body: action.config.body ?? action.config.message ?? "",
            conversation_id: context.conversation_id,
            organization_id: context.organization_id
          }
        };
      }

      if (action.type === "create_task") {
        return {
          type: "create_task",
          payload: {
            organization_id: context.organization_id,
            lead_id: action.config.lead_id ?? context.lead_id ?? null,
            conversation_id: action.config.conversation_id ?? context.conversation_id ?? null,
            owner_id: action.config.owner_id ?? context.owner_id ?? null,
            title: action.config.title ?? "Seguimiento comercial",
            description: action.config.description ?? null,
            due_at: action.config.due_at ?? null
          }
        };
      }

      if (action.type === "pause_ai") {
        return {
          type: "pause_ai",
          payload: {
            organization_id: context.organization_id,
            conversation_id: action.config.conversation_id ?? context.conversation_id
          }
        };
      }

      if (action.type === "assign_smart_tag") {
        return {
          type: "assign_smart_tag",
          payload: {
            organization_id: context.organization_id,
            lead_id: action.config.lead_id ?? context.lead_id ?? null,
            conversation_id: action.config.conversation_id ?? context.conversation_id ?? null,
            tag_id: action.config.tag_id
          }
        };
      }

      if (action.type === "update_variable") {
        return {
          type: "update_variable",
          payload: {
            organization_id: context.organization_id,
            lead_id: action.config.lead_id ?? context.lead_id ?? null,
            conversation_id: action.config.conversation_id ?? context.conversation_id ?? null,
            variable_id: action.config.variable_id,
            value: action.config.value ?? null,
            confidence: action.config.confidence ?? 1
          }
        };
      }

      return {
        type: "notify_internal",
        payload: {
          organization_id: context.organization_id,
          user_id: action.config.user_id ?? context.owner_id ?? null,
          title: action.config.title ?? "Notificacion interna",
          body: action.config.body ?? null,
          entity_table: action.config.entity_table ?? (context.conversation_id ? "conversations" : "leads"),
          entity_id: action.config.entity_id ?? context.conversation_id ?? context.lead_id ?? null,
          metadata: { source: "automation" }
        }
      };
    });
}

export function nextRunStatus(operations: PreparedOperation[]): "completed" | "cancelled" {
  return operations.length > 0 ? "completed" : "cancelled";
}

function assertSameTenant(ruleOrganizationId: string, contextOrganizationId: string) {
  if (ruleOrganizationId !== contextOrganizationId) {
    throw new Error("Cross-tenant automation execution rejected");
  }
}
