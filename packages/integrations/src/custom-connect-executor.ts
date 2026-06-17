import type { CustomConnectTool } from "./tools";

export type CustomConnectExecution = {
  status: "success" | "failed";
  output?: Record<string, unknown>;
  error?: string;
  duration_ms: number;
};

export class CustomConnectExecutor {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async execute(tool: Pick<CustomConnectTool, "method" | "url" | "headers_schema" | "timeout_ms">, input: Record<string, unknown> = {}): Promise<CustomConnectExecution> {
    const start = Date.now();

    if (tool.url.startsWith("mock://success")) {
      return {
        status: "success",
        output: { ok: true, input, source: "mock" },
        duration_ms: Date.now() - start
      };
    }

    if (tool.url.startsWith("mock://fail")) {
      return {
        status: "failed",
        error: "Mock tool failure",
        duration_ms: Date.now() - start
      };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), tool.timeout_ms);

    try {
      const response = await this.fetcher(tool.url, {
        method: tool.method,
        headers: {
          "content-type": "application/json",
          ...headersFromSchema(tool.headers_schema)
        },
        body: tool.method === "GET" ? undefined : JSON.stringify(input),
        signal: controller.signal
      });
      const text = await response.text();
      const payload = parseMaybeJson(text);

      if (!response.ok) {
        return {
          status: "failed",
          error: `HTTP ${response.status}`,
          output: { response: payload },
          duration_ms: Date.now() - start
        };
      }

      return {
        status: "success",
        output: { response: payload },
        duration_ms: Date.now() - start
      };
    } catch (error) {
      return {
        status: "failed",
        error: error instanceof Error ? error.message : "Custom Connect failed",
        duration_ms: Date.now() - start
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}

function headersFromSchema(schema: Record<string, unknown>) {
  const headers = schema.headers;
  return headers && typeof headers === "object" && !Array.isArray(headers)
    ? Object.fromEntries(
        Object.entries(headers as Record<string, unknown>).map(([key, value]) => [key, String(value)]),
      )
    : {};
}

function parseMaybeJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
