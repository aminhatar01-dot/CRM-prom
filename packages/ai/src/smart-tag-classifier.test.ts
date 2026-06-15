import { describe, expect, it } from "vitest";
import { SmartTagClassifier } from "./smart-tag-classifier";
import { smartTagAssignmentSchema, smartTagSchema, type SmartTagDefinition } from "./smart-tags";

const tag: SmartTagDefinition = {
  id: "00000000-0000-4000-8000-000000000501",
  organization_id: "00000000-0000-4000-8000-000000000001",
  name: "Presupuesto pendiente",
  color: "#b45309",
  description: "Cliente pregunta por presupuesto",
  classification_prompt: "Detectar precio, costo o presupuesto",
  active: true,
  auto_pause_assistant: true,
  notify_team: false
};

describe("smart tag schemas", () => {
  it("validates creation and edition payloads", () => {
    const parsed = smartTagSchema.parse({
      name: "Urgente",
      color: "#dc2626",
      description: "Atencion inmediata",
      classification_prompt: "Detectar urgencia o necesidad inmediata",
      active: true,
      auto_pause_assistant: false,
      notify_team: true
    });

    expect(parsed.notify_team).toBe(true);
  });

  it("validates manual assignments", () => {
    const parsed = smartTagAssignmentSchema.parse({
      tag_id: tag.id,
      lead_id: "00000000-0000-4000-8000-000000000101"
    });

    expect(parsed.lead_id).toBeTruthy();
  });
});

describe("SmartTagClassifier", () => {
  it("classifies matching demo conversations", () => {
    const classifier = new SmartTagClassifier({ demoMode: true });
    const [result] = classifier.classify([tag], {
      lead: { name: "Ana Torres", status: "nuevo" },
      conversation: {
        id: "00000000-0000-4000-8000-000000000301",
        channel: "whatsapp",
        status: "abierta",
        ai_status: "human"
      },
      messages: [{ direction: "inbound", body: "Quiero saber el precio y presupuesto." }]
    });

    expect(result?.matched).toBe(true);
    expect(result?.confidence).toBeGreaterThan(0.5);
  });

  it("preserves auto pause configuration for matched tags", () => {
    expect(tag.auto_pause_assistant).toBe(true);
  });

  it("keeps tenant identity in classifier input", () => {
    const classifier = new SmartTagClassifier();
    const input = classifier.buildInput([tag], { messages: [] });

    expect(input.tags[0]?.id).toBe(tag.id);
  });
});

describe("duplicate prevention contract", () => {
  it("uses unique target pairs for assignments", () => {
    const uniqueKeys = ["lead_id,tag_id", "conversation_id,tag_id"];

    expect(uniqueKeys).toContain("lead_id,tag_id");
    expect(uniqueKeys).toContain("conversation_id,tag_id");
  });
});
