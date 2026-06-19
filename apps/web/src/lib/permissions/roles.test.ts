import { describe, expect, it } from "vitest";
import { canManageIntegrations, canManageSettings, canUseInbox, roleCapabilities } from "./roles";

describe("role permissions", () => {
  it("allows owner and admin to manage settings", () => {
    expect(canManageSettings("owner")).toBe(true);
    expect(canManageSettings("admin")).toBe(true);
    expect(canManageIntegrations("admin")).toBe(true);
  });

  it("keeps agents focused on operational CRM", () => {
    expect(canManageSettings("agent")).toBe(false);
    expect(canUseInbox("agent")).toBe(true);
    expect(roleCapabilities("agent")).toMatchObject({ manageSettings: false, useInbox: true });
  });
});
