import { z } from "zod";
import { OpenAIResponsesClient, type AIUsage, type OpenAIClientConfig } from "./openai-client";
import {
  validateVariableValue,
  type VariableDefinition,
  type VariableExtractionContext,
  type VariableExtractionResult
} from "./variables";

export type VariableExtractorResult = {
  results: VariableExtractionResult[];
  mode: "demo" | "openai";
  model: string;
  usage: AIUsage;
  input: Record<string, unknown>;
  responseId?: string;
};

const extractionSchema = z.object({
  results: z.array(
    z.object({
      variableId: z.string().uuid(),
      extracted: z.boolean(),
      value: z.unknown().nullable(),
      confidence: z.number().min(0).max(1),
      sourceMessageId: z.string().uuid().nullable(),
      reason: z.string().min(1).max(500)
    }),
  )
});

export class VariableExtractor {
  private readonly client: OpenAIResponsesClient;

  constructor(config: OpenAIClientConfig = {}) {
    this.client = new OpenAIResponsesClient(config);
  }

  async extract(
    variables: VariableDefinition[],
    context: VariableExtractionContext,
  ): Promise<VariableExtractorResult> {
    const input = this.buildInput(variables, context);
    const result = await this.client.structured({
      instructions: [
        "Extrae valores CRM usando solo la evidencia entregada.",
        "Devuelve un resultado por cada variableId.",
        "Si no hay evidencia, usa extracted=false, value=null y sourceMessageId=null.",
        "sourceMessageId debe pertenecer a los mensajes recibidos.",
        "Respeta type y options de cada variable."
      ].join("\n"),
      input: JSON.stringify(input),
      schemaName: "crm_variable_extraction",
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
              required: ["variableId", "extracted", "value", "confidence", "sourceMessageId", "reason"],
              properties: {
                variableId: { type: "string" },
                extracted: { type: "boolean" },
                value: {
                  anyOf: [
                    { type: "string" },
                    { type: "number" },
                    { type: "boolean" },
                    { type: "null" }
                  ]
                },
                confidence: { type: "number", minimum: 0, maximum: 1 },
                sourceMessageId: { anyOf: [{ type: "string" }, { type: "null" }] },
                reason: { type: "string" }
              }
            }
          }
        }
      },
      validate: (value): { results: VariableExtractionResult[] } => {
        const parsed = extractionSchema.parse(value);
        return {
          results: parsed.results.map((item) => ({
            variableId: item.variableId,
            extracted: item.extracted,
            value: item.value ?? null,
            confidence: item.confidence,
            sourceMessageId: item.sourceMessageId,
            reason: item.reason
          }))
        };
      },
      demo: () => ({ results: variables.map((variable) => this.extractOne(variable, context)) })
    });

    const allowedMessages = new Set(context.messages.map((message) => message.id).filter(Boolean));
    const byId = new Map(result.data.results.map((item) => [item.variableId, item]));
    const results = variables.map((variable) => {
      const item = byId.get(variable.id);
      if (!item || !item.extracted) {
        return {
          variableId: variable.id,
          extracted: false,
          value: null,
          confidence: item?.confidence ?? 0,
          sourceMessageId: null,
          reason: item?.reason ?? "OpenAI no devolvio un resultado para esta variable."
        };
      }
      try {
        const value = validateVariableValue(variable.type, item.value, variable.options);
        return {
          ...item,
          extracted: value !== null,
          value,
          sourceMessageId:
            item.sourceMessageId && allowedMessages.has(item.sourceMessageId) ? item.sourceMessageId : null
        };
      } catch {
        return {
          variableId: variable.id,
          extracted: false,
          value: null,
          confidence: 0,
          sourceMessageId: null,
          reason: "El valor devuelto no cumple el tipo configurado."
        };
      }
    });

    return {
      results,
      mode: result.mode,
      model: result.model,
      usage: result.usage,
      input,
      responseId: result.responseId
    };
  }

  buildInput(variables: VariableDefinition[], context: VariableExtractionContext) {
    return {
      variables: variables.map((variable) => ({
        id: variable.id,
        key: variable.key,
        name: variable.name,
        type: variable.type,
        prompt: variable.extraction_prompt,
        options: variable.options
      })),
      lead: context.lead,
      conversation: context.conversation,
      messages: context.messages.slice(-12)
    };
  }

  private extractOne(variable: VariableDefinition, context: VariableExtractionContext): VariableExtractionResult {
    const sources = [
      ...context.messages.map((message) => ({ id: message.id, text: message.body })),
      { id: null, text: context.lead?.notes ?? "" },
      { id: null, text: context.lead?.email ?? "" },
      { id: null, text: context.lead?.phone ?? "" }
    ];
    const joined = sources.map((source) => source.text).join(" ");
    const prompt = `${variable.name} ${variable.key} ${variable.extraction_prompt}`.toLowerCase();
    const source = sources.find((item) => this.guessRawValue(variable, item.text, prompt) !== null);
    const rawValue = this.guessRawValue(variable, source?.text ?? joined, prompt);
    if (rawValue === null) {
      return {
        variableId: variable.id,
        extracted: false,
        value: null,
        confidence: 0.1,
        sourceMessageId: source?.id,
        reason: "No se encontro valor en modo demo."
      };
    }
    try {
      const value = validateVariableValue(variable.type, rawValue, variable.options);
      return {
        variableId: variable.id,
        extracted: value !== null,
        value,
        confidence: 0.82,
        sourceMessageId: source?.id,
        reason: "Valor extraido por heuristica demo."
      };
    } catch {
      return {
        variableId: variable.id,
        extracted: false,
        value: null,
        confidence: 0.2,
        sourceMessageId: source?.id,
        reason: "El valor encontrado no cumple el tipo configurado."
      };
    }
  }

  private guessRawValue(variable: VariableDefinition, text: string, prompt: string) {
    if (!text) return null;
    if (variable.type === "link") return text.match(/https?:\/\/\S+/)?.[0] ?? null;
    if (variable.type === "boolean") {
      if (/\b(si|sí|yes|true)\b/i.test(text)) return true;
      if (/\b(no|false)\b/i.test(text)) return false;
      return null;
    }
    if (variable.type === "number" || variable.type === "price") {
      return text.match(/(?:usd|us\$|\$)?\s?([0-9]+(?:[.,][0-9]+)?)/i)?.[0] ?? null;
    }
    if (variable.type === "option") {
      return variable.options.find((option) => text.toLowerCase().includes(option.toLowerCase())) ?? null;
    }
    if (prompt.includes("email")) return text.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0] ?? null;
    if (prompt.includes("telefono") || prompt.includes("phone")) return text.match(/\+?[0-9][0-9\s-]{6,}/)?.[0] ?? null;
    return text.match(new RegExp(`${variable.key}[:=]\\s*([^.;\\n]+)`, "i"))?.[1]?.trim() ?? null;
  }
}
