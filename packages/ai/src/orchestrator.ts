import type { AIContext, AssistantConfig } from "./assistant";
import { classifyConversationIntent, type ConversationIntent } from "./conversation-intent";
import { OpenAIResponsesClient, sanitizeAIText, type AIUsage } from "./openai-client";

export type AIOrchestratorConfig = {
  apiKey?: string;
  model?: string;
  temperature?: number;
  demoMode?: boolean;
  fetcher?: typeof fetch;
};

export type AIOrchestratorResult = {
  output: string;
  mode: "demo" | "openai" | "policy";
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
    const intent = context.conversationIntent ?? classifyConversationIntent(context.messages);
    const historyMessages = ["short_answer", "search_continuation"].includes(intent.type)
      ? context.messages.slice(-12)
      : intent.type === "simple_greeting"
        ? []
        : context.messages.slice(-1);
    const history = historyMessages
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
      `Intencion conversacional: ${intent.type}`,
      this.intentInstruction(intent),
      person
        ? `Persona (${person.kind}): ${person.name}; email=${person.email ?? "n/a"}; telefono=${person.phone ?? "n/a"}; empresa=${person.company ?? "n/a"}; estado=${person.status ?? "n/a"}; notas=${person.notes ?? "n/a"}`
        : "Persona: desconocida",
      `Reglas: ${assistant.rules ?? "Sin reglas adicionales."}`,
      `Smart Tags actuales:\n${smartTags || "Sin Smart Tags asignados."}`,
      `Variables conocidas:\n${variables || "Sin variables extraidas."}`,
      `Base de conocimiento interna:\n${knowledge || "Sin informacion interna relevante para esta consulta."}`,
      `Herramientas disponibles (solo listar, no ejecutar automaticamente):\n${tools || "Sin herramientas externas disponibles."}`,
      `Historial util para esta intencion:\n${history || (intent.hasPriorConversation ? "Existe una busqueda previa, pero sus detalles se omiten para no arrastrarla automaticamente." : "Sin mensajes previos.")}`,
      `Ultimo mensaje inbound: ${sanitizeAIText([...context.messages].reverse().find((message) => message.direction === "inbound")?.body ?? "Sin mensaje inbound.", 1_000)}`,
      `Entrada del operador: ${context.userInput ?? "Sugerir la proxima respuesta."}`
    ].join("\n\n");
  }

  async generateReply(context: AIContext): Promise<AIOrchestratorResult> {
    const intent = context.conversationIntent ?? classifyConversationIntent(context.messages);
    const inputText = this.buildContext(context);
    const input = {
      instructions: this.systemPrompt(context.assistant),
      context: inputText,
      conversation_intent: intent.type
    };

    if (intent.type === "simple_greeting") {
      return {
        output: this.greetingReply(intent),
        mode: "policy",
        model: "conversation-policy-v1",
        input,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        sources: [],
        knowledgeSufficient: true
      };
    }

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
      knowledgeSufficient: !intent.requiresKnowledge || (context.knowledge ?? []).length > 0
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
      "Redacta un mensaje final listo para enviar por WhatsApp, breve, natural y especifico para el ultimo mensaje recibido.",
      "Usa el nombre de la persona solo cuando suene natural; no saludes igual en cada respuesta si ya hay una conversacion iniciada.",
      "No repitas frases textuales de respuestas anteriores; varia la redaccion y responde la consulta concreta.",
      "Respeta la intencion conversacional indicada. Un saludo simple nunca habilita listar propiedades ni retomar detalles anteriores por cuenta propia.",
      "Si existe una busqueda previa y el mensaje actual es solo un saludo, pregunta brevemente si desea continuarla o iniciar una consulta nueva.",
      "Una respuesta corta a tu pregunta anterior, como 'Alquilar', si es continuidad y debe usar el historial util.",
      "Consulta inventario solo cuando la intencion sea inventory_query y usa exclusivamente propiedades presentes en la Base de conocimiento.",
      "Haz como maximo una pregunta de avance comercial y que sea la mas util segun lo que falte: operacion, zona, presupuesto, fecha o preferencia.",
      "Si falta informacion de negocio, pide exactamente el dato faltante o deriva a revision humana, sin respuestas genericas.",
      "Evita markdown innecesario, listas largas y abuso de negritas en WhatsApp.",
      "No digas que eres una IA salvo que el prompt del asistente lo pida."
    ].join("\n");
  }

  private demoReply(context: AIContext) {
    const personName = context.person?.name ?? "ahi";
    const lastInbound = [...context.messages].reverse().find((message) => message.direction === "inbound");
    const intent = context.conversationIntent ?? classifyConversationIntent(context.messages);
    if (intent.type === "simple_greeting") return this.greetingReply(intent);
    if (intent.type === "short_answer" && /alquil/i.test(intent.latestInbound)) {
      return "Perfecto, buscamos para alquilar. ¿En qué zona te gustaría buscar?";
    }
    const source = context.knowledge?.[0];
    if (intent.type === "inventory_query") {
      return source
        ? `Tenemos esta opcion disponible segun nuestro inventario: ${sanitizeAIText(source.content, 320)}`
        : "No encuentro propiedades disponibles confirmadas para mostrarte ahora. ¿Buscás alquilar o comprar y en qué zona?";
    }
    const anchor = source
      ? `Segun nuestra informacion interna: ${sanitizeAIText(source.content, 260)}`
      : "No encontre informacion interna suficiente para confirmar ese dato. Puedo pedirle a una persona del equipo que lo valide.";

    return `Hola ${personName}, ${lastInbound ? `vi tu mensaje sobre "${sanitizeAIText(lastInbound.body, 180)}". ` : ""}${anchor}`;
  }

  private intentInstruction(intent: ConversationIntent) {
    const instructions: Record<ConversationIntent["type"], string> = {
      simple_greeting: "Responder solo con un saludo breve y una pregunta inicial. No mencionar propiedades, zonas ni detalles del historial.",
      new_query: "Tratar el mensaje como una consulta nueva y usar solo los datos pertinentes a esa consulta.",
      search_continuation: "Continuar la busqueda previa usando el historial y pedir un unico dato faltante.",
      short_answer: "Interpretar el mensaje como respuesta a la ultima pregunta outbound y continuar desde ella.",
      inventory_query: "Usar el inventario RAG real; no listar ni describir propiedades ausentes de las fuentes.",
      ambiguous: "Pedir una aclaracion breve sin asumir operacion, zona ni propiedad."
    };
    return `Politica de respuesta: ${instructions[intent.type]}`;
  }

  private greetingReply(intent: ConversationIntent) {
    if (intent.hasPriorConversation) {
      return "¡Hola! ¿Querés continuar con la búsqueda anterior o preferís iniciar una consulta nueva?";
    }
    const greetings = [
      "¡Hola! ¿Cómo estás? ¿Buscás alquilar, comprar o consultar por alguna propiedad en particular?",
      "¡Hola! Contame, ¿estás buscando alquilar, comprar o tenés una propiedad puntual para consultar?",
      "¡Buenas! ¿Te ayudo a buscar una propiedad para alquilar, comprar o querés consultar por una en particular?"
    ];
    const key = [...intent.latestInbound].reduce((total, character) => total + character.charCodeAt(0), 0);
    return greetings[key % greetings.length] ?? greetings[0];
  }
}
