import { z } from "zod";

export const automationTriggerTypes = [
  "lead_created",
  "lead_status_changed",
  "conversation_created",
  "message_received",
  "smart_tag_assigned",
  "variable_updated",
  "inactivity",
  "manual"
] as const;

export const automationActionTypes = [
  "send_message",
  "generate_ai_draft",
  "assign_smart_tag",
  "extract_variable",
  "change_lead_status",
  "create_activity",
  "update_variable",
  "create_task",
  "pause_ai",
  "notify_internal",
  "create_quote",
  "send_quote_draft",
  "mark_quote_sent",
  "notify_quote_accepted"
] as const;

export const automationRuleStatuses = ["draft", "active", "paused", "archived"] as const;
export const automationRunStatuses = ["pending", "running", "completed", "failed", "cancelled"] as const;
export const taskStatuses = ["pending", "completed", "cancelled"] as const;

export const jsonRecordSchema = z.record(z.unknown()).default({});

export const automationActionSchema = z.object({
  type: z.enum(automationActionTypes),
  config: jsonRecordSchema,
  enabled: z.boolean().default(true)
});

export const automationRuleSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  trigger_type: z.enum(automationTriggerTypes),
  status: z.enum(automationRuleStatuses).default("draft"),
  auto_send: z.boolean().default(false),
  auto_reply_limit: z.number().int().min(1).max(10).default(5),
  auto_reply_window_minutes: z.number().int().min(1).max(1440).default(30),
  trigger_config: jsonRecordSchema,
  conditions: jsonRecordSchema,
  actions: z.array(automationActionSchema).min(1).max(10)
});

export const automationRuleFormSchema = automationRuleSchema.omit({ organization_id: true }).extend({
  actions_json: z.string().min(2)
});

export const automationRunSchema = z.object({
  organization_id: z.string().uuid(),
  rule_id: z.string().uuid().nullable().optional(),
  trigger_type: z.enum(automationTriggerTypes),
  status: z.enum(automationRunStatuses).default("pending"),
  context: jsonRecordSchema,
  scheduled_for: z.string().datetime().optional()
});

export const taskSchema = z.object({
  organization_id: z.string().uuid(),
  lead_id: z.string().uuid().nullable().optional(),
  conversation_id: z.string().uuid().nullable().optional(),
  owner_id: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).nullable().optional(),
  due_at: z.string().datetime().nullable().optional()
});

export type AutomationTriggerType = (typeof automationTriggerTypes)[number];
export type AutomationActionType = (typeof automationActionTypes)[number];
export type AutomationRuleStatus = (typeof automationRuleStatuses)[number];
export type AutomationRunStatus = (typeof automationRunStatuses)[number];
export type AutomationAction = z.infer<typeof automationActionSchema>;
export type AutomationRule = z.infer<typeof automationRuleSchema>;
export type AutomationRun = z.infer<typeof automationRunSchema>;
export type TaskInput = z.infer<typeof taskSchema>;
