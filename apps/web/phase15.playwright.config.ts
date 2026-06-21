import { defineConfig, devices } from "@playwright/test";

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PHASE14_TEST_EMAIL",
  "PHASE14_TEST_PASSWORD"
] as const;

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`${name} is required for the Phase 15 pipeline suite.`);
  }
}

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "phase15-pipeline.spec.ts",
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "line" : "list",
  timeout: 300_000,
  expect: {
    timeout: 30_000
  },
  use: {
    baseURL: "http://127.0.0.1:3210",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.QA_BROWSER_CHANNEL ?? "chrome"
      }
    }
  ],
  webServer: {
    command: "npm run build --workspace @crm-pro-ai/web && npm run start --workspace @crm-pro-ai/web -- --hostname 127.0.0.1 --port 3210",
    url: "http://127.0.0.1:3210/api/health",
    reuseExistingServer: false,
    timeout: 300_000,
    env: {
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3210",
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
      AI_DEMO_MODE: "true"
    }
  }
});
