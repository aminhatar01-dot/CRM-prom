import { describe, expect, it } from "vitest";
import { validateServerEnv } from "./env";

describe("env validation", () => {
  it("accepts required production env vars", () => {
    const result = validateServerEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://widehqbtmqiebaowidav.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      AI_DEMO_MODE: "true"
    } as NodeJS.ProcessEnv);

    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it("reports missing required env vars", () => {
    const result = validateServerEnv({} as NodeJS.ProcessEnv);

    expect(result.ok).toBe(false);
    expect(result.missing).toEqual(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
  });
});
