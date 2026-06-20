import { expect, test } from "@playwright/test";

const protectedRoutes = [
  "/dashboard",
  "/leads",
  "/contacts",
  "/inbox",
  "/assistants",
  "/smart-tags",
  "/variables",
  "/automations",
  "/integrations",
  "/settings/channels/whatsapp",
  "/settings/channels/webchat",
  "/settings/system-status"
];

test("@smoke healthcheck responds with the QA environment", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toMatchObject({
    status: "ok",
    features: { ai: "demo" }
  });
});

test("@smoke protected CRM modules require authentication", async ({ request }) => {
  for (const route of protectedRoutes) {
    const response = await request.get(route, { maxRedirects: 0 });
    expect(response.status(), route).toBe(307);
    expect(response.headers().location, route).toBe("/login");
  }
});

test("@smoke WhatsApp verification endpoint accepts only the configured token", async ({ request }) => {
  const accepted = await request.get(
    "/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=qa-whatsapp-verify-token&hub.challenge=qa-ok"
  );
  const rejected = await request.get(
    "/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=qa-no"
  );

  expect(accepted.status()).toBe(200);
  expect(await accepted.text()).toBe("qa-ok");
  expect(rejected.status()).toBe(403);
});

test("@smoke WebChat exposes its widget and rejects malformed requests", async ({ request }) => {
  const widget = await request.get("/widget/crm-pro-ai-widget.js");
  const malformedStart = await request.post("/api/webchat/start", { data: {} });
  const malformedMessage = await request.post("/api/webchat/message", { data: {} });

  expect(widget.status()).toBe(200);
  expect(widget.headers()["content-type"]).toContain("application/javascript");
  expect(await widget.text()).toContain("crm-pro-ai-webchat");
  expect(malformedStart.status()).toBe(400);
  expect(malformedMessage.status()).toBe(400);
});
