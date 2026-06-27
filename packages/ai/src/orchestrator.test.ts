import { describe, expect, it, vi } from "vitest";
import type { AIContext } from "./assistant";
import { assistantConfigSchema } from "./assistant";
import { AIOrchestrator } from "./orchestrator";

const assistant = assistantConfigSchema.parse({
  organization_id: "00000000-0000-4000-8000-000000000001",
  name: "Ventas",
  description: "Asistente comercial",
  prompt: "Responde como asesor comercial y pide el siguiente dato necesario.",
  objective: "Calificar oportunidades",
  tone: "friendly",
  rules: "No inventar precios",
  fallback_message: "Un asesor va a ayudarte.",
  active: true,
  channel_id: "whatsapp",
  auto_reply_enabled: false
});

const context: AIContext = {
  organizationName: "Demo CRM PRO AI",
  assistant,
  conversation: {
    id: "00000000-0000-4000-8000-000000000301",
    channel: "whatsapp",
    status: "abierta",
    ai_status: "human"
  },
  person: {
    kind: "lead",
    name: "Ana Torres",
    email: "ana@example.com",
    phone: "+54911",
    company: "Torres Propiedades",
    status: "nuevo",
    notes: "Quiere demo"
  },
  messages: [
    {
      direction: "inbound",
      body: "Hola, quiero conocer precios.",
      channel: "whatsapp",
      status: "delivered",
      created_at: "2026-06-15T20:00:00Z"
    }
  ]
};

