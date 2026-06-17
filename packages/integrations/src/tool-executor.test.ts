import { describe, expect, it } from "vitest";
import { ToolExecutor, type ExecutableTool } from "./tool-executor";

const organizationId = "00000000-0000-4000-8000-000000000001";

const baseTool: ExecutableTool = {
  id: "00000000-0000-4000-8000-000000000901",
  organization_id: organizationId,
  integration_id: "00000000-0000-4000-8000-000000000900",
  name: "Demo",
  type: "custom_connect",
  method: "POST",
  url: "mock://success",
  headers_schema: {},
  timeout_ms: 3000,
  config: {}
};

describe("ToolExecutor", () => {
  it("executes successful custom connect mock", async () => {
    const result = await new ToolExecutor().execute(baseTool, organizationId, { query: "ana" });

    expect(result.status).toBe("success");
    expect(result.output).toMatchObject({ ok: true, source: "mock" });
  });

  it("executes failed custom connect mock", async () => {
    const result = await new ToolExecutor().execute({ ...baseTool, url: "mock://fail" }, organizationId);

    expect(result.status).toBe("failed");
    expect(result.error).toBe("Mock tool failure");
  });

  it("executes Google Sheets demo search", async () => {
    const result = await new ToolExecutor().execute(
      {
        ...baseTool,
        type: "google_sheets",
        method: null,
        url: null,
        config: { spreadsheet_url: "demo://leads" }
      },
      organizationId,
      { query: "Ana" },
    );

    expect(result.status).toBe("success");
    expect(result.output?.rows).toEqual([{ nombre: "Ana Torres", email: "ana@example.com", interes: "CRM" }]);
  });
});
