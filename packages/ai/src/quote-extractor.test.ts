import { describe, expect, it, vi } from "vitest";
import { OpenAIResponsesClient } from "./openai-client";
import { demoQuoteIntent, QuoteIntentExtractor } from "./quote-extractor";

describe("QuoteIntentExtractor", () => {
  it("detects quote intent and preserves missing quantity", () => {
    expect(demoQuoteIntent("Necesito presupuesto de taladro profesional")).toMatchObject({ is_quote_intent: true, requested_items: [{ quantity: null }] });
  });

  it("uses structured OpenAI output without accepting invented fields", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ output_text: JSON.stringify({ is_quote_intent: true, requested_items: [{ query: "Taladro", quantity: 2 }], currency: "ARS", notes: null }), usage: { input_tokens: 20, output_tokens: 15, total_tokens: 35 } }), { status: 200 }));
    const extractor = new QuoteIntentExtractor(new OpenAIResponsesClient({ apiKey: "sk-test", model: "gpt-test", demoMode: false, fetcher }));
    const result = await extractor.extract("Cotizame 2 taladros");
    expect(result.data.requested_items[0]).toEqual({ query: "Taladro", quantity: 2 });
    expect(result.usage.totalTokens).toBe(35);
  });
});
