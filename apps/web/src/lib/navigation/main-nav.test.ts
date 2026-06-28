import { describe, expect, it } from "vitest";
import { mainNavigationItems, navigationForRole } from "./main-nav";

describe("main navigation smoke test", () => {
  it("contains the core production sections", () => {
    expect(mainNavigationItems.map((item) => item.href)).toEqual(
      expect.arrayContaining([
        "/dashboard",
        "/leads",
        "/pipeline",
        "/inbox",
        "/quotes",
        "/assistants",
        "/knowledge",
        "/integrations",
        "/settings/system-status"
        ,"/settings/setup"
      ]),
    );
  });

  it("hides admin-only setup from agents", () => {
    const agentLinks = navigationForRole("agent").map((item) => item.href);

    expect(agentLinks).toContain("/inbox");
    expect(agentLinks).toContain("/pipeline");
    expect(agentLinks).toContain("/quotes");
    expect(agentLinks).not.toContain("/integrations");
    expect(agentLinks).not.toContain("/settings/system-status");
  });
});
