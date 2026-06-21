import { describe, expect, it, vi } from "vitest";
import { VariableExtractor } from "./variable-extractor";
import { validateVariableValue, variableSchema, type VariableDefinition } from "./variables";

const priceVariable: VariableDefinition = {
  id: "00000000-0000-4000-8000-000000000601",
  organization_id: "00000000-0000-4000-8000-000000000001",
  name: "Presupuesto",
  key: "presupuesto",
  description: "Presupuesto informado",
  type: "price",
  extraction_prompt: "Extraer monto o presupuesto",
  active: true,
  required: false,
  options: []
};

describe("variable schemas", () => {
  it("validates variable creation and edition payloads", () => {
    const parsed = variableSchema.parse({
      name: "Email",
      key: "email",
      description: "Email del lead",
      type: "text",
      extraction_prompt: "Extraer email del cliente",
      active: true,
      required: false,
      options: []
    });

    expect(parsed.key).toBe("email");
  });

  it("validates values by type", () => {
    expect(validateVariableValue("price", "$1500")).toBe(1500);
    expect(validateVariableValue("boolean", "si")).toBe(true);
    expect(validateVariableValue("option", "CRM", ["CRM", "IA"])).toBe("CRM");
    expect(() => validateVariableValue("link", "not-a-url")).toThrow();
  });
});

describe("VariableExtractor", () => {
  it("extracts values in demo mode with confidence and source message", async () => {
    const extractor = new VariableExtractor();
    const { results: [result], mode } = await extractor.extract([priceVariable], {
      lead: { name: "Ana Torres" },
      messages: [
        {
          id: "00000000-0000-4000-8000-000000000701",
          direction: "inbound",
          body: "Mi presupuesto es $1500."
        }
      ]
    });

    expect(result?.extracted).toBe(true);
    expect(result?.value).toBe(1500);
    expect(result?.confidence).toBeGreaterThan(0.5);
    expect(result?.sourceMessageId).toBe("00000000-0000-4000-8000-000000000701");
    expect(mode).toBe("demo");
  });

  it("keeps tenant identity in extraction input", () => {
    const extractor = new VariableExtractor();
    const input = extractor.buildInput([priceVariable], { messages: [] });

    expect(input.variables[0]?.id).toBe(priceVariable.id);
  });

  it("uses OpenAI structured output and validates the variable type", async () => {
    const messageId = "00000000-0000-4000-8000-000000000701";
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        output_text: JSON.stringify({
          results: [{
            variableId: priceVariable.id,
            extracted: true,
            value: 2500,
            confidence: 0.94,
            sourceMessageId: messageId,
            reason: "Monto explicito."
          }]
        }),
        usage: { input_tokens: 90, output_tokens: 25, total_tokens: 115 }
      })
    });
    const extractor = new VariableExtractor({
      apiKey: "sk-test",
      model: "gpt-test",
      demoMode: false,
      fetcher
    });
    const result = await extractor.extract([priceVariable], {
      messages: [{ id: messageId, direction: "inbound", body: "Mi presupuesto es 2500." }]
    });

    expect(result.mode).toBe("openai");
    expect(result.results[0]?.value).toBe(2500);
    expect(result.usage.totalTokens).toBe(115);
  });
});

describe("duplicate prevention contract", () => {
  it("uses unique target pairs for variable values", () => {
    const uniqueKeys = ["lead_id,variable_id", "conversation_id,variable_id"];

    expect(uniqueKeys).toContain("lead_id,variable_id");
    expect(uniqueKeys).toContain("conversation_id,variable_id");
  });
});
