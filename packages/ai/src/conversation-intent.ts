import type { AIMessageContext } from "./assistant";

export const conversationIntentTypes = [
  "simple_greeting",
  "new_query",
  "search_continuation",
  "short_answer",
  "inventory_query",
  "ambiguous"
] as const;

export type ConversationIntentType = (typeof conversationIntentTypes)[number];

export type ConversationIntent = {
  type: ConversationIntentType;
  latestInbound: string;
  previousOutbound: string | null;
  hasPriorConversation: boolean;
  requiresKnowledge: boolean;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[!?.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyConversationIntent(messages: AIMessageContext[]): ConversationIntent {
  let inboundIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.direction === "inbound") {
      inboundIndex = index;
      break;
    }
  }
  const latestInbound = inboundIndex >= 0 ? messages[inboundIndex]?.body ?? "" : "";
  const normalized = normalize(latestInbound);
  const priorMessages = inboundIndex > 0 ? messages.slice(0, inboundIndex) : [];
  const previousOutbound = [...priorMessages].reverse().find((message) => message.direction === "outbound")?.body ?? null;
  const normalizedPrevious = normalize(previousOutbound ?? "");
  const hasPriorConversation = priorMessages.some((message) => normalize(message.body).length > 0);

  const simpleGreeting = /^(hola|buen dia|buenos dias|buenas|buenas tardes|buenas noches|hey|holi|que tal|como estas)$/.test(normalized);
  if (simpleGreeting) {
    return { type: "simple_greeting", latestInbound, previousOutbound, hasPriorConversation, requiresKnowledge: false };
  }

  const inventoryQuery = /(que|cuales|mostrar|ver|tenes|tienen|hay).*(propiedad|departamento|casa|terreno|inmueble)|disponibilidad|inventario|propiedades disponibles/.test(normalized);
  if (inventoryQuery) {
    return { type: "inventory_query", latestInbound, previousOutbound, hasPriorConversation, requiresKnowledge: true };
  }

  const words = normalized.split(" ").filter(Boolean);
  const previousWasQuestion = /[?]/.test(previousOutbound ?? "")
    || /(alquilar|comprar|zona|dormitorio|presupuesto|visita|cuando|cual|que)/.test(normalizedPrevious);
  if (words.length > 0 && words.length <= 5 && previousWasQuestion) {
    return { type: "short_answer", latestInbound, previousOutbound, hasPriorConversation, requiresKnowledge: false };
  }

  const continuation = /^(si|no|tambien|prefiero|esa|ese|la anterior|el anterior|me interesa|quiero esa|dale|perfecto)\b/.test(normalized)
    || /(sigamos|continuar|retomar|esa propiedad|ese departamento|esa casa)/.test(normalized);
  if (continuation) {
    return { type: "search_continuation", latestInbound, previousOutbound, hasPriorConversation, requiresKnowledge: false };
  }

  const realEstateQuery = /(alquil|compr|vend|propiedad|departamento|casa|terreno|inmueble|dormitorio|ambiente|zona|presupuesto|visita|precio|valor)/.test(normalized);
  if (realEstateQuery) {
    return {
      type: "new_query",
      latestInbound,
      previousOutbound,
      hasPriorConversation,
      requiresKnowledge: /(precio|valor|disponib|cuanto cuesta|propiedad especifica)/.test(normalized)
    };
  }

  return { type: "ambiguous", latestInbound, previousOutbound, hasPriorConversation, requiresKnowledge: false };
}
