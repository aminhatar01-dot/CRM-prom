import { describe, expect, it } from "vitest";
import { routeAssistant, type AssistantRoutingCandidate } from "./assistant-router";

const candidates: AssistantRoutingCandidate[] = [
  { id: "real-estate", name: "Inmobiliaria", channelId: "whatsapp", industry: "inmobiliaria", primaryIntent: "ventas", topics: ["propiedades", "alquiler"], priority: 60 },
  { id: "hardware", name: "Ferreteria", channelId: "whatsapp", industry: "ferreteria", primaryIntent: "cotizaciones", topics: ["tornillos", "herramientas", "stock", "precios"], knowledgeCategories: ["catalogo"], priority: 70, isDefault: true },
  { id: "support", name: "Soporte", channelId: "all", primaryIntent: "support", topics: ["problemas", "garantia", "fallas"], priority: 80 }
];

describe("assistant router", () => {
  it("routes a product price question to the configured hardware assistant", () => {
    const result = routeAssistant({ candidates, channel: "whatsapp", message: "¿Que precio tienen los tornillos y hay stock?", relevantKnowledgeCategories: ["catalogo"] });
    expect(result?.assistantId).toBe("hardware");
    expect(result?.detectedIntent).toBe("quote");
  });

  it("does not use a real-estate assistant for a hardware conversation", () => {
    expect(routeAssistant({ candidates, channel: "whatsapp", message: "Necesito una amoladora y herramientas" })?.assistantId).toBe("hardware");
  });

  it("switches assistants when the configured topic changes", () => {
    const result = routeAssistant({ candidates, channel: "whatsapp", message: "Tengo un problema con la garantia", lastAssistantId: "hardware" });
    expect(result?.assistantId).toBe("support");
  });

  it("keeps the last assistant when there is no clear change and no stronger match", () => {
    const withoutDefault = candidates.map((candidate) => ({ ...candidate, isDefault: false }));
    expect(routeAssistant({ candidates: withoutDefault, channel: "whatsapp", message: "Gracias, contame mas", lastAssistantId: "hardware" })?.assistantId).toBe("hardware");
  });
});
