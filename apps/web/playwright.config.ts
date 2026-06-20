import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
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
    command: "npm run dev --workspace @crm-pro-ai/web -- --port 3100",
    url: "http://localhost:3100",
    reuseExistingServer: false,
    env: {
      NEXT_PUBLIC_APP_URL: "http://localhost:3100",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "qa-local-anon-key",
      AI_DEMO_MODE: "true",
      WHATSAPP_VERIFY_TOKEN: "qa-whatsapp-verify-token"
    }
  }
});
