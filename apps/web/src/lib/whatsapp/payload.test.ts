import { describe, expect, it } from "vitest";
import { messageBody, whatsappWebhookPayloadSchema } from "./payload";

describe("whatsapp webhook payload", () => {
  it("parses inbound text messages", () => {
    const payload = whatsappWebhookPayloadSchema.parse({
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba",
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "phone" },
                messages: [
                  {
                    from: "5491100000000",
                    id: "wamid.1",
                    timestamp: "123",
                    type: "text",
                    text: { body: "Hola" }
                  }
                ]
              }
            }
          ]
        }
      ]
    });

    const message = payload.entry[0]?.changes[0]?.value.messages?.[0];
    expect(message ? messageBody(message) : "").toBe("Hola");
  });

  it("normalizes media message bodies", () => {
    expect(
      messageBody({
        from: "1",
        id: "2",
        timestamp: "3",
        type: "document",
        document: { id: "media", filename: "propuesta.pdf" }
      }),
    ).toBe("propuesta.pdf");
  });
});
