import { sanitizeAIText, OpenAIRequestError, type AIUsage } from "./openai-client";

export type EmbeddingClientConfig = {
  apiKey?: string;
  model?: string;
  demoMode?: boolean;
  fetcher?: typeof fetch;
};

export type EmbeddingResult = {
  embeddings: number[][];
  mode: "demo" | "openai";
  model: string;
  usage: AIUsage;
};

export class OpenAIEmbeddingClient {
  readonly model: string;
  readonly demoMode: boolean;
  private readonly apiKey?: string;
  private readonly fetcher: typeof fetch;

  constructor(config: EmbeddingClientConfig = {}) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? "text-embedding-3-small";
    this.demoMode = config.demoMode ?? !config.apiKey;
    this.fetcher = config.fetcher ?? fetch;
  }

  async embed(inputs: string[]): Promise<EmbeddingResult> {
    const sanitized = inputs.map((input) => sanitizeAIText(input, 24_000));
    if (sanitized.length === 0 || sanitized.some((input) => !input)) {
      throw new OpenAIRequestError("El contenido para embeddings no puede estar vacio.");
    }
    if (this.demoMode) {
      return {
        embeddings: sanitized.map(demoEmbedding),
        mode: "demo",
        model: this.model,
        usage: { inputTokens: null, outputTokens: null, totalTokens: null }
      };
    }
    if (!this.apiKey) {
      throw new OpenAIRequestError("OPENAI_API_KEY es necesaria para generar embeddings.");
    }

    const response = await this.fetcher("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.model,
        input: sanitized,
        encoding_format: "float",
        dimensions: 1536
      })
    });
    const payload = (await response.json()) as EmbeddingPayload;
    if (!response.ok) {
      throw new OpenAIRequestError(
        sanitizeAIText(payload.error?.message ?? "OpenAI no pudo generar embeddings.", 500),
        response.status,
      );
    }
    const embeddings = [...(payload.data ?? [])]
      .sort((left, right) => left.index - right.index)
      .map((item) => item.embedding);
    if (embeddings.length !== sanitized.length || embeddings.some((embedding) => embedding.length !== 1536)) {
      throw new OpenAIRequestError("OpenAI devolvio embeddings incompletos.");
    }

    return {
      embeddings,
      mode: "openai",
      model: payload.model ?? this.model,
      usage: {
        inputTokens: payload.usage?.prompt_tokens ?? null,
        outputTokens: null,
        totalTokens: payload.usage?.total_tokens ?? null
      }
    };
  }
}

type EmbeddingPayload = {
  data?: Array<{ index: number; embedding: number[] }>;
  model?: string;
  usage?: { prompt_tokens?: number; total_tokens?: number };
  error?: { message?: string };
};

function demoEmbedding(input: string) {
  const vector = Array.from({ length: 1536 }, () => 0);
  const tokens = input.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  for (const token of tokens) {
    let hash = 2166136261;
    for (const character of token) {
      hash ^= character.codePointAt(0) ?? 0;
      hash = Math.imul(hash, 16777619);
    }
    vector[Math.abs(hash) % vector.length] += hash % 2 === 0 ? 1 : -1;
  }
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0)) || 1;
  return vector.map((value) => value / norm);
}

