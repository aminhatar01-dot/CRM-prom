import { describe, expect, it } from "vitest";
import { agentConfigSchema, agentPlaybooksSchema, buildAgentRuntime } from "./agent-config";

const config = agentConfigSchema.parse({
  agent_name: "Luna",
  role: "asesora comercial",
  industry: "concesionaria de automoviles",
  business_description: "Venta de vehiculos nuevos y usados.",
  sells: "automoviles",
  services: "financiacion y postventa",
  products: "sedanes y utilitarios",
  primary_goal: "Conseguir reuniones de venta",
  formality: "close",
  response_length: "very_short",
  emoji_usage: "never",
  commercial_pace: "consultative",
  communication_style: "friendly",
  always_ask: ["modelo de interes", "presupuesto"],
  never_invent: ["precio", "stock"],
  human_topics: ["reclamos legales"],
  create_task_when: ["el cliente pida seguimiento"],
  create_opportunity_when: ["confirme presupuesto"],
  create_appointment_when: ["quiera una prueba de manejo"],
  pause_ai_when: ["solicite una persona"],
  auto_reply_when: ["la consulta sea general"],
  draft_only_when: ["pregunte por financiacion especial"],
  knowledge_topics: ["catalogo", "precios", "stock"]
});

describe("agent visual configuration", () => {
  it("generates an internal multi-industry prompt without technical input", () => {
    const result = buildAgentRuntime(config, []);

    expect(result.prompt).toContain("concesionaria de automoviles");
    expect(result.prompt).toContain("asesora comercial");
    expect(result.prompt).toContain("muy breves");
    expect(result.rules).toContain("Nunca inventar: precio");
    expect(result.objective).toBe("Conseguir reuniones de venta");
  });

  it("adds editable playbooks as context without executing actions", () => {
    const playbooks = agentPlaybooksSchema.parse([{
      key: "first_contact",
      name: "Primer contacto",
      instructions: "Preguntar modelo y uso previsto antes de ofrecer opciones.",
      enabled: true
    }]);
    const result = buildAgentRuntime(config, playbooks);

    expect(result.prompt).toContain("Primer contacto");
    expect(result.prompt).toContain("Preguntar modelo");
    expect(result.prompt).not.toContain("ejecuta automaticamente");
  });

  it("rejects oversized or invalid visual configuration", () => {
    expect(agentConfigSchema.safeParse({ ...config, role: "" }).success).toBe(false);
    expect(agentPlaybooksSchema.safeParse([{ key: "industry_template", name: "X", instructions: "Prueba", enabled: true }]).success).toBe(false);
  });
});
