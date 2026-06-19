import { describe, expect, it } from "vitest";
import { getHealthStatus } from "./health";

describe("health status", () => {
  it("returns ok when required env is valid", () => {
    const health = getHealthStatus({
      NEXT_PUBLIC_SUPABASE_URL: "https://widehqbtmqiebaowidav.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      OPENAI_API_KEY: "sk-test",
      AI_DEMO_MODE: "false",
      CRON_SECRET: "secret"
    } as NodeJS.ProcessEnv);

    expect(health.status).toBe("ok");
    expect(health.features.ai).toBe("openai");
    expect(health.features.cronConfigured).toBe(true);
  });
});
