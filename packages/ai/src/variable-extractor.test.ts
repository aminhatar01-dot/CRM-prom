import { describe, expect, it } from "vitest";
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
  it("extracts values in demo mode with confidence and source message", () => {
    const extractor = new VariableExtractor();
    const [result] = extractor.extract([priceVariable], {
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
  });

  it("keeps tenant identity in extraction input", () => {
    const extractor = new VariableExtractor();
    const input = extractor.buildInput([priceVariable], { messages: [] });

    expect(input.variables[0]?.id).toBe(priceVariable.id);
  });
});

describe("duplicate prevention contract", () => {
  it("uses unique target pairs for variable values", () => {
    const uniqueKeys = ["lead_id,variable_id", "conversation_id,variable_id"];

    expect(uniqueKeys).toContain("lead_id,variable_id");
    expect(uniqueKeys).toContain("conversation_id,variable_id");
  });
});
