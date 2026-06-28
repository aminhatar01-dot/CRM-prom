import { z } from "zod";
import { OpenAIResponsesClient, type OpenAIResult } from "./openai-client";

const requestedItemSchema = z.object({
  query: z.string().trim().min(1).max(200),
  quantity: z.number().positive().nullable()
});

export const quoteIntentSchema = z.object({
  is_quote_intent: z.boolean(),
  requested_items: z.array(requestedItemSchema).max(20),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  notes: z.string().max(500).nullable()
});

export type QuoteIntent = z.infer<typeof quoteIntentSchema>;

export class QuoteIntentExtractor {
  constructor(private readonly client: OpenAIResponsesClient) {}

  extract(message: string): Promise<OpenAIResult<QuoteIntent>> {
    return this.client.structured({
      instructions: [
        "Detecta si el cliente pide precio, stock, presupuesto, cotizacion o armar un pedido.",
        "Extrae solamente productos o servicios mencionados y cantidades explicitas.",
        "Nunca inventes cantidades, moneda, productos, precios ni stock.",
        "Si no hay cantidad explicita usa null. Devuelve codigos de moneda ISO 4217 en mayusculas."
      ].join(" "),
      input: message,
      schemaName: "quote_intent",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          is_quote_intent: { type: "boolean" },
          requested_items: {
            type: "array",
            maxItems: 20,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                query: { type: "string" },
                quantity: { anyOf: [{ type: "number", exclusiveMinimum: 0 }, { type: "null" }] }
              },
              required: ["query", "quantity"]
            }
          },
          currency: { anyOf: [{ type: "string", pattern: "^[A-Z]{3}$" }, { type: "null" }] },
          notes: { anyOf: [{ type: "string" }, { type: "null" }] }
        },
        required: ["is_quote_intent", "requested_items", "currency", "notes"]
      },
      validate: (value) => quoteIntentSchema.parse(value),
      demo: () => demoQuoteIntent(message)
    });
  }
}

export function demoQuoteIntent(message: string): QuoteIntent {
  const normalized = message.trim();
  const isQuote = /(precio|cu[aá]nto (sale|cuesta)|cotiz|presupuesto|stock|comprar|pedido)/i.test(normalized);
  if (!isQuote) return { is_quote_intent: false, requested_items: [], currency: null, notes: null };
  const quantityMatch = normalized.match(/(?:^|\s)(\d+(?:[.,]\d+)?)\s+(?:unidades?\s+de\s+)?(.+?)(?:[?.!]|$)/i);
  const cleaned = normalized
    .replace(/^(hola[, ]*)?/i, "")
    .replace(/(?:pasame|dame|necesito|quiero|armame)\s+(?:el\s+)?(?:precio|presupuesto|cotizacion|pedido)?\s*(?:de|para)?\s*/i, "")
    .replace(/[?.!]+$/g, "")
    .trim();
  return {
    is_quote_intent: true,
    requested_items: cleaned ? [{ query: quantityMatch?.[2]?.trim() || cleaned, quantity: quantityMatch ? Number(quantityMatch[1].replace(",", ".")) : null }] : [],
    currency: null,
    notes: null
  };
}
