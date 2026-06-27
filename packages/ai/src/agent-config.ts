import { z } from "zod";

const textList = z.array(z.string().trim().min(1).max(300)).max(20).default([]);

export const agentConfigSchema = z.object({
  agent_name: z.string().trim().min(2).max(80),
  role: z.string().trim().min(2).max(120),
  industry: z.string().trim().max(120).default(""),
  business_description: z.string().trim().max(1500).default(""),
  sells: z.string().trim().max(1000).default(""),
  services: z.string().trim().max(1000).default(""),
  products: z.string().trim().max(1500).default(""),
  primary_goal: z.string().trim().min(2).max(1000),
  primary_intent: z.string().trim().max(120).default("general"),
  topics: textList,
  excluded_topics: textList,
  knowledge_categories: textList,
  routing_priority: z.number().int().min(0).max(100).default(50),
  is_default: z.boolean().default(false),
  formality: z.enum(["very_informal", "close", "professional", "very_formal"]).default("professional"),
  response_length: z.enum(["very_short", "normal", "detailed"]).default("normal"),
  emoji_usage: z.enum(["never", "low", "normal", "frequent"]).default("low"),
  commercial_pace: z.enum(["calm", "consultative", "commercial", "aggressive"]).default("consultative"),
  communication_style: z.enum(["friendly", "technical", "executive", "premium", "youthful"]).default("friendly"),
  always_ask: textList,
  never_invent: textList,
  human_topics: textList,
  create_task_when: textList,
  create_opportunity_when: textList,
  create_appointment_when: textList,
  pause_ai_when: textList,
  auto_reply_when: textList,
  draft_only_when: textList,
  knowledge_topics: textList
});

export const agentPlaybookSchema = z.object({
  key: z.enum(["first_contact", "follow_up", "sales", "support", "collections", "scheduling", "reservations", "quote", "after_sales"]),
  name: z.string().trim().min(2).max(80),
  instructions: z.string().trim().min(5).max(1200),
  enabled: z.boolean().default(true)
});

export const agentPlaybooksSchema = z.array(agentPlaybookSchema).max(12).default([]);

export type AgentConfig = z.infer<typeof agentConfigSchema>;
export type AgentPlaybook = z.infer<typeof agentPlaybookSchema>;

const labels = {
  formality: {
    very_informal: "muy informal y espontaneo",
    close: "cercano y humano",
    professional: "profesional y claro",
    very_formal: "muy formal y respetuoso"
  },
  responseLength: {
    very_short: "muy breves, de una o dos frases",
    normal: "breves pero completas",
    detailed: "detalladas cuando la consulta lo requiera"
  },
  emoji: {
    never: "no uses emojis",
    low: "usa emojis solo de forma excepcional",
    normal: "puedes usar algun emoji cuando resulte natural",
    frequent: "puedes usar emojis con frecuencia moderada"
  },
  pace: {
    calm: "sin presionar comercialmente",
    consultative: "con enfoque consultivo",
    commercial: "con iniciativa comercial clara",
    aggressive: "con alta iniciativa comercial, sin manipular ni presionar"
  },
  style: {
    friendly: "amigable",
    technical: "tecnica y precisa",
    executive: "ejecutiva y directa",
    premium: "premium y cuidada",
    youthful: "juvenil y dinamica"
  }
} as const;

function list(title: string, values: string[]) {
  return values.length ? `${title}:\n${values.map((value) => `- ${value}`).join("\n")}` : `${title}: sin reglas adicionales.`;
}

export function buildAgentRuntime(config: AgentConfig, playbooks: AgentPlaybook[]) {
  const enabledPlaybooks = playbooks.filter((playbook) => playbook.enabled);
  const prompt = [
    `Eres ${config.agent_name}, ${config.role} de esta empresa.`,
    config.industry ? `El rubro del negocio es: ${config.industry}.` : "",
    config.business_description ? `Descripcion del negocio: ${config.business_description}` : "",
    config.sells ? `La empresa vende: ${config.sells}` : "",
    config.services ? `Servicios ofrecidos: ${config.services}` : "",
    config.products ? `Productos comercializados: ${config.products}` : "",
    `Tu objetivo principal es: ${config.primary_goal}`,
    `Tu intencion principal es: ${config.primary_intent}. Atiendes estos temas: ${config.topics.join(", ") || "consultas generales"}.`,
    config.excluded_topics.length ? `No atiendes estos temas y debes derivarlos: ${config.excluded_topics.join(", ")}.` : "",
    `Comunicate de forma ${labels.formality[config.formality]}, ${labels.style[config.communication_style]} y ${labels.pace[config.commercial_pace]}.`,
    `Las respuestas deben ser ${labels.responseLength[config.response_length]}; ${labels.emoji[config.emoji_usage]}.`,
    "Responde como una persona real, varia la redaccion y pide solamente la informacion necesaria.",
    "Usa datos del CRM y la Base de Conocimiento. Nunca inventes datos del negocio, productos, servicios, precios, disponibilidad ni politicas.",
    enabledPlaybooks.length
      ? `Playbooks disponibles:\n${enabledPlaybooks.map((item) => `- ${item.name}: ${item.instructions}`).join("\n")}`
      : ""
  ].filter(Boolean).join("\n\n");

  const rules = [
    ...config.never_invent.map((value) => `Nunca inventar: ${value}`),
    ...config.always_ask.map((value) => `Pedir cuando corresponda: ${value}`),
    ...config.human_topics.map((value) => `Derivar a humano: ${value}`),
    ...config.create_task_when.map((value) => `Sugerir crear tarea cuando: ${value}`),
    ...config.create_opportunity_when.map((value) => `Sugerir oportunidad cuando: ${value}`),
    ...config.create_appointment_when.map((value) => `Sugerir cita cuando: ${value}`),
    ...config.pause_ai_when.map((value) => `Pausar IA cuando: ${value}`),
    ...config.auto_reply_when.map((value) => `Auto respuesta permitida cuando: ${value}`),
    ...config.draft_only_when.map((value) => `Solo borrador cuando: ${value}`)
  ];

  const tone = config.formality === "very_formal" || config.communication_style === "executive"
    ? "professional"
    : config.formality === "close" || config.communication_style === "friendly"
      ? "warm"
      : "direct";

  return {
    prompt,
    objective: config.primary_goal,
    tone,
    rules,
    contextSummary: [
      list("Informacion a solicitar", config.always_ask),
      list("Temas humanos", config.human_topics),
      list("Base de conocimiento sugerida", config.knowledge_topics)
    ].join("\n\n")
  } as const;
}

export function linesToList(value: string) {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
}
