import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");

describe("production auth contract", () => {
  it("uses the request origin and the configured app URL name", () => {
    const action = readFileSync(
      resolve(root, "apps/web/src/app/login/actions.ts"),
      "utf8"
    );

    expect(action).toContain("getRequestOrigin");
    expect(action).toContain("emailRedirectTo");
    expect(action).not.toContain("NEXT_PUBLIC_SITE_URL");
  });

  it("checks callback errors before choosing onboarding or dashboard", () => {
    const callback = readFileSync(
      resolve(root, "apps/web/src/app/auth/callback/route.ts"),
      "utf8"
    );

    expect(callback).toContain("exchangeCodeForSession");
    expect(callback).toContain("verifyOtp");
    expect(callback).toContain("if (authError)");
    expect(callback).toContain("organization_members");
    expect(callback).toContain("postAuthPath");
  });
});
