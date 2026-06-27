export type AIUsage = {
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export type OpenAIClientConfig = {
  apiKey?: string;
  model?: string;
  temperature?: number;
  demoMode?: boolean;
  fetcher?: typeof fetch;
};

export type OpenAIResult<T> = {
  data: T;
  mode: "demo" | "openai";
  model: string;
  usage: AIUsage;
  responseId?: string;
};

export class OpenAIRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "OpenAIRequestError";
  }
}

export class OpenAIResponsesClient {
  readonly model: string;
  readonly demoMode: boolean;
  private readonly temperature: number | undefined;
  private readonly apiKey?: string;
  private readonly fetcher: typeof fetch;

  constructor(config: OpenAIClientConfig = {}) {
    this.apiKey = config.apiKey;
    this.model = config.model ?? "gpt-5.2";
    this.temperature = config.temperature;
    this.demoMode = config.demoMode ?? !config.apiKey;
    this.fetcher = config.fetcher ?? fetch;
  }

  async text({
    instructions,
    input,
    demo
  }: {
    instructions: string;
    input: string;
    demo: () => string;
  }): Promise<OpenAIResult<string>> {
    this.assertPrompt(instructions, input);
    if (this.demoMode) return this.demoResult(demo());
    this.assertApiKey();

    const payload = await this.request({
      model: this.model,
      store: false,
      ...(typeof this.temperature === "number" ? { temperature: this.temperature } : {}),
      instructions: sanitizeAIText(instructions, 8_000),
      input: sanitizeAIText(input, 24_000)
    });

    const output = extractOutputText(payload).trim();
    if (!output) throw new OpenAIRequestError("OpenAI devolvio una respuesta vacia.");

    return {
      data: output,
      mode: "openai",
      model: this.model,
      usage: mapUsage(payload.usage),
      responseId: payload.id
    };
  }

  async structured<T>({
    instructions,
    input,
    schemaName,
    schema,
    validate,
    demo
  }: {
    instructions: string;
    input: string;
    schemaName: string;
    schema: Record<string, unknown>;
    validate: (value: unknown) => T;
    demo: () => T;
  }): Promise<OpenAIResult<T>> {
    this.assertPrompt(instructions, input);
    if (this.demoMode) return this.demoResult(demo());
    this.assertApiKey();

    const payload = await this.request({
      model: this.model,
      store: false,
      ...(typeof this.temperature === "number" ? { temperature: this.temperature } : {}),
      instructions: sanitizeAIText(instructions, 8_000),
      input: sanitizeAIText(input, 24_000),
      text: {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema
        }
      }
    });

    const output = extractOutputText(payload).trim();
    if (!output) throw new OpenAIRequestError("OpenAI devolvio una respuesta estructurada vacia.");

    let decoded: unknown;
    try {
      decoded = JSON.parse(output);
    } catch {
      throw new OpenAIRequestError("OpenAI devolvio JSON invalido.");
    }

    return {
      data: validate(decoded),
      mode: "openai",
      model: this.model,
      usage: mapUsage(payload.usage),
      responseId: payload.id
    };
  }

  private async request(body: Record<string, unknown>) {
    const response = await this.fetcher("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const payload = (await response.json()) as OpenAIResponsePayload;
    if (!response.ok) {
      throw new OpenAIRequestError(
        sanitizeAIText(payload.error?.message ?? "OpenAI no pudo completar la solicitud.", 500),
        response.status,
      );
    }
    return payload;
  }

  private demoResult<T>(data: T): OpenAIResult<T> {
    return {
      data,
      mode: "demo",
      model: this.model,
      usage: { inputTokens: null, outputTokens: null, totalTokens: null }
    };
  }

  private assertPrompt(instructions: string, input: string) {
    if (!instructions.trim() || !input.trim()) {
      throw new OpenAIRequestError("El prompt y el contexto no pueden estar vacios.");
    }
  }

  private assertApiKey() {
    if (!this.apiKey) {
      throw new OpenAIRequestError(
        "OPENAI_API_KEY no esta configurada. Activa AI_DEMO_MODE o agrega la clave en el servidor.",
      );
    }
  }
}

type OpenAIResponsePayload = {
  id?: string;
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string; type?: string }> }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string };
};

export function sanitizeAIText(value: string, maxLength = 4_000) {
  return Array.from(value)
    .map((character) => {
      const code = character.charCodeAt(0);
      return (code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127 ? " " : character;
    })
    .join("")
    .replace(/\s{3,}/g, "  ")
    .trim()
    .slice(0, maxLength);
}

function extractOutputText(payload: OpenAIResponsePayload) {
  if (payload.output_text) return payload.output_text;
  return (
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter(Boolean)
      .join("\n") ?? ""
  );
}

function mapUsage(usage: OpenAIResponsePayload["usage"]): AIUsage {
  return {
    inputTokens: usage?.input_tokens ?? null,
    outputTokens: usage?.output_tokens ?? null,
    totalTokens: usage?.total_tokens ?? null
  };
}
