import crypto from "node:crypto";
import { z } from "zod";
import {
  whatsappSendMediaSchema,
  whatsappSendTextSchema,
  type WhatsAppSendMediaInput,
  type WhatsAppSendTextInput
} from "./whatsapp";

const graphResponseSchema = z.object({
  messaging_product: z.string().optional(),
  contacts: z.array(z.object({ input: z.string(), wa_id: z.string() })).optional(),
  messages: z.array(z.object({ id: z.string() })).optional()
});

export type WhatsAppCloudServiceConfig = {
  accessToken: string;
  phoneNumberId: string;
  graphApiVersion?: string;
  appSecret?: string;
};

export class WhatsAppCloudService {
  private readonly accessToken: string;
  private readonly phoneNumberId: string;
  private readonly graphApiVersion: string;
  private readonly appSecret?: string;

  constructor(config: WhatsAppCloudServiceConfig) {
    this.accessToken = config.accessToken;
    this.phoneNumberId = config.phoneNumberId;
    this.graphApiVersion = config.graphApiVersion ?? "v23.0";
    this.appSecret = config.appSecret;
  }

  verifySignature(rawBody: string, signatureHeader: string | null) {
    if (!this.appSecret) return true;
    if (!signatureHeader?.startsWith("sha256=")) return false;

    const expected = crypto
      .createHmac("sha256", this.appSecret)
      .update(rawBody)
      .digest("hex");
    const actual = signatureHeader.replace("sha256=", "");
    if (actual.length !== expected.length) return false;

    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
  }

  async sendText(input: WhatsAppSendTextInput) {
    const parsed = whatsappSendTextSchema.parse(input);
    return this.postMessage({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: parsed.to,
      type: "text",
      text: {
        preview_url: false,
        body: parsed.body
      }
    });
  }

  async sendMedia(input: WhatsAppSendMediaInput) {
    const parsed = whatsappSendMediaSchema.parse(input);
    return this.postMessage({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: parsed.to,
      type: parsed.type,
      [parsed.type]: {
        id: parsed.mediaId,
        caption: parsed.caption
      }
    });
  }

  private async postMessage(payload: Record<string, unknown>) {
    const response = await fetch(
      `https://graph.facebook.com/${this.graphApiVersion}/${this.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      },
    );
    const body = (await response.json()) as unknown;

    if (!response.ok) {
      throw new WhatsAppCloudError("WhatsApp Cloud API request failed.", response.status, body);
    }

    return graphResponseSchema.parse(body);
  }
}

export class WhatsAppCloudError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload: unknown,
  ) {
    super(message);
    this.name = "WhatsAppCloudError";
  }
}
