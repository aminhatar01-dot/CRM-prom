import { describe, expect, it } from "vitest";
import {
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
  trigger_config: {},
  conditions: {},
  actions: [{ type: "create_task", enabled: true, config: { title: "Follow up" } }]
};

describe("automation engine", () => {
  it("matches supported conditions", () => {
    expect(
      conditionsMatch(
        { channel: "whatsapp", lead_status: "nuevo", minutes_without_response: 30 },
        {
          organization_id: organizationId,
          channel: "whatsapp",
          lead_status: "nuevo",
          minutes_without_response: 45
        },
      ),
    ).toBe(true);
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
