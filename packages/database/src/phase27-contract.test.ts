import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getAllProviders,
  getAllProviderMetadata,
  getProvider,
  getProviderOrThrow,
  getProvidersByCategory,
} from "@crm-pro-ai/integrations/provider-registry";
import {
  HubProviderError,
  HubNotImplementedError,
} from "@crm-pro-ai/integrations/hub-provider";
import { executeHubTool } from "@crm-pro-ai/integrations/hub-executor";

const root = resolve(import.meta.dirname, "../../..");
const migration = readFileSync(
  resolve(root, "supabase/migrations/20260628170000_phase_27_integration_hub.sql"),
  "utf8",
);
const hubLib = readFileSync(
  resolve(root, "apps/web/src/lib/integrations/hub.ts"),
  "utf8",
);
const hubActions = readFileSync(
  resolve(root, "apps/web/src/app/actions/integration-hub.ts"),
  "utf8",
);
const hubPage = readFileSync(
  resolve(root, "apps/web/src/app/(crm)/integrations/hub/page.tsx"),
  "utf8",
);

// ─── Migration contracts ───────────────────────────────────────────────────────

describe("phase 27 migration contracts", () => {
  it("creates all five hub tables", () => {
    for (const table of [
      "integration_providers",
      "integration_connections",
      "integration_credentials",
      "integration_connection_logs",
      "integration_hub_tools",
    ]) {
      expect(migration).toContain(`create table public.${table}`);
    }
  });

  it("enforces RLS on all hub tables", () => {
    for (const table of [
      "integration_providers",
      "integration_connections",
      "integration_credentials",
      "integration_connection_logs",
      "integration_hub_tools",
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it("seeds all expected providers", () => {
    for (const key of [
      "whatsapp", "instagram", "facebook", "messenger", "tiktok",
      "mercadolibre", "tiendanube", "shopify", "woocommerce",
      "gmail", "google_calendar", "google_sheets", "google_drive",
      "meta_ads", "google_ads",
    ]) {
      expect(migration).toContain(`'${key}'`);
    }
  });

  it("credentials table has NO select grant for authenticated role", () => {
    const authGrant = "grant select on public.integration_credentials to authenticated";
    expect(migration).not.toContain(authGrant);
  });

  it("credentials table grants all to service_role only", () => {
    expect(migration).toContain("grant all on public.integration_credentials to service_role");
  });

  it("provides disconnect_integration_connection function", () => {
    expect(migration).toContain("create or replace function public.disconnect_integration_connection");
    expect(migration).toContain("delete from public.integration_credentials");
    expect(migration).toContain("'disconnected'");
  });

  it("integration_connections uses is_org_member and is_org_admin for RLS", () => {
    expect(migration).toContain("is_org_member(organization_id)");
    expect(migration).toContain("is_org_admin(organization_id)");
  });

  it("integration_hub_tools has unique constraint on (connection_id, tool_key)", () => {
    expect(migration).toContain("unique (connection_id, tool_key)");
  });

  it("integration_connection_logs is append-only (insert only for service)", () => {
    expect(migration).toContain("for insert");
    expect(migration).toContain("integration_connection_logs");
  });
});

// ─── Provider registry contracts ──────────────────────────────────────────────

describe("provider registry contracts", () => {
  it("registers at least 14 providers", () => {
    expect(getAllProviders().length).toBeGreaterThanOrEqual(14);
  });

  it("all providers have required metadata fields", () => {
    for (const p of getAllProviders()) {
      expect(p.key).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.category).toBeTruthy();
      expect(p.authType).toBeTruthy();
      expect(p.iconEmoji).toBeTruthy();
    }
  });

  it("all providers expose at least 1 tool", () => {
    for (const p of getAllProviders()) {
      const tools = p.getToolDefinitions();
      expect(tools.length, `${p.key} should have at least 1 tool`).toBeGreaterThan(0);
    }
  });

  it("all tool definitions have key, name, description and inputSchema", () => {
    for (const p of getAllProviders()) {
      for (const tool of p.getToolDefinitions()) {
        expect(tool.key).toBeTruthy();
        expect(tool.name).toBeTruthy();
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema).toBeDefined();
      }
    }
  });

  it("getProvider returns undefined for unknown key", () => {
    expect(getProvider("nonexistent_xyz")).toBeUndefined();
  });

  it("getProviderOrThrow throws for unknown key", () => {
    expect(() => getProviderOrThrow("nonexistent_xyz")).toThrow();
  });

  it("getProvidersByCategory groups providers correctly", () => {
    const byCategory = getProvidersByCategory();
    expect(byCategory["messaging"]).toBeDefined();
    expect(byCategory["ecommerce"]).toBeDefined();
    expect(byCategory["productivity"]).toBeDefined();
    expect(byCategory["advertising"]).toBeDefined();
  });

  it("getAllProviderMetadata includes toolCount for each provider", () => {
    for (const meta of getAllProviderMetadata()) {
      expect(meta.toolCount).toBeGreaterThan(0);
    }
  });

  it("MercadoLibre provider has answer_question tool", () => {
    const ml = getProviderOrThrow("mercadolibre");
    const tools = ml.getToolDefinitions();
    expect(tools.find((t) => t.key === "answer_question")).toBeDefined();
  });

  it("Google Calendar provider has create_event and check_availability tools", () => {
    const gc = getProviderOrThrow("google_calendar");
    const tools = gc.getToolDefinitions();
    expect(tools.find((t) => t.key === "create_event")).toBeDefined();
    expect(tools.find((t) => t.key === "check_availability")).toBeDefined();
  });

  it("Google Sheets hub provider has append_row tool", () => {
    const gs = getProviderOrThrow("google_sheets");
    const tools = gs.getToolDefinitions();
    expect(tools.find((t) => t.key === "append_row")).toBeDefined();
  });
});

// ─── Hub executor contracts ────────────────────────────────────────────────────

describe("hub executor contracts", () => {
  const mockConnection = {
    id: "conn-1",
    organizationId: "org-1",
    providerKey: "google_calendar",
    displayName: "Google Calendar principal",
    status: "connected" as const,
    scopes: ["calendar.events"],
    metadata: {},
  };

  it("rejects cross-tenant execution", async () => {
    const result = await executeHubTool({
      connection: mockConnection,
      toolKey: "create_event",
      input: {},
      organizationId: "org-DIFFERENT",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("Cross-tenant");
  });

  it("rejects disconnected connection", async () => {
    const result = await executeHubTool({
      connection: { ...mockConnection, status: "disconnected" },
      toolKey: "create_event",
      input: {},
      organizationId: "org-1",
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain("not active");
  });

  it("returns notImplemented=true for Phase 27 stub providers", async () => {
    const result = await executeHubTool({
      connection: mockConnection,
      toolKey: "create_event",
      input: { title: "Test", start: "2026-07-01T10:00:00Z", end: "2026-07-01T11:00:00Z" },
      organizationId: "org-1",
    });
    expect(result.success).toBe(false);
    expect(result.notImplemented).toBe(true);
  });

  it("returns providerKey, toolKey and connectionId in result", async () => {
    const result = await executeHubTool({
      connection: mockConnection,
      toolKey: "create_event",
      input: {},
      organizationId: "org-1",
    });
    expect(result.providerKey).toBe("google_calendar");
    expect(result.toolKey).toBe("create_event");
    expect(result.connectionId).toBe("conn-1");
  });
});

// ─── Hub error types contracts ────────────────────────────────────────────────

describe("hub error types", () => {
  it("HubNotImplementedError is a HubProviderError", () => {
    const err = new HubNotImplementedError("google_calendar", "create_event");
    expect(err).toBeInstanceOf(HubProviderError);
    expect(err.name).toBe("HubNotImplementedError");
    expect(err.providerKey).toBe("google_calendar");
    expect(err.toolKey).toBe("create_event");
    expect(err.message).toContain("not yet implemented");
  });
});

// ─── Hub lib contracts ─────────────────────────────────────────────────────────

describe("phase 27 hub lib contracts", () => {
  it("exports listConnections", () => {
    expect(hubLib).toContain("listConnections");
  });

  it("exports createConnection and populates hub tools", () => {
    expect(hubLib).toContain("createConnection");
    expect(hubLib).toContain("integration_hub_tools");
    expect(hubLib).toContain("getToolDefinitions");
  });

  it("exports disconnectConnection using DB function", () => {
    expect(hubLib).toContain("disconnectConnection");
    expect(hubLib).toContain("disconnect_integration_connection");
  });

  it("exports logConnectionEvent", () => {
    expect(hubLib).toContain("logConnectionEvent");
    expect(hubLib).toContain("integration_connection_logs");
  });

  it("exports toHubConnection mapper", () => {
    expect(hubLib).toContain("toHubConnection");
  });
});

// ─── Hub actions contracts ────────────────────────────────────────────────────

describe("phase 27 hub actions contracts", () => {
  it("exports getIntegrationHubOverview", () => {
    expect(hubActions).toContain("getIntegrationHubOverview");
  });

  it("exports createIntegrationConnection", () => {
    expect(hubActions).toContain("createIntegrationConnection");
  });

  it("exports disconnectIntegrationConnection", () => {
    expect(hubActions).toContain("disconnectIntegrationConnection");
  });

  it("exports testIntegrationConnection", () => {
    expect(hubActions).toContain("testIntegrationConnection");
  });

  it("exports deleteIntegrationConnection", () => {
    expect(hubActions).toContain("deleteIntegrationConnection");
  });

  it("gates manage actions behind manageIntegrations capability", () => {
    expect(hubActions).toContain("manageIntegrations");
    expect(hubActions).toContain("forbidden");
  });
});

// ─── Hub UI contracts ─────────────────────────────────────────────────────────

describe("phase 27 hub UI contracts", () => {
  it("shows all connection statuses", () => {
    expect(hubPage).toContain("connected");
    expect(hubPage).toContain("disconnected");
    expect(hubPage).toContain("expired");
    expect(hubPage).toContain("requires_auth");
    expect(hubPage).toContain("error");
  });

  it("groups providers by category", () => {
    expect(hubPage).toContain("byCategory");
    expect(hubPage).toContain("Mensajería");
  });

  it("allows creating a connection per provider", () => {
    expect(hubPage).toContain("createIntegrationConnection");
    expect(hubPage).toContain("provider_key");
    expect(hubPage).toContain("display_name");
  });

  it("gates UI behind manageIntegrations", () => {
    expect(hubPage).toContain("manageIntegrations");
    expect(hubPage).toContain('redirect("/dashboard")');
  });

  it("shows tool count per provider", () => {
    expect(hubPage).toContain("toolCount");
    expect(hubPage).toContain("tools");
  });
});
