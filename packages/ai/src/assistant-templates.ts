import type { AgentConfig, AgentPlaybook } from "./agent-config";

export type AssistantTemplate = {
  key: string;
  name: string;
  description: string;
  config: Partial<AgentConfig>;
  playbookKeys: AgentPlaybook["key"][];
};

export const assistantTemplates: AssistantTemplate[] = [
  template(
    "sales-prices",
    "Ventas y precios",
    "Responde consultas comerciales y precios confirmados.",
    "asesor de ventas y precios",
    "sales",
    ["ventas", "productos", "precios"],
    {
      can_answer_prices: true,
      can_auto_send_simple_prices: true,
      quote_knowledge_categories: ["catalogo", "productos", "precios"],
    },
    ["first_contact", "sales", "follow_up"],
  ),
  template(
    "quote",
    "Cotizador",
    "Reune items y prepara presupuestos verificables.",
    "especialista en cotizaciones",
    "quote",
    ["precios", "presupuestos", "stock", "pedidos"],
    {
      can_answer_prices: true,
      can_create_quotes: true,
      can_send_quotes: true,
      quote_requires_human_approval: true,
      quote_knowledge_categories: ["catalogo", "productos", "precios"],
    },
    ["quote", "sales", "follow_up"],
  ),
  template(
    "support",
    "Soporte",
    "Resuelve incidencias y reclamos sin mezclar ventas.",
    "especialista de soporte",
    "support",
    ["soporte", "problemas", "reclamos", "garantias"],
    { excluded_topics: ["cotizaciones", "cobranza"] },
    ["support", "after_sales"],
  ),
  template(
    "scheduling",
    "Agenda y turnos",
    "Coordina fechas, horarios, turnos y entregas.",
    "coordinador de agenda",
    "scheduling",
    ["turnos", "agenda", "entregas", "horarios"],
    {},
    ["scheduling", "reservations"],
  ),
  template(
    "collections",
    "Cobranza",
    "Atiende facturas, vencimientos y pagos con derivacion segura.",
    "asistente de cobranza",
    "collections",
    ["pagos", "facturas", "deudas", "vencimientos"],
    {
      human_topics: ["acuerdos de pago", "datos bancarios", "reclamos legales"],
    },
    ["collections"],
  ),
  template(
    "after-sales",
    "Postventa",
    "Acompana entregas, cambios y devoluciones.",
    "especialista de postventa",
    "after_sales",
    ["postventa", "devoluciones", "cambios", "entregas"],
    {},
    ["after_sales", "support"],
  ),
  template(
    "general",
    "Atencion general",
    "Clasifica consultas y cubre temas generales.",
    "asistente de atencion general",
    "general",
    ["consultas generales"],
    { is_default: true },
    ["first_contact", "follow_up"],
  ),
];

function template(
  key: string,
  name: string,
  description: string,
  role: string,
  primary_intent: string,
  topics: string[],
  capabilities: Partial<AgentConfig>,
  playbookKeys: AgentPlaybook["key"][],
): AssistantTemplate {
  return {
    key,
    name,
    description,
    config: {
      agent_name: name,
      role,
      primary_goal: description,
      primary_intent,
      topics,
      excluded_topics: [],
      ...capabilities,
    },
    playbookKeys,
  };
}

export function getAssistantTemplate(key?: string | null) {
  return assistantTemplates.find((item) => item.key === key) ?? null;
}
