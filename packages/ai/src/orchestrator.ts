import type { AIContext, AssistantConfig } from "./assistant";

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
};

export class AIOrchestrator {
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly demoMode: boolean;
  private readonly fetcher: typeof fetch;

  constructor(config: AIOrchestratorConfig = {}) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? "gpt-5.5";
    this.demoMode = config.demoMode ?? !config.apiKey;
    this.fetcher = config.fetcher ?? fetch;
  }

  buildContext(context: AIContext) {
    const assistant = context.assistant;
    const person = context.person;
    const conversation = context.conversation;
    const history = context.messages
      .slice(-12)
      .map((message) => `${message.direction.toUpperCase()} [${message.channel}/${message.status}]: ${message.body}`)
      .join("\n");

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

    if (this.demoMode || !this.apiKey) {
      return {
        output: this.demoReply(context),
        mode: "demo",
        model: this.model,
        input
      };
    }

    const response = await this.fetcher("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        input: [
          {
            role: "system",
            content: this.systemPrompt(context.assistant)
          },
          {
            role: "user",
            content: inputText
          }
        ]
      })
    });

    const payload = (await response.json()) as OpenAIResponsePayload;

    if (!response.ok) {
      throw new Error(payload.error?.message ?? "OpenAI response failed.");
    }

    return {
      output: extractOutputText(payload) || context.assistant.fallback_message,
      mode: "openai",
      model: this.model,
      input
    };
  }

  private systemPrompt(assistant: AssistantConfig) {
    return [
      assistant.prompt,
      "Usa solo el contexto CRM entregado.",
      "No inventes datos de presupuesto, disponibilidad ni condiciones.",
      "Redacta una sugerencia lista para que un humano la revise antes de enviar.",
      "No digas que eres una IA salvo que el prompt del asistente lo pida."
    ].join("\n");
  }

  private demoReply(context: AIContext) {
    const personName = context.person?.name ?? "ahi";
    const lastInbound = [...context.messages].reverse().find((message) => message.direction === "inbound");
    const anchor = lastInbound ? `Vi tu mensaje sobre "${lastInbound.body}".` : "Gracias por escribirnos.";

    return `Hola ${personName}, ${anchor} Te comparto una respuesta preliminar y puedo ayudarte a avanzar con el siguiente paso.`;
  }
}

type OpenAIResponsePayload = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      type?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

function extractOutputText(payload: OpenAIResponsePayload) {
  if (payload.output_text) return payload.output_text;

  return payload.output
    ?.flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter(Boolean)
    .join("\n");
}
