import { describe, expect, it } from "vitest";
import { automationRuleSchema, taskSchema } from "./rules";

const organizationId = "00000000-0000-4000-8000-000000000001";

describe("automation rule schema", () => {
  it("validates automation rule creation", () => {
    const parsed = automationRuleSchema.parse({
      organization_id: organizationId,
      name: "Lead follow up",
      description: "Create a manual task",
      trigger_type: "lead_created",
      status: "draft",
      trigger_config: {},
      conditions: { lead_status: "nuevo" },
      actions: [{ type: "create_task", enabled: true, config: { title: "Call lead" } }]
    });

    expect(parsed.status).toBe("draft");
    expect(parsed.actions[0].type).toBe("create_task");
  });

  it("rejects invalid action types", () => {
    const parsed = automationRuleSchema.safeParse({
      organization_id: organizationId,
      name: "Invalid automation",
      trigger_type: "manual",
      trigger_config: {},
      conditions: {},
      actions: [{ type: "real_whatsapp_send", enabled: true, config: {} }]
    });

    expect(parsed.success).toBe(false);
  });
});

describe("task schema", () => {
  it("validates manual follow up tasks", () => {
    const parsed = taskSchema.parse({
      organization_id: organizationId,
      lead_id: "00000000-0000-4000-8000-000000000101",
      title: "Responder propuesta",
      due_at: new Date("2026-06-20T10:00:00.000Z").toISOString()
    });

    expect(parsed.title).toBe("Responder propuesta");
  });
});
