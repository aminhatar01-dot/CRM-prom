import crypto from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhatsAppCloudService } from "./whatsapp-cloud-service";

describe("WhatsAppCloudService", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("verifies Meta signatures when an app secret is configured", () => {
    const rawBody = JSON.stringify({ object: "whatsapp_business_account" });
    const signature = crypto.createHmac("sha256", "secret").update(rawBody).digest("hex");
    const service = new WhatsAppCloudService({
      accessToken: "token",
      phoneNumberId: "phone",
      appSecret: "secret"
    });

    expect(service.verifySignature(rawBody, `sha256=${signature}`)).toBe(true);
    expect(service.verifySignature(rawBody, "sha256=bad")).toBe(false);
  });

  it("sends text messages through the Graph messages endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        messaging_product: "whatsapp",
        messages: [{ id: "wamid.test" }]
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const service = new WhatsAppCloudService({
      accessToken: "token",
      phoneNumberId: "123",
      graphApiVersion: "v23.0"
    });

    const response = await service.sendText({ to: "5491100000000", body: "Hola" });

    expect(response.messages?.[0]?.id).toBe("wamid.test");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v23.0/123/messages",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer token"
        })
      }),
    );
  });
});
