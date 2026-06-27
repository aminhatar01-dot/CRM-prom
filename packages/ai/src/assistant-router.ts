export type AssistantRoutingCandidate = {
  id: string;
  name: string;
  channelId?: string | null;
  role?: string;
  industry?: string;
  primaryIntent?: string;
  topics?: string[];
  excludedTopics?: string[];
  knowledgeCategories?: string[];
  priority?: number;
  isDefault?: boolean;
};

export type AssistantRoutingDecision = {
  assistantId: string;
  detectedIntent: string;
  confidence: number;
  reason: string;
  scores: Array<{ assistantId: string; score: number }>;
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function words(value: string) {
  return new Set(normalize(value).split(" ").filter((word) => word.length > 2));
}

export function detectFunctionalIntent(message: string) {
  const text = normalize(message);
  const intents: Array<[string, RegExp]> = [
    ["quote", /\b(precio|costo|cotiza|presupuesto|stock|disponib|valor)\b/],
    ["support", /\b(problema|error|falla|soporte|reclamo|garantia|ayuda)\b/],
    ["scheduling", /\b(turno|cita|agenda|reserva|horario|visita)\b/],
    ["collections", /\b(pago|deuda|factura|cobro|cuota|vencimiento)\b/],
    ["after_sales", /\b(postventa|devolucion|cambio|seguimiento)\b/],
    ["sales", /\b(comprar|alquilar|contratar|quiero|busco|interesa|producto|servicio)\b/]
  ];
  return intents.find(([, pattern]) => pattern.test(text))?.[0] ?? "general";
}

export function routeAssistant({
  candidates,
  channel,
  message,
  lastAssistantId,
  relevantKnowledgeCategories = []
}: {
  candidates: AssistantRoutingCandidate[];
  channel: string;
  message: string;
  lastAssistantId?: string | null;
  relevantKnowledgeCategories?: string[];
}): AssistantRoutingDecision | null {
  if (candidates.length === 0) return null;
  const detectedIntent = detectFunctionalIntent(message);
  const messageWords = words(message);
  const categoryWords = words(relevantKnowledgeCategories.join(" "));

  const scored = candidates.map((candidate) => {
    const configuredChannel = normalize(candidate.channelId ?? "all");
    if (!["", "all", "todos", normalize(channel)].includes(configuredChannel)) {
      return { assistantId: candidate.id, score: -1000, matches: 0 };
    }
    let score = configuredChannel === normalize(channel) ? 30 : 12;
    let matches = 0;
    const excluded = words((candidate.excludedTopics ?? []).join(" "));
    if ([...excluded].some((word) => messageWords.has(word))) score -= 100;

    const primaryWords = words(candidate.primaryIntent ?? "");
    if (primaryWords.has(detectedIntent) || normalize(candidate.primaryIntent ?? "") === detectedIntent) {
      score += 35;
      matches += 1;
    }
    const searchable = words([
      candidate.role,
      candidate.industry,
      candidate.primaryIntent,
      ...(candidate.topics ?? [])
    ].filter(Boolean).join(" "));
    for (const word of messageWords) {
      if (searchable.has(word)) {
        score += 12;
        matches += 1;
      }
    }
    const knowledgeWords = words((candidate.knowledgeCategories ?? []).join(" "));
    for (const word of categoryWords) {
      if (knowledgeWords.has(word)) {
        score += 8;
        matches += 1;
      }
    }
    if (candidate.id === lastAssistantId) score += matches > 0 ? 6 : 14;
    if (candidate.isDefault) score += 10;
    score += Math.max(0, Math.min(candidate.priority ?? 50, 100)) / 10;
    return { assistantId: candidate.id, score, matches };
  }).sort((left, right) => right.score - left.score);

  const winner = scored[0];
  if (!winner || winner.score < 0) return null;
  const second = scored[1];
  const gap = second ? winner.score - second.score : winner.score;
  const confidence = Math.max(0.1, Math.min(0.99, 0.45 + winner.matches * 0.12 + Math.max(0, gap) / 100));
  const winnerCandidate = candidates.find((candidate) => candidate.id === winner.assistantId)!;
  const reason = winner.matches > 0
    ? `Coincidencia con intencion/temas configurados: ${detectedIntent}.`
    : winnerCandidate.isDefault
      ? "Sin coincidencia concluyente; se uso el asistente por defecto."
      : winner.assistantId === lastAssistantId
        ? "Sin cambio claro de intencion; se mantuvo el ultimo asistente."
        : "Se uso el asistente compatible con mayor prioridad.";

  return {
    assistantId: winner.assistantId,
    detectedIntent,
    confidence: Number(confidence.toFixed(3)),
    reason,
    scores: scored.map(({ assistantId, score }) => ({ assistantId, score: Number(score.toFixed(2)) }))
  };
}