describe("AIOrchestrator", () => {
  it("answers a simple greeting naturally without listing properties", async () => {
    const orchestrator = new AIOrchestrator({ demoMode: true });
    const result = await orchestrator.generateReply({
      ...context,
      messages: [{ ...context.messages[0], body: "Hola" }]
    });

    expect(result.mode).toBe("policy");
    expect(result.output).toMatch(/alquilar|comprar/i);
    expect(result.output).not.toMatch(/departamento|Roldan|dormitorio/i);
    expect(result.knowledgeSufficient).toBe(true);
  });

  it("does not drag prior property details into a later greeting", async () => {
    const orchestrator = new AIOrchestrator({ demoMode: true });
    const messages: AIContext["messages"] = [
      { ...context.messages[0], body: "Busco un departamento en Roldan" },
      { ...context.messages[0], direction: "outbound", body: "Tengo uno de un dormitorio. ¿Buscas alquilar o comprar?" },
      { ...context.messages[0], body: "Hola" }
    ];
    const greetingContext = { ...context, messages };

    expect(orchestrator.buildContext(greetingContext)).not.toContain("un dormitorio");
    const result = await orchestrator.generateReply(greetingContext);
    expect(result.output).toContain("continuar");
    expect(result.output).not.toMatch(/Roldan|dormitorio/i);
  });

  it("continues from a short answer to the previous commercial question", async () => {
    const orchestrator = new AIOrchestrator({ demoMode: true });
    const result = await orchestrator.generateReply({
      ...context,
      messages: [
        { ...context.messages[0], direction: "outbound", body: "¿Buscas alquilar o comprar?" },
        { ...context.messages[0], body: "Alquilar" }
      ]
    });

    expect(result.output).toMatch(/alquilar/i);
    expect(result.output).toMatch(/zona/i);
  });

  it("uses real knowledge for inventory questions and does not invent without it", async () => {
    const orchestrator = new AIOrchestrator({ demoMode: true });
    const inventoryContext: AIContext = {
      ...context,
      messages: [{ ...context.messages[0], body: "¿Qué propiedades tienen?" }],
      knowledge: [{
        documentId: "00000000-0000-4000-8000-000000000702",
        title: "Inventario",
        category: "propiedades",
        content: "Casa de dos dormitorios en Funes, disponible para alquiler.",
        score: 0.91
      }]
    };

    const withInventory = await orchestrator.generateReply(inventoryContext);
    expect(withInventory.output).toContain("Casa de dos dormitorios en Funes");
    expect(withInventory.knowledgeSufficient).toBe(true);

    const withoutInventory = await orchestrator.generateReply({ ...inventoryContext, knowledge: [] });
    expect(withoutInventory.output).not.toMatch(/Roldan|un dormitorio/i);
    expect(withoutInventory.output).toContain("No encuentro propiedades disponibles confirmadas");
    expect(withoutInventory.knowledgeSufficient).toBe(false);
  });

  it("varies greeting wording while keeping the same commercial intent", async () => {
    const orchestrator = new AIOrchestrator({ demoMode: true });
    const hola = await orchestrator.generateReply({ ...context, messages: [{ ...context.messages[0], body: "Hola" }] });
    const buenDia = await orchestrator.generateReply({ ...context, messages: [{ ...context.messages[0], body: "Buen dia" }] });

    expect(hola.output).not.toBe(buenDia.output);
    expect(hola.output).toMatch(/alquilar|comprar/i);
    expect(buenDia.output).toMatch(/alquilar|comprar/i);
  });

  it("builds CRM context with assistant, person and message history", () => {
    const orchestrator = new AIOrchestrator({ demoMode: true });
    const built = orchestrator.buildContext(context);

    expect(built).toContain("Asistente: Ventas");
    expect(built).toContain("Persona (lead): Ana Torres");
    expect(built).toContain("Hola, quiero conocer precios.");
    expect(built).toContain("Ultimo mensaje inbound: Hola, quiero conocer precios.");
  });

  it("lists available tools in context without executing them", () => {
    const orchestrator = new AIOrchestrator({ demoMode: true });
    const built = orchestrator.buildContext({
      ...context,
      availableTools: [
        {
          id: "00000000-0000-4000-8000-000000000911",
          name: "Buscar Google Sheets demo",
          type: "google_sheets",
          description: "Busca filas por texto",
          input_schema: { query: "string" }
        }
      ]
    });

    expect(built).toContain("Herramientas disponibles");
    expect(built).toContain("Buscar Google Sheets demo");
    expect(built).toContain("no ejecutar automaticamente");
  });

  it("adds relevant RAG context and exposes internal sources separately", async () => {
    const orchestrator = new AIOrchestrator({ demoMode: true });
    const ragContext: AIContext = {
      ...context,
      knowledge: [
        {
          documentId: "00000000-0000-4000-8000-000000000701",
          title: "Planes comerciales",
          category: "ventas",
          content: "El plan inicial incluye cinco usuarios.",
          score: 0.88
        }
      ]
    };

    expect(orchestrator.buildContext(ragContext)).toContain("El plan inicial incluye cinco usuarios.");
    const result = await orchestrator.generateReply(ragContext);
    expect(result.knowledgeSufficient).toBe(true);
    expect(result.output).toContain("cinco usuarios");
    expect(result.sources).toEqual([
      expect.objectContaining({ title: "Planes comerciales", score: 0.88 })
    ]);
  });

  it("marks replies without RAG evidence as insufficient", async () => {
    const orchestrator = new AIOrchestrator({ demoMode: true });
    const result = await orchestrator.generateReply(context);

    expect(result.knowledgeSufficient).toBe(false);
    expect(result.sources).toEqual([]);
    expect(result.output).toContain("No encontre informacion interna suficiente");
    expect(orchestrator.buildContext(context)).toContain("Sin informacion interna relevante");
  });

  it("falls back to demo mode without an API key", async () => {
    const orchestrator = new AIOrchestrator();
    const result = await orchestrator.generateReply(context);

    expect(result.mode).toBe("demo");
    expect(result.output).toContain("Ana Torres");
  });

  it("calls OpenAI Responses API when an API key exists", async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: "resp_test",
        output_text: "Respuesta sugerida",
        usage: { input_tokens: 80, output_tokens: 12, total_tokens: 92 }
      })
    });
    const orchestrator = new AIOrchestrator({
      apiKey: "sk-test",
      model: "gpt-test",
      temperature: 0.7,
      demoMode: false,
      fetcher
    });

    const result = await orchestrator.generateReply(context);

    expect(result.mode).toBe("openai");
    expect(result.output).toBe("Respuesta sugerida");
    expect(result.usage.totalTokens).toBe(92);
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("\"temperature\":0.7")
      }),
    );
  });
});
