import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns a structured health payload", async () => {
    const response = await GET();
    const payload = (await response.json()) as { status: string; env: unknown; features: unknown };

    expect([200, 503]).toContain(response.status);
    expect(payload.status).toMatch(/ok|degraded/);
    expect(payload.env).toBeTruthy();
    expect(payload.features).toBeTruthy();
  });
});
