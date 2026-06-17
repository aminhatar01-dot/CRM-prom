import { describe, expect, it } from "vitest";
import { isAllowedWebchatOrigin, isLocalDemoOrigin, normalizeDomain, webchatWidgetSchema } from "./webchat";

describe("webchat widget contracts", () => {
  it("validates widget creation", () => {
    const widget = webchatWidgetSchema.parse({
      organization_id: "00000000-0000-4000-8000-000000000001",
      name: "Demo WebChat",
      primary_color: "#0f766e",
      initial_message: "Hola",
      position: "bottom-right",
      active: false,
      allowed_domains: ["example.com"],
      assistant_id: ""
    });

    expect(widget.assistant_id).toBeNull();
  });

  it("normalizes and validates allowed domains", () => {
    expect(normalizeDomain("https://www.example.com/path")).toBe("www.example.com");
    expect(isAllowedWebchatOrigin("https://app.example.com", ["example.com"])).toBe(true);
    expect(isAllowedWebchatOrigin("https://evil.test", ["example.com"])).toBe(false);
  });

  it("supports local demo origins", () => {
    expect(isLocalDemoOrigin("http://localhost:3000")).toBe(true);
  });
});
