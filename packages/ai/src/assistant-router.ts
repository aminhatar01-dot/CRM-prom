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
  automationPreferred?: boolean;
  capabilities?: {
    canAnswerPrices?: boolean;
    canCreateQuotes?: boolean;
    canSendQuotes?: boolean;
  };
};

export type AssistantRoutingDecision = {
  assistantId: string;
  detectedIntent: string;
  confidence: number;
  reason: string;
  previousAssistantId: string | null;
  switchedAssistant: boolean;
  usedDefault: boolean;
  scores: Array<{
    assistantId: string;
    name: string;
    score: number;
    reasons: string[];
  }>;
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function words(value: string) {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((word) => word.length > 2),
  );
}

export function detectFunctionalIntent(message: string) {
  const text = normalize(message);
  const intents: Array<[string, RegExp]> = [
    [
      "support",
      /\b(problema|error|falla|soporte|reclamo|garantia|roto|mal pedido|llego mal|no funciona)\b/,
    ],
    [
      "quote",
      /\b(cotiza|cotizacion|presupuesto|armame (un )?pedido|pedido de)\b|\b\d+\s+(unidades?|cajas?|packs?)\b/,
    ],
    [
      "price",
      /\b(precio|costo|cuanto sale|cuanto cuesta|valor|stock|disponib)\b/,
    ],
    [
      "scheduling",
      /\b(turno|cita|agenda|reserva|horario|visita|coordinar|entrega|retiro|logistica)\b/,
    ],
    ["collections", /\b(pago|deuda|factura|cobro|cuota|vencimiento)\b/],
    ["after_sales", /\b(postventa|devolucion|cambio|seguimiento)\b/],
    [
      "sales",
      /\b(comprar|alquilar|contratar|quiero|busco|interesa|producto|servicio)\b/,
    ],
  ];
  return intents.find(([, pattern]) => pattern.test(text))?.[0] ?? "general";
}

export function routeAssistant({
  candidates,
  channel,
  message,
  lastAssistantId,
  previousIntent,
  isContinuation = false,
  relevantKnowledgeCategories = [],
}: {
  candidates: AssistantRoutingCandidate[];
  channel: string;
  message: string;
  lastAssistantId?: string | null;
  previousIntent?: string | null;
  isContinuation?: boolean;
  relevantKnowledgeCategories?: string[];
}): AssistantRoutingDecision | null {
  if (candidates.length === 0) return null;
  const detectedIntent = detectFunctionalIntent(message);
  const messageWords = words(message);
  const categoryWords = words(relevantKnowledgeCategories.join(" "));

  const scored = candidates
    .map((candidate) => {
      const reasons: string[] = [];
      const configuredChannel = normalize(candidate.channelId ?? "all");
      if (
        !["", "all", "todos", normalize(channel)].includes(configuredChannel)
      ) {
        return {
          assistantId: candidate.id,
          name: candidate.name,
          score: -1000,
          matches: 0,
          reasons: ["Canal incompatible"],
        };
      }
      let score = configuredChannel === normalize(channel) ? 30 : 12;
      let matches = 0;
      const excluded = words((candidate.excludedTopics ?? []).join(" "));
      if ([...excluded].some((word) => messageWords.has(word))) {
        score -= 100;
        reasons.push("Tema excluido");
      }

      const capabilities = candidate.capabilities ?? {};
      if (detectedIntent === "price") {
        if (capabilities.canAnswerPrices) {
          score += 55;
          matches += 1;
          reasons.push("Puede responder precios");
        } else {
          score -= 70;
          reasons.push("Sin capacidad de precios");
        }
      }
      if (detectedIntent === "quote") {
        if (capabilities.canCreateQuotes) {
          score += 65;
          matches += 1;
          reasons.push("Puede crear cotizaciones");
        } else {
          score -= 80;
          reasons.push("Sin capacidad de cotizar");
        }
      }

      const primaryWords = words(candidate.primaryIntent ?? "");
      if (
        primaryWords.has(detectedIntent) ||
        normalize(candidate.primaryIntent ?? "") === detectedIntent
      ) {
        score += 35;
        matches += 1;
        reasons.push("Intencion principal coincidente");
      }
      const searchable = words(
        [
          candidate.role,
          candidate.industry,
          candidate.primaryIntent,
          ...(candidate.topics ?? []),
        ]
          .filter(Boolean)
          .join(" "),
      );
      for (const word of messageWords) {
        if (searchable.has(word)) {
          score += 12;
          matches += 1;
          reasons.push(`Tema coincidente: ${word}`);
        }
      }
      const knowledgeWords = words(
        (candidate.knowledgeCategories ?? []).join(" "),
      );
      for (const word of categoryWords) {
        if (knowledgeWords.has(word)) {
          score += 8;
          matches += 1;
          reasons.push(`Categoria de conocimiento: ${word}`);
        }
      }
      if (candidate.id === lastAssistantId) {
        const continuityBoost =
          isContinuation || detectedIntent === previousIntent
            ? 35
            : matches > 0
              ? 6
              : 8;
        score += continuityBoost;
        reasons.push(
          isContinuation
            ? "Continuidad con el asistente anterior"
            : "Asistente usado recientemente",
        );
      }
      if (candidate.automationPreferred) {
        score += 8;
        reasons.push("Referenciado por automatizacion activa");
      }
      if (candidate.isDefault) {
        score += 10;
        reasons.push("Asistente por defecto");
      }
      score += Math.max(0, Math.min(candidate.priority ?? 50, 100)) / 10;
      return {
        assistantId: candidate.id,
        name: candidate.name,
        score,
        matches,
        reasons,
      };
    })
    .sort((left, right) => right.score - left.score);

  const winner = scored[0];
  if (!winner || winner.score < 0) return null;
  const second = scored[1];
  const gap = second ? winner.score - second.score : winner.score;
  const confidence = Math.max(
    0.1,
    Math.min(0.99, 0.45 + winner.matches * 0.12 + Math.max(0, gap) / 100),
  );
  const winnerCandidate = candidates.find(
    (candidate) => candidate.id === winner.assistantId,
  )!;
  const reason =
    winner.matches > 0
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
    previousAssistantId: lastAssistantId ?? null,
    switchedAssistant: Boolean(
      lastAssistantId && lastAssistantId !== winner.assistantId,
    ),
    usedDefault: Boolean(winnerCandidate.isDefault && winner.matches === 0),
    scores: scored.map(({ assistantId, name, score, reasons }) => ({
      assistantId,
      name,
      score: Number(score.toFixed(2)),
      reasons,
    })),
  };
}
