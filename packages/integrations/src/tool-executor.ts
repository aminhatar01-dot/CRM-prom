import { CustomConnectExecutor } from "./custom-connect-executor";
import { GoogleSheetsConnector } from "./google-sheets-connector";
import { validateToolTenant } from "./tools";

export type ExecutableTool = {
  id: string;
  organization_id: string;
  integration_id: string;
  name: string;
  type: "custom_connect" | "google_sheets";
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | null;
  url?: string | null;
  headers_schema?: Record<string, unknown> | null;
  body_schema?: Record<string, unknown> | null;
  response_schema?: Record<string, unknown> | null;
  timeout_ms?: number | null;
  config?: Record<string, unknown> | null;
};

export type ToolExecutionResult = {
  status: "success" | "failed";
  output?: Record<string, unknown>;
  error?: string;
  duration_ms: number;
};

export class ToolExecutor {
  constructor(
    private readonly customConnect = new CustomConnectExecutor(),
    private readonly googleSheets = new GoogleSheetsConnector(),
  ) {}

  async execute(tool: ExecutableTool, organizationId: string, input: Record<string, unknown> = {}): Promise<ToolExecutionResult> {
    validateToolTenant(tool.organization_id, organizationId);

    if (tool.type === "custom_connect") {
      if (!tool.method || !tool.url) {
        return { status: "failed", error: "Custom Connect tool is missing method or URL", duration_ms: 0 };
      }

      return this.customConnect.execute(
        {
          method: tool.method,
          url: tool.url,
          headers_schema: tool.headers_schema ?? {},
          timeout_ms: tool.timeout_ms ?? 8000
        },
        input,
      );
    }

    const start = Date.now();
    try {
      const query = typeof input.query === "string" ? input.query : "";
      const result = await this.googleSheets.search(
        {
          spreadsheet_url: String(tool.config?.spreadsheet_url ?? ""),
          sheet_name: typeof tool.config?.sheet_name === "string" ? tool.config.sheet_name : null
        },
        query,
      );

      return {
        status: "success",
        output: { rows: result.rows, mode: result.mode },
        duration_ms: Date.now() - start
      };
    } catch (error) {
      return {
        status: "failed",
        error: error instanceof Error ? error.message : "Google Sheets tool failed",
        duration_ms: Date.now() - start
      };
    }
  }
}
