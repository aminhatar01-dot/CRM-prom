import { describe, expect, it, vi } from "vitest";
import { OpenAIEmbeddingClient } from "./embedding-client";

describe("OpenAIEmbeddingClient", () => {
  it("uses deterministic 1536-dimensional embeddings in demo mode", async () => {
    const client = new OpenAIEmbeddingClient({ demoMode: true });
    const first = await client.embed(["planes comerciales"]);
    const second = await client.embed(["planes comerciales"]);

    expect(first.mode).toBe("demo");
    expect(first.embeddings[0]).toHaveLength(1536);
    expect(first.embeddings[0]).toEqual(second.embeddings[0]);
  });

  it("calls the server-side embeddings endpoint with a mocked OpenAI response", async () => {
    const embedding = Array.from({ length: 1536 }, (_, index) => index / 1536);
    const fetcher = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        model: "text-embedding-3-small",
        data: [{ index: 0, embedding }],
        usage: { prompt_tokens: 4, total_tokens: 4 }
      })
    });
    const client = new OpenAIEmbeddingClient({
      apiKey: "sk-test",
      model: "text-embedding-3-small",
      demoMode: false,
      fetcher
    });

    const result = await client.embed(["horarios de atencion"]);

    expect(result.mode).toBe("openai");
    expect(result.embeddings[0]).toEqual(embedding);
    expect(result.usage.totalTokens).toBe(4);
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.com/v1/embeddings",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

