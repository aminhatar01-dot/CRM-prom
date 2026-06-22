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
  it("builds CRM context with assistant, person and message history", () => {
    const orchestrator = new AIOrchestrator({ demoMode: true });
    const built = orchestrator.buildContext(context);

    expect(built).toContain("Asistente: Ventas");
    expect(built).toContain("Persona (lead): Ana Torres");
    expect(built).toContain("Hola, quiero conocer precios.");
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
      demoMode: false,
      fetcher
    });

    const result = await orchestrator.generateReply(context);

    expect(result.mode).toBe("openai");
    expect(result.output).toBe("Respuesta sugerida");
    expect(result.usage.totalTokens).toBe(92);
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
