import { describe, expect, it } from "vitest";
import { canUseWidgetFromOrigin } from "./security";
import { checkWebchatRateLimit, resetWebchatRateLimit } from "./rate-limit";

describe("webchat public security", () => {
  it("blocks domains outside the widget allowlist", () => {
    expect(
      canUseWidgetFromOrigin({
        origin: "https://blocked.example",
        allowedDomains: ["crm.example"]
      }),
    ).toBe(false);
  });

  it("allows local demo mode", () => {
    expect(
      canUseWidgetFromOrigin({
        origin: "http://localhost:3000",
        allowedDomains: ["crm.example"]
      }),
    ).toBe(true);
  });

  it("rate limits repeated public calls", () => {
    resetWebchatRateLimit();
    expect(checkWebchatRateLimit("demo", 1, 60_000)).toBe(true);
    expect(checkWebchatRateLimit("demo", 1, 60_000)).toBe(false);
  });
});
