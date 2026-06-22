import type { AIContext, AssistantConfig } from "./assistant";
import { OpenAIResponsesClient, sanitizeAIText, type AIUsage } from "./openai-client";

export type AIOrchestratorConfig = {
  apiKey?: string;
  model?: string;
  demoMode?: boolean;
  fetcher?: typeof fetch;
};

export type AIOrchestratorResult = {
  output: string;
  mode: "demo" | "openai";
  model: string;
  input: Record<string, unknown>;
  usage: AIUsage;
  responseId?: string;
  sources: Array<{
    documentId: string;
    title: string;
    category: string;
    score: number;
  }>;
  knowledgeSufficient: boolean;
};

export class AIOrchestrator {
  private readonly client: OpenAIResponsesClient;

  constructor(config: AIOrchestratorConfig = {}) {
    this.client = new OpenAIResponsesClient(config);
  }

  buildContext(context: AIContext) {
    const assistant = context.assistant;
    const person = context.person;
    const conversation = context.conversation;
    const history = context.messages
      .slice(-12)
      .map((message) => `${message.direction.toUpperCase()} [${message.channel}/${message.status}]: ${sanitizeAIText(message.body, 2_000)}`)
      .join("\n");
    const tools = (context.availableTools ?? [])
      .map((tool) => `- ${tool.name} (${tool.type}): ${tool.description ?? "Sin descripcion"}; input=${JSON.stringify(tool.input_schema ?? {})}`)
      .join("\n");
    const smartTags = (context.smartTags ?? [])
      .map((tag) => `- ${tag.name}: ${tag.description ?? "sin descripcion"}`)
      .join("\n");
    const variables = (context.variables ?? [])
      .map((variable) => `- ${variable.key} (${variable.name}) = ${JSON.stringify(variable.value)}; confidence=${variable.confidence ?? "n/a"}`)
      .join("\n");
    const knowledge = (context.knowledge ?? [])
      .map(
        (source, index) =>
          `[Fuente ${index + 1}] ${source.title} (${source.category}, similitud=${source.score.toFixed(3)}):\n${sanitizeAIText(source.content, 2_500)}`,
      )
      .join("\n\n");

    return [
      `Organizacion: ${context.organizationName}`,
      `Asistente: ${assistant.name}`,
      `Objetivo: ${assistant.objective ?? "Responder consultas comerciales con precision."}`,
      `Tono: ${assistant.tone}`,
      `Canal: ${conversation?.channel ?? assistant.channel_id ?? "manual"}`,
      `Estado conversacion: ${conversation?.status ?? "sin conversacion"}`,
      `Estado IA: ${conversation?.ai_status ?? "human"}`,
      person
        ? `Persona (${person.kind}): ${person.name}; email=${person.email ?? "n/a"}; telefono=${person.phone ?? "n/a"}; empresa=${person.company ?? "n/a"}; estado=${person.status ?? "n/a"}; notas=${person.notes ?? "n/a"}`
        : "Persona: desconocida",
      `Reglas: ${assistant.rules ?? "Sin reglas adicionales."}`,
      `Smart Tags actuales:\n${smartTags || "Sin Smart Tags asignados."}`,
      `Variables conocidas:\n${variables || "Sin variables extraidas."}`,
      `Base de conocimiento interna:\n${knowledge || "Sin informacion interna relevante para esta consulta."}`,
      `Herramientas disponibles (solo listar, no ejecutar automaticamente):\n${tools || "Sin herramientas externas disponibles."}`,
      `Historial reciente:\n${history || "Sin mensajes previos."}`,
      `Entrada del operador: ${context.userInput ?? "Sugerir la proxima respuesta."}`
    ].join("\n\n");
  }

  async generateReply(context: AIContext): Promise<AIOrchestratorResult> {
    const inputText = this.buildContext(context);
    const input = {
      instructions: this.systemPrompt(context.assistant),
      context: inputText
    };

    const result = await this.client.text({
      instructions: this.systemPrompt(context.assistant),
      input: inputText,
      demo: () => this.demoReply(context)
    });

    return {
      output: result.data || context.assistant.fallback_message,
      mode: result.mode,
      model: result.model,
      input,
      usage: result.usage,
      responseId: result.responseId,
      sources: (context.knowledge ?? []).map(({ documentId, title, category, score }) => ({
        documentId,
        title,
        category,
        score
      })),
      knowledgeSufficient: (context.knowledge ?? []).length > 0
    };
  }

  private systemPrompt(assistant: AssistantConfig) {
    return [
      assistant.prompt,
      "Usa solo el contexto CRM entregado.",
      "Para datos propios del negocio, usa exclusivamente la Base de conocimiento interna.",
      "Si la Base de conocimiento no contiene una respuesta suficiente, expresa incertidumbre y propone validarlo con una persona.",
      "No inventes productos, precios, politicas, horarios, disponibilidad ni condiciones de la empresa.",
      "No menciones identificadores internos ni puntajes de similitud al cliente.",
      "No inventes datos de presupuesto, disponibilidad ni condiciones.",
      "Redacta una sugerencia lista para que un humano la revise antes de enviar.",
      "No digas que eres una IA salvo que el prompt del asistente lo pida."
    ].join("\n");
  }

  private demoReply(context: AIContext) {
    const personName = context.person?.name ?? "ahi";
    const lastInbound = [...context.messages].reverse().find((message) => message.direction === "inbound");
    const source = context.knowledge?.[0];
    const anchor = source
      ? `Segun nuestra informacion interna: ${sanitizeAIText(source.content, 260)}`
      : "No encontre informacion interna suficiente para confirmar ese dato. Puedo pedirle a una persona del equipo que lo valide.";

    return `Hola ${personName}, ${lastInbound ? `vi tu mensaje sobre "${sanitizeAIText(lastInbound.body, 180)}". ` : ""}${anchor}`;
  }
}
