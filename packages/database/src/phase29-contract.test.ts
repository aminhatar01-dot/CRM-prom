/**
 * Phase 29 contract tests — Google Workspace OAuth
 * These tests verify the static contracts of new modules without hitting real APIs.
 */
import { describe, it, expect, vi, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Static imports for packages that have no @/ alias deps
import {
  buildGoogleAuthUrl,
  isGoogleProvider,
  GOOGLE_PROVIDER_KEYS,
  DEFAULT_SCOPES_BY_PROVIDER,
} from "../../integrations/src/google/oauth";
import { RealGmailProvider, RealGoogleCalendarProvider, RealGoogleSheetsProvider, RealGoogleDriveProvider } from "../../integrations/src/google/providers";
import { getProvider, getAllProviders } from "../../integrations/src/provider-registry";
import { executeHubTool } from "../../integrations/src/hub-executor";
import * as googleApi from "../../integrations/src/google/api";

const ROOT = resolve(__dirname, "../../..");

function readFile(rel: string) {
  return readFileSync(resolve(ROOT, rel), "utf-8");
}

// ─── Migration SQL ────────────────────────────────────────────────────────────

describe("Migration 20260628190000_phase_29_google_oauth", () => {
  const sql = readFile("supabase/migrations/20260628190000_phase_29_google_oauth.sql");

  it("migration file exists and has oauth_states table", () => {
    expect(sql).toContain("create table public.oauth_states");
    expect(sql).toContain("nonce text not null unique");
    expect(sql).toContain("organization_id uuid not null");
    expect(sql).toContain("expires_at timestamptz not null");
  });

  it("migration creates SECURITY DEFINER functions", () => {
    expect(sql).toContain("claim_oauth_state");
    expect(sql).toContain("store_hub_credential");
    expect(sql).toContain("get_hub_credential");
    expect(sql).toContain("delete_hub_credentials");
    expect(sql).toContain("security definer");
  });

  it("migration has integration_credentials unique constraint", () => {
    expect(sql).toContain("integration_credentials");
    expect(sql).toContain("integration_credentials_connection_id_credential_type_key");
  });

  it("migration has cleanup function", () => {
    expect(sql).toContain("cleanup_expired_oauth_states");
  });
});

// ─── Google OAuth module ──────────────────────────────────────────────────────

describe("google/oauth — buildGoogleAuthUrl", () => {
  it("builds a valid Google auth URL", () => {
    const url = buildGoogleAuthUrl({
      clientId:    "test-client-id",
      redirectUri: "https://example.com/callback",
      state:       "test-nonce-123",
      providerKey: "gmail",
    });
    expect(url).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(url).toContain("client_id=test-client-id");
    expect(url).toContain("state=test-nonce-123");
    expect(url).toContain("access_type=offline");
    expect(url).toContain("prompt=consent");
    expect(url).toContain("response_type=code");
  });

  it("includes gmail scopes by default", () => {
    const url = buildGoogleAuthUrl({
      clientId:    "x",
      redirectUri: "https://example.com/cb",
      state:       "nonce",
      providerKey: "gmail",
    });
    expect(url).toContain("gmail.send");
    expect(url).toContain("gmail.readonly");
  });

  it("isGoogleProvider returns true for all 4 Google keys", () => {
    for (const key of GOOGLE_PROVIDER_KEYS) {
      expect(isGoogleProvider(key)).toBe(true);
    }
  });

  it("isGoogleProvider returns false for non-Google keys", () => {
    expect(isGoogleProvider("instagram")).toBe(false);
    expect(isGoogleProvider("shopify")).toBe(false);
  });

  it("DEFAULT_SCOPES_BY_PROVIDER has scopes for all 4 providers", () => {
    const expected = ["gmail", "google_calendar", "google_sheets", "google_drive"];
    for (const key of expected) {
      expect(DEFAULT_SCOPES_BY_PROVIDER[key]).toBeDefined();
      expect(DEFAULT_SCOPES_BY_PROVIDER[key].length).toBeGreaterThan(0);
    }
  });

  it("google_calendar scopes include calendar.events", () => {
    const scopes = DEFAULT_SCOPES_BY_PROVIDER["google_calendar"];
    expect(scopes.some((s) => s.includes("calendar.events"))).toBe(true);
  });

  it("google_sheets scopes include spreadsheets", () => {
    const scopes = DEFAULT_SCOPES_BY_PROVIDER["google_sheets"];
    expect(scopes.some((s) => s.includes("spreadsheets"))).toBe(true);
  });

  it("allows custom scopes override", () => {
    const custom = ["https://www.googleapis.com/auth/gmail.readonly"];
    const url = buildGoogleAuthUrl({
      clientId:    "x",
      redirectUri: "https://x.com/cb",
      state:       "n",
      providerKey: "gmail",
      scopes:      custom,
    });
    expect(url).toContain("gmail.readonly");
    expect(url).not.toContain("gmail.send");
  });
});

// ─── Credential encryption ────────────────────────────────────────────────────

describe("credentials.ts — AES-256-GCM encryption", () => {
  beforeAll(() => {
    process.env.HUB_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 0x42).toString("base64");
  });

  it("encrypts and decrypts a value", async () => {
    const { encryptCredential, decryptCredential } = await import(
      "../../../apps/web/src/lib/integrations/credentials"
    );
    const original  = "ya29.secret-access-token";
    const encrypted = encryptCredential(original);
    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted.split(".")).toHaveLength(4);
    const decrypted = decryptCredential(encrypted);
    expect(decrypted).toBe(original);
  });

  it("produces different ciphertext each encryption (random IV)", async () => {
    const { encryptCredential } = await import(
      "../../../apps/web/src/lib/integrations/credentials"
    );
    const a = encryptCredential("same-value");
    const b = encryptCredential("same-value");
    expect(a).not.toBe(b);
  });

  it("throws on tampered ciphertext", async () => {
    const { encryptCredential, decryptCredential } = await import(
      "../../../apps/web/src/lib/integrations/credentials"
    );
    const enc    = encryptCredential("secret");
    const tamper = enc.slice(0, -4) + "XXXX";
    expect(() => decryptCredential(tamper)).toThrow();
  });

  it("throws on invalid format", async () => {
    const { decryptCredential } = await import(
      "../../../apps/web/src/lib/integrations/credentials"
    );
    expect(() => decryptCredential("not.a.valid.credential.format.extra")).toThrow();
    expect(() => decryptCredential("v2.abc.def.ghi")).toThrow();
  });

  it("makeGetCredential returns a function", async () => {
    const { makeGetCredential } = await import(
      "../../../apps/web/src/lib/integrations/credentials"
    );
    const mockSupabase = {} as never;
    const fn = makeGetCredential(mockSupabase, "conn-1", "org-1");
    expect(typeof fn).toBe("function");
  });
});

