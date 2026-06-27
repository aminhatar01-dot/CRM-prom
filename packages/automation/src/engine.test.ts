import { describe, expect, it } from "vitest";
import {
  decideAutoSend,
  detectHumanEscalationIntent,
  isAutoReplyAllowed,
  isWithinWhatsAppWindow,
  canExecuteRule,
  conditionsMatch,
  prepareAutomationOperations,
  scheduleAutomationRun
} from "./engine";
import type { AutomationRule } from "./rules";

const organizationId = "00000000-0000-4000-8000-000000000001";
const otherOrganizationId = "00000000-0000-4000-8000-000000000099";

const baseRule: AutomationRule = {
  organization_id: organizationId,
  name: "Demo automation",
  description: null,
  trigger_type: "lead_created",
  status: "active",
  auto_send: false,
  auto_reply_limit: 1,
  auto_reply_window_minutes: 1440,
  trigger_config: {},
  conditions: {},
  actions: [{ type: "create_task", enabled: true, config: { title: "Follow up" } }]
};

describe("automation engine", () => {
  it("matches supported conditions", () => {
    expect(
      conditionsMatch(
        { channel: "whatsapp", ai_status: "active", ai_paused: false, lead_status: "nuevo", minutes_without_response: 30 },
        {
          organization_id: organizationId,
          channel: "whatsapp",
          ai_status: "active",
          ai_paused: false,
          lead_status: "nuevo",
          minutes_without_response: 45
        },
      ),
    ).toBe(true);
    expect(
      conditionsMatch(
        { channel: "whatsapp", ai_status: "active", ai_paused: false },
        { organization_id: organizationId, channel: "whatsapp", ai_status: "human", ai_paused: false },
      ),
    ).toBe(false);
  });

  it("schedules a pending automation run", () => {
    const run = scheduleAutomationRun(baseRule, { organization_id: organizationId });

    expect(run.status).toBe("pending");
    expect(run.trigger_type).toBe("lead_created");
  });

  it("allows manual execution for draft non-archived rules", () => {
    expect(canExecuteRule({ ...baseRule, status: "draft" }, { organization_id: organizationId }, true)).toBe(true);
  });

  it("prepares create_task, pause_ai and assign_smart_tag operations", () => {
    const operations = prepareAutomationOperations({
      rule: baseRule,
      context: {
        organization_id: organizationId,
        lead_id: "00000000-0000-4000-8000-000000000101",
        conversation_id: "00000000-0000-4000-8000-000000000301"
      },
      actions: [
        { type: "create_task", enabled: true, config: { title: "Call lead" } },
        { type: "pause_ai", enabled: true, config: {} },
        {
          type: "assign_smart_tag",
          enabled: true,
          config: { tag_id: "00000000-0000-4000-8000-000000000501" }
        }
      ]
    });

    expect(operations.map((operation) => operation.type)).toEqual(["create_task", "pause_ai", "assign_smart_tag"]);
  });

  it("mocks send_message and does not call external channels", () => {
    const [operation] = prepareAutomationOperations({
      rule: { ...baseRule, status: "draft" },
      context: { organization_id: organizationId, conversation_id: "00000000-0000-4000-8000-000000000301" },
      actions: [{ type: "send_message", enabled: true, config: { body: "Hola" } }]
    });

    expect(operation).toMatchObject({ type: "send_message", mocked: true, skipped: true });
  });

  it("rejects cross-tenant execution", () => {
    expect(() =>
      prepareAutomationOperations({
        rule: baseRule,
        context: { organization_id: otherOrganizationId },
        actions: baseRule.actions
      }),
    ).toThrow("Cross-tenant automation execution rejected");
  });
});

describe("automatic reply safety", () => {
  it("enforces the WhatsApp window", () => {
    const now = Date.parse("2026-06-22T12:00:00.000Z");
    expect(isWithinWhatsAppWindow("2026-06-21T12:00:01.000Z", now)).toBe(true);
    expect(isWithinWhatsAppWindow("2026-06-21T11:59:59.000Z", now)).toBe(false);
  });

  it("blocks loops and organization rate excess", () => {
    expect(isAutoReplyAllowed({ conversationSent: 1, organizationSent: 1, conversationLimit: 1 }))
      .toEqual({ allowed: false, reason: "conversation_limit" });
    expect(isAutoReplyAllowed({ conversationSent: 0, organizationSent: 20, conversationLimit: 1 }))
      .toEqual({ allowed: false, reason: "organization_rate_limit" });
  });

  it("requires explicit rule, assistant and conversation opt-in", () => {
    const baseDecision = {
      ruleAutoSend: true,
      assistantAutoReplyEnabled: true,
      conversationAiStatus: "active",
      conversationPaused: false,
      knowledgeSufficient: true,
      sensitiveIntent: false
    };

    expect(decideAutoSend(baseDecision)).toEqual({ allowed: true, reason: "ready" });
    expect(decideAutoSend({ ...baseDecision, ruleAutoSend: false })).toEqual({ allowed: false, reason: "draft_mode" });
    expect(decideAutoSend({ ...baseDecision, assistantAutoReplyEnabled: false }))
      .toEqual({ allowed: false, reason: "assistant_auto_reply_disabled" });
    expect(decideAutoSend({ ...baseDecision, conversationAiStatus: "human" }))
      .toEqual({ allowed: false, reason: "conversation_not_automatic" });
  });

  it("blocks paused, insufficient and sensitive conversations", () => {
    const baseDecision = {
      ruleAutoSend: true,
      assistantAutoReplyEnabled: true,
      conversationAiStatus: "active",
      conversationPaused: false,
      knowledgeSufficient: true,
      sensitiveIntent: false
    };

    expect(decideAutoSend({ ...baseDecision, conversationPaused: true }))
      .toEqual({ allowed: false, reason: "conversation_paused" });
    expect(decideAutoSend({ ...baseDecision, knowledgeSufficient: false }))
      .toEqual({ allowed: false, reason: "knowledge_insufficient" });
    expect(decideAutoSend({ ...baseDecision, sensitiveIntent: true }))
      .toEqual({ allowed: false, reason: "human_escalation_required" });
    expect(detectHumanEscalationIntent("Estoy enojado, quiero hacer un reclamo legal por el pago.")).toBe(true);
  });
});
