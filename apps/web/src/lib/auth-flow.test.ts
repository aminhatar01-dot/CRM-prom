import { describe, expect, it } from "vitest";
import { getRequestOrigin, isSupportedOtpType, postAuthPath } from "./auth-flow";

function headers(values: Record<string, string>) {
  return {
    get(name: string) {
      return values[name.toLowerCase()] ?? null;
    }
  };
}

describe("Supabase auth flow", () => {
  it("uses Vercel forwarded headers for the magic link origin", () => {
    expect(
      getRequestOrigin(
        headers({
          "x-forwarded-host": "crm-prom.vercel.app",
          "x-forwarded-proto": "https"
        }),
        { NEXT_PUBLIC_APP_URL: "http://localhost:3000", NODE_ENV: "production" }
      )
    ).toBe("https://crm-prom.vercel.app");
  });

  it("falls back to the configured app URL outside a request", () => {
    expect(
      getRequestOrigin(headers({}), {
        NEXT_PUBLIC_APP_URL: "https://crm-prom.vercel.app/"
      })
    ).toBe("https://crm-prom.vercel.app");
  });

  it("accepts email magic-link OTP types", () => {
    expect(isSupportedOtpType("email")).toBe(true);
    expect(isSupportedOtpType("magiclink")).toBe(true);
    expect(isSupportedOtpType("unknown")).toBe(false);
  });

  it("routes users according to organization membership", () => {
    expect(postAuthPath(false)).toBe("/onboarding");
    expect(postAuthPath(true)).toBe("/dashboard");
  });
});
