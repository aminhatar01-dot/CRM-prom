import { describe, expect, it } from "vitest";
import {
  routeAssistant,
  type AssistantRoutingCandidate,
} from "./assistant-router";

const candidates: AssistantRoutingCandidate[] = [
  {
    id: "real-estate",
    name: "Inmobiliaria",
    channelId: "whatsapp",
    industry: "inmobiliaria",
    primaryIntent: "ventas",
    topics: ["propiedades", "alquiler"],
    priority: 60,
  },
  {
    id: "hardware",
    name: "Ferreteria",
    channelId: "whatsapp",
    industry: "ferreteria",
    primaryIntent: "sales",
    topics: ["tornillos", "herramientas", "stock", "precios"],
    knowledgeCategories: ["catalogo"],
    priority: 70,
    isDefault: true,
    capabilities: { canAnswerPrices: true },
  },
  {
    id: "quote",
    name: "Cotizador",
    channelId: "whatsapp",
    primaryIntent: "quote",
    topics: ["cotizaciones", "presupuestos", "pedidos"],
    priority: 75,
    capabilities: {
      canAnswerPrices: true,
      canCreateQuotes: true,
      canSendQuotes: true,
    },
  },
  {
    id: "support",
    name: "Soporte",
    channelId: "all",
    primaryIntent: "support",
    topics: ["problemas", "garantia", "fallas"],
    priority: 80,
  },
];

describe("assistant router", () => {
  it("routes a product price question to the configured hardware assistant", () => {
    const result = routeAssistant({
      candidates,
      channel: "whatsapp",
      message: "¿Que precio tienen los tornillos y hay stock?",
      relevantKnowledgeCategories: ["catalogo"],
    });
    expect(result?.assistantId).toBe("hardware");
    expect(result?.detectedIntent).toBe("price");
  });

  it("routes a multi-item quote to a quote-capable assistant", () => {
    const result = routeAssistant({
      candidates,
      channel: "whatsapp",
      message: "Cotizame 20 unidades y armame un presupuesto",
      lastAssistantId: "hardware",
    });
    expect(result?.assistantId).toBe("quote");
    expect(result?.switchedAssistant).toBe(true);
  });

  it("keeps the previous assistant for a short continuation", () => {
    expect(
      routeAssistant({
        candidates,
        channel: "whatsapp",
        message: "Si, veinte",
        lastAssistantId: "quote",
        previousIntent: "quote",
        isContinuation: true,
      })?.assistantId,
    ).toBe("quote");
  });

  it("does not route a quote to assistants without quote capability", () => {
    const generalOnly: AssistantRoutingCandidate[] = [
      {
        id: "general",
        name: "General",
        channelId: "whatsapp",
        isDefault: true,
        priority: 50,
      },
    ];
    expect(
      routeAssistant({
        candidates: generalOnly,
        channel: "whatsapp",
        message: "Cotizame 20 unidades",
      }),
    ).toBeNull();
  });

  it("records candidate scores and reasons for audit logs", () => {
    const result = routeAssistant({
      candidates,
      channel: "whatsapp",
      message: "Cuanto sale el taladro",
    });
    expect(
      result?.scores.find((score) => score.assistantId === "hardware")?.reasons,
    ).toContain("Puede responder precios");
    expect(result?.reason).toBeTruthy();
  });

  it("does not use a real-estate assistant for a hardware conversation", () => {
    expect(
      routeAssistant({
        candidates,
        channel: "whatsapp",
        message: "Necesito una amoladora y herramientas",
      })?.assistantId,
    ).toBe("hardware");
  });

  it("switches assistants when the configured topic changes", () => {
    const result = routeAssistant({
      candidates,
      channel: "whatsapp",
      message: "Tengo un problema con la garantia",
      lastAssistantId: "hardware",
    });
    expect(result?.assistantId).toBe("support");
  });

  it("keeps the last assistant when there is no clear change and no stronger match", () => {
    const withoutDefault = candidates.map((candidate) => ({
      ...candidate,
      isDefault: false,
    }));
    expect(
      routeAssistant({
        candidates: withoutDefault,
        channel: "whatsapp",
        message: "Gracias, contame mas",
        lastAssistantId: "hardware",
      })?.assistantId,
    ).toBe("hardware");
  });
});
