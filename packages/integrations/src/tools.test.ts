import { describe, expect, it } from "vitest";
import { customConnectToolSchema, integrationSchema, validateToolTenant } from "./tools";

const organizationId = "00000000-0000-4000-8000-000000000001";

describe("integration schemas", () => {
  it("validates integration creation", () => {
    const integration = integrationSchema.parse({
      organization_id: organizationId,
      name: "Demo Custom",
      kind: "custom_connect",
      active: false,
      config: {}
    });

    expect(integration.kind).toBe("custom_connect");
  });

  it("validates custom connect URL and method", () => {
    const valid = customConnectToolSchema.safeParse({
      organization_id: organizationId,
      name: "CRM API",
      method: "POST",
      url: "https://api.example.com/search",
      headers_schema: {},
      body_schema: {},
      response_schema: {},
      active: true,
      timeout_ms: 5000,
      config: {}
    });
    const invalid = customConnectToolSchema.safeParse({
      organization_id: organizationId,
      name: "Broken",
      method: "TRACE",
      url: "not-a-url",
      headers_schema: {},
      body_schema: {},
      response_schema: {}
    });

    expect(valid.success).toBe(true);
    expect(invalid.success).toBe(false);
  });

  it("rejects cross tenant tool execution", () => {
    expect(() => validateToolTenant(organizationId, "00000000-0000-4000-8000-000000000099")).toThrow(
      "Cross-tenant tool execution rejected",
    );
  });
});
