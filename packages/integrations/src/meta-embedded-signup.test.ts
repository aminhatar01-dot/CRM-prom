import { describe, expect, it, vi } from "vitest";
import { MetaEmbeddedSignupService } from "./meta-embedded-signup";

describe("MetaEmbeddedSignupService", () => {
  it("exchanges the embedded signup code and discovers WhatsApp assets", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ access_token: "business-token", token_type: "bearer", expires_in: 3600 }))
      .mockResolvedValueOnce(response({
        data: { app_id: "app-1", type: "BUSINESS", is_valid: true, scopes: ["whatsapp_business_management"] }
      }))
      .mockResolvedValueOnce(response({
        data: [{
          id: "phone-1",
          display_phone_number: "+5491100000000",
          verified_name: "CRM Demo",
          quality_rating: "GREEN",
          status: "CONNECTED"
        }]
      }))
      .mockResolvedValueOnce(response({ success: true }));
    const service = new MetaEmbeddedSignupService({
      appId: "app-1",
      appSecret: "secret",
      graphApiVersion: "v23.0",
      fetcher
    });

    const token = await service.exchangeCode("temporary-code");
    const debug = await service.debugToken(token.access_token);
    const phones = await service.getPhoneNumbers("waba-1", token.access_token);
    const subscription = await service.subscribeApp("waba-1", token.access_token);

    expect(token.access_token).toBe("business-token");
    expect(debug.is_valid).toBe(true);
    expect(phones[0]?.id).toBe("phone-1");
    expect(subscription.success).toBe(true);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("/oauth/access_token");
    expect(String(fetcher.mock.calls[2]?.[0])).toContain("/waba-1/phone_numbers");
  });

  it("attempts long-lived token renewal through the official exchange endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ access_token: "renewed-token", expires_in: 5_184_000 }));
    const service = new MetaEmbeddedSignupService({
      appId: "app-1",
      appSecret: "secret",
      fetcher
    });

    const refreshed = await service.refreshLongLivedToken("old-token");

    expect(refreshed.access_token).toBe("renewed-token");
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("grant_type=fb_exchange_token");
  });
});

function response(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => body
  };
}
