import { describe, expect, it } from "vitest";
import { runIntegrationTool } from "./executor";
import type { requireUser } from "@/lib/auth";

type SupabaseClient = Awaited<ReturnType<typeof requireUser>>["supabase"];

const organizationId = "00000000-0000-4000-8000-000000000001";
const toolId = "00000000-0000-4000-8000-000000000911";

describe("runIntegrationTool", () => {
  it("stores execution logs for successful manual runs", async () => {
    const supabase = fakeSupabase();
    const result = await runIntegrationTool({
      supabase,
      organizationId,
      toolId,
      userId: "00000000-0000-4000-8000-000000000111",
      input: { query: "demo" }
    });

    const runs = table(supabase, "integration_tool_runs");
    expect(result.status).toBe("success");
    expect(runs).toHaveLength(1);
    expect(runs[0].status).toBe("success");
    expect(runs[0].output).toMatchObject({ ok: true });
  });
});

function fakeSupabase() {
  const db: Record<string, Array<Record<string, unknown>>> = {
    integration_tools: [
      {
        id: toolId,
        organization_id: organizationId,
        integration_id: "00000000-0000-4000-8000-000000000901",
        name: "Demo",
        type: "custom_connect",
        method: "POST",
        url: "mock://success",
        headers_schema: {},
        body_schema: {},
        response_schema: {},
        timeout_ms: 3000,
        config: {},
        integrations: { id: "00000000-0000-4000-8000-000000000901", active: true }
      }
    ],
    integration_tool_runs: []
  };

  return {
    __db: db,
    from(tableName: string) {
      return new FakeQuery(db, tableName);
    },
    // Stub rpc — allows all rate limit checks in tests
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars
    async rpc(..._args: any[]) {
      return { data: true, error: null };
    },
  } as unknown as SupabaseClient;
}

function table(supabase: SupabaseClient, name: string) {
  return (supabase as unknown as { __db: Record<string, Array<Record<string, unknown>>> }).__db[name];
}

class FakeQuery {
  private filters: Array<(row: Record<string, unknown>) => boolean> = [];
  private action: "select" | "insert" | "update" = "select";
  private payload: Record<string, unknown> | null = null;

  constructor(
    private readonly db: Record<string, Array<Record<string, unknown>>>,
    private readonly tableName: string,
  ) {}

  select() {
    return this;
  }

  insert(payload: unknown) {
    this.action = "insert";
    this.payload = payload as Record<string, unknown>;
    return this;
  }

  update(payload: unknown) {
    this.action = "update";
    this.payload = payload as Record<string, unknown>;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  async single<T>() {
    const rows = this.rows();
    return { data: (rows[0] as T) ?? null, error: null };
  }

  private rows() {
    if (this.action === "insert" && this.payload) {
      const row = { id: crypto.randomUUID(), ...this.payload };
      this.db[this.tableName].push(row);
      return [row];
    }

    const rows = this.db[this.tableName].filter((row) => this.filters.every((filter) => filter(row)));
    if (this.action === "update" && this.payload) {
      rows.forEach((row) => Object.assign(row, this.payload));
    }
    return rows;
  }
}
