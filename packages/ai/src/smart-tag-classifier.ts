import { z } from "zod";
import { OpenAIResponsesClient, type AIUsage, type OpenAIClientConfig } from "./openai-client";
import type {
  SmartTagClassificationContext,
  SmartTagClassificationResult,
  SmartTagDefinition
} from "./smart-tags";

export type SmartTagClassifierResult = {
  results: SmartTagClassificationResult[];
  mode: "demo" | "openai";
  model: string;
  usage: AIUsage;
  input: Record<string, unknown>;
  responseId?: string;
};

const classificationSchema = z.object({
  results: z.array(
    z.object({
      tagId: z.string().uuid(),
      matched: z.boolean(),
      confidence: z.number().min(0).max(1),
      reason: z.string().min(1).max(500)
    }),
  )
});

export class SmartTagClassifier {
  private readonly client: OpenAIResponsesClient;

  constructor(config: OpenAIClientConfig = {}) {
    this.client = new OpenAIResponsesClient(config);
  }

  async classify(
    tags: SmartTagDefinition[],
    context: SmartTagClassificationContext,
  ): Promise<SmartTagClassifierResult> {
    const input = this.buildInput(tags, context);
    const result = await this.client.structured({
      instructions: [
        "Clasifica el contexto CRM exclusivamente contra las etiquetas entregadas.",
        "No inventes hechos. Devuelve un resultado por cada tagId.",
        "matched solo puede ser true cuando exista evidencia explicita o una inferencia comercial fuerte.",
        "La confianza debe estar entre 0 y 1 y reason debe ser breve."
      ].join("\n"),
      input: JSON.stringify(input),
      schemaName: "smart_tag_classification",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["results"],
        properties: {
          results: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["tagId", "matched", "confidence", "reason"],
              properties: {
                tagId: { type: "string" },
                matched: { type: "boolean" },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                reason: { type: "string" }
              }
            }
          }
        }
      },
      validate: (value) => classificationSchema.parse(value),
      demo: () => ({ results: this.classifyDemo(tags, context) })
    });

    const allowedIds = new Set(tags.map((tag) => tag.id));
    const byId = new Map(result.data.results.filter((item) => allowedIds.has(item.tagId)).map((item) => [item.tagId, item]));
    const results = tags.map(
      (tag) =>
        byId.get(tag.id) ?? {
          tagId: tag.id,
          matched: false,
          confidence: 0,
          reason: "OpenAI no devolvio un resultado para esta etiqueta."
        },
    );

    return {
      results,
      mode: result.mode,
      model: result.model,
      usage: result.usage,
      input,
      responseId: result.responseId
    };
  }

  buildInput(tags: SmartTagDefinition[], context: SmartTagClassificationContext) {
    return {
      tags: tags.map((tag) => ({
        id: tag.id,
        name: tag.name,
        description: tag.description,
        prompt: tag.classification_prompt
      })),
      lead: context.lead,
      conversation: context.conversation,
      messages: context.messages.slice(-12)
    };
  }

  private classifyDemo(
    tags: SmartTagDefinition[],
    context: SmartTagClassificationContext,
  ): SmartTagClassificationResult[] {
    const haystack = [
      context.lead?.name,
      context.lead?.company,
      context.lead?.status,
      context.lead?.notes,
      ...context.messages.map((message) => message.body)
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return tags.map((tag) => {
      const terms = [tag.name, tag.description, tag.classification_prompt]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .split(/[^a-z0-9áéíóúñ_]+/i)
        .filter((term) => term.length >= 4);
      const matchedTerms = terms.filter((term) => haystack.includes(term));
      const matched = matchedTerms.length > 0;
      return {
        tagId: tag.id,
        matched,
        confidence: matched ? Math.min(0.95, 0.55 + matchedTerms.length * 0.15) : 0.1,
        reason: matched
          ? `Coincidencias demo: ${matchedTerms.join(", ")}`
          : "No hubo coincidencias suficientes en modo demo."
      };
    });
  }
}