// ─── Google providers (real implementation) ───────────────────────────────────

const mockConn = (providerKey: string) => ({
  id:             "c1",
  organizationId: "o1",
  providerKey,
  displayName:    "test",
  status:         "connected" as const,
  metadata:       {},
  createdAt:      new Date().toISOString(),
});

describe("RealGmailProvider", () => {
  it("has correct key, name, authType", () => {
    const p = new RealGmailProvider();
    expect(p.key).toBe("gmail");
    expect(p.name).toBe("Gmail");
    expect(p.authType).toBe("oauth2");
  });

  it("exposes 3 tool definitions", () => {
    const p = new RealGmailProvider();
    const tools = p.getToolDefinitions();
    expect(tools).toHaveLength(3);
    expect(tools.map((t) => t.key)).toEqual(expect.arrayContaining(["send_email", "search_emails", "read_email"]));
  });

  it("returns error when getCredential returns null", async () => {
    const p   = new RealGmailProvider();
    const ctx = { getCredential: async () => null };
    const res = await p.executeTool("search_emails", { query: "test" }, mockConn("gmail"), ctx);
    expect(res.success).toBe(false);
    expect(res.error).toContain("No access token");
  });

  it("send_email requires human approval by default", async () => {
    const p   = new RealGmailProvider();
    const ctx = { getCredential: async () => "fake-token" };
    const res = await p.executeTool("send_email", { to: "x@x.com", subject: "Hi", body: "test" }, mockConn("gmail"), ctx);
    expect(res.success).toBe(false);
    expect(res.data).toMatchObject({ requiresApproval: true });
  });

  it("send_email proceeds when requireHumanApproval is false", async () => {
    const p          = new RealGmailProvider();
    const fetchMock  = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ id: "msg1", threadId: "t1" }),
    } as Response);
    globalThis.fetch = fetchMock;
    const ctx = { getCredential: async () => "fake-token", requireHumanApproval: false };
    const res = await p.executeTool("send_email", { to: "x@x.com", subject: "Hi", body: "body" }, mockConn("gmail"), ctx);
    expect(fetchMock).toHaveBeenCalled();
    // restore — don't care about result shape
    void res;
  });

  it("returns error for unknown tool", async () => {
    const p   = new RealGmailProvider();
    const res = await p.executeTool("unknown_tool", {}, mockConn("gmail"));
    expect(res.success).toBe(false);
    expect(res.error).toContain("Unknown tool");
  });
});

