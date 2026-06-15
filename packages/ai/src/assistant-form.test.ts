import { describe, expect, it } from "vitest";
import { assistantFormSchema, assistantTestSchema } from "./assistant";

describe("assistant schemas", () => {
  it("validates assistant create and edit payloads", () => {
    const assistant = assistantFormSchema.parse({
      name: "Ventas",
      description: "Respuestas comerciales",
      prompt: "Responde como asesor comercial con foco en convertir conversaciones.",
      objective: "Calificar leads",
      tone: "friendly",
      rules: "No inventar datos",
      fallback_message: "Un asesor va a ayudarte.",
      active: true,
      channel_id: "whatsapp",
      auto_reply_enabled: false
    });

    expect(assistant.active).toBe(true);
    expect(assistant.auto_reply_enabled).toBe(false);
  });

  it("validates assistant tests and inbox suggestions", () => {
    const test = assistantTestSchema.parse({
      assistant_id: "00000000-0000-4000-8000-000000000401",
      conversation_id: "00000000-0000-4000-8000-000000000301",
      input: "Sugeri una respuesta"
    });

    expect(test.input).toContain("respuesta");
  });
});
