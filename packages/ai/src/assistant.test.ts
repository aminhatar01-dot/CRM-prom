import { describe, expect, it } from "vitest";
import { assistantConfigSchema } from "./assistant";

describe("assistantConfigSchema", () => {
  it("defaults the assistant tone", () => {
    const parsed = assistantConfigSchema.parse({
      organization_id: "00000000-0000-4000-8000-000000000001",
      name: "Asistente Ventas",
      prompt: "Responde consultas comerciales con foco en calificar oportunidades.",
      fallback_message: "Un asesor del equipo va a ayudarte en breve."
    });

    expect(parsed.tone).toBe("professional");
  });
});