describe("RealGoogleCalendarProvider", () => {
  it("has correct key and 3 tools", () => {
    const p = new RealGoogleCalendarProvider();
    expect(p.key).toBe("google_calendar");
    expect(p.getToolDefinitions()).toHaveLength(3);
    expect(p.getToolDefinitions().map((t) => t.key)).toContain("create_event");
  });

  it("create_event requires human approval by default", async () => {
    const p   = new RealGoogleCalendarProvider();
    const ctx = { getCredential: async () => "tok" };
    const res = await p.executeTool("create_event", { title: "Meeting", start: "2026-07-01T10:00:00Z", end: "2026-07-01T11:00:00Z" }, mockConn("google_calendar"), ctx);
    expect(res.success).toBe(false);
    expect(res.data).toMatchObject({ requiresApproval: true });
  });

  it("list_events fails without token", async () => {
    const p   = new RealGoogleCalendarProvider();
    const ctx = { getCredential: async () => null };
    const res = await p.executeTool("list_events", { limit: 5 }, mockConn("google_calendar"), ctx);
    expect(res.success).toBe(false);
  });
});

describe("RealGoogleSheetsProvider", () => {
  it("has 4 tools", () => {
    const p = new RealGoogleSheetsProvider();
    expect(p.getToolDefinitions()).toHaveLength(4);
  });

  it("append_row requires human approval", async () => {
    const p   = new RealGoogleSheetsProvider();
    const ctx = { getCredential: async () => "tok" };
    const res = await p.executeTool("append_row", { spreadsheet_id: "abc", values: [1, 2, 3] }, mockConn("google_sheets"), ctx);
    expect(res.success).toBe(false);
    expect(res.data).toMatchObject({ requiresApproval: true });
  });

  it("read_rows fails without token", async () => {
    const p   = new RealGoogleSheetsProvider();
    const ctx = { getCredential: async () => null };
    const res = await p.executeTool("read_rows", { spreadsheet_id: "abc" }, mockConn("google_sheets"), ctx);
    expect(res.success).toBe(false);
  });
});

describe("RealGoogleDriveProvider", () => {
  it("has 2 tools: list_files and get_file_url", () => {
    const p = new RealGoogleDriveProvider();
    expect(p.getToolDefinitions()).toHaveLength(2);
    expect(p.getToolDefinitions().map((t) => t.key)).toEqual(["list_files", "get_file_url"]);
  });

  it("list_files fails without token", async () => {
    const p   = new RealGoogleDriveProvider();
    const ctx = { getCredential: async () => null };
    const res = await p.executeTool("list_files", {}, mockConn("google_drive"), ctx);
    expect(res.success).toBe(false);
  });
});

// ─── provider-registry uses real Google providers ─────────────────────────────

describe("provider-registry — real Google providers registered", () => {
  it("gmail provider is RealGmailProvider", () => {
    expect(getProvider("gmail")).toBeInstanceOf(RealGmailProvider);
  });

  it("google_calendar provider is RealGoogleCalendarProvider", () => {
    expect(getProvider("google_calendar")).toBeInstanceOf(RealGoogleCalendarProvider);
  });

  it("google_sheets provider is RealGoogleSheetsProvider", () => {
    expect(getProvider("google_sheets")).toBeInstanceOf(RealGoogleSheetsProvider);
  });

  it("google_drive provider is RealGoogleDriveProvider", () => {
    expect(getProvider("google_drive")).toBeInstanceOf(RealGoogleDriveProvider);
  });

  it("still has 14 providers total", () => {
    expect(getAllProviders()).toHaveLength(14);
  });
});

// ─── ToolContext forwarding via hub-executor ───────────────────────────────────

describe("hub-executor — context forwarding", () => {
  it("executeHubTool is a function", () => {
    expect(typeof executeHubTool).toBe("function");
  });

  it("rejects cross-tenant calls regardless of context", async () => {
    const conn = mockConn("gmail");
    conn.organizationId = "org-A";
    const res  = await executeHubTool({
      connection:     conn,
      toolKey:        "search_emails",
      input:          { query: "test" },
      organizationId: "org-B",
      context:        { getCredential: async () => "tok" },
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("Cross-tenant");
  });

  it("passes context to executeTool (human approval check)", async () => {
    const conn = { id: "c1", organizationId: "org-1", providerKey: "gmail", displayName: "g", status: "connected" as const, metadata: {}, createdAt: new Date().toISOString() };
    const res  = await executeHubTool({
      connection:     conn,
      toolKey:        "send_email",
      input:          { to: "x@x.com", subject: "Hi", body: "b" },
      organizationId: "org-1",
      context:        { getCredential: async () => "tok" },
    });
    // requireHumanApproval defaults to true — should require approval
    expect(res.success).toBe(false);
    expect((res.data as Record<string, unknown>)?.requiresApproval).toBe(true);
  });
});

// ─── Google API module — exports ─────────────────────────────────────────────

describe("google/api — exported function signatures", () => {
  it("gmail functions are exported", () => {
    expect(typeof googleApi.gmailSearchMessages).toBe("function");
    expect(typeof googleApi.gmailSendMessage).toBe("function");
    expect(typeof googleApi.gmailGetMessage).toBe("function");
  });

  it("calendar functions are exported", () => {
    expect(typeof googleApi.calendarListEvents).toBe("function");
    expect(typeof googleApi.calendarCreateEvent).toBe("function");
    expect(typeof googleApi.calendarCheckAvailability).toBe("function");
  });

  it("sheets functions are exported", () => {
    expect(typeof googleApi.sheetsReadRange).toBe("function");
    expect(typeof googleApi.sheetsAppendRow).toBe("function");
    expect(typeof googleApi.sheetsSearchRows).toBe("function");
    expect(typeof googleApi.sheetsUpdateRow).toBe("function");
  });

  it("drive functions are exported", () => {
    expect(typeof googleApi.driveListFiles).toBe("function");
    expect(typeof googleApi.driveGetFileUrl).toBe("function");
  });
});

// ─── OAuth routes — file contracts ────────────────────────────────────────────

describe("OAuth routes — file contracts", () => {
  it("start route uses correct imports and stores oauth_states", () => {
    const content = readFile("apps/web/src/app/api/integrations/google/start/route.ts");
    expect(content).toContain("oauth_states");
    expect(content).toContain("buildGoogleAuthUrl");
    expect(content).toContain("isGoogleProvider");
    expect(content).toContain("GOOGLE_CLIENT_ID");
  });

  it("callback route exchanges code and stores credentials", () => {
    const content = readFile("apps/web/src/app/api/integrations/google/callback/route.ts");
    expect(content).toContain("exchangeGoogleCode");
    expect(content).toContain("storeCredential");
    expect(content).toContain("refresh_token");
    expect(content).toContain("used_at");
  });
});

// ─── Server actions contract ────────────────────────────────────────────────────

describe("google-integration server actions", () => {
  it("exports disconnect, test, refresh, list actions", () => {
    const content = readFile("apps/web/src/app/actions/google-integration.ts");
    expect(content).toContain('"use server"');
    expect(content).toContain("disconnectGoogleIntegration");
    expect(content).toContain("testGoogleIntegration");
    expect(content).toContain("refreshGoogleIntegration");
    expect(content).toContain("getGoogleConnections");
  });

  it("uses requireUser and getActiveOrganization pattern", () => {
    const content = readFile("apps/web/src/app/actions/google-integration.ts");
    expect(content).toContain("requireUser");
    expect(content).toContain("getActiveOrganization");
    expect(content).not.toContain("getCurrentOrganizationId");
  });
});

// ─── Job handler: refresh_integration_token ────────────────────────────────────

describe("refresh_integration_token handler", () => {
  it("handler imports real Google token refresh utilities", () => {
    const content = readFile("apps/web/src/lib/jobs/handlers.ts");
    expect(content).toContain("isGoogleProvider");
    expect(content).toContain("refreshGoogleToken");
    expect(content).toContain("getDecryptedCredential");
    expect(content).toContain("storeCredential");
  });

  it("handler uses GOOGLE_CLIENT_ID env var", () => {
    const content = readFile("apps/web/src/lib/jobs/handlers.ts");
    expect(content).toContain("GOOGLE_CLIENT_ID");
    expect(content).toContain("GOOGLE_CLIENT_SECRET");
  });
});

// ─── credentials.ts file contract ────────────────────────────────────────────

describe("credentials.ts — file contract", () => {
  it("uses AES-256-GCM encryption", () => {
    const content = readFile("apps/web/src/lib/integrations/credentials.ts");
    expect(content).toContain("aes-256-gcm");
    expect(content).toContain("HUB_CREDENTIAL_ENCRYPTION_KEY");
    expect(content).toContain("store_hub_credential");
    expect(content).toContain("get_hub_credential");
    expect(content).toContain("delete_hub_credentials");
  });

  it("exports makeGetCredential callback builder", () => {
    const content = readFile("apps/web/src/lib/integrations/credentials.ts");
    expect(content).toContain("makeGetCredential");
  });
});
