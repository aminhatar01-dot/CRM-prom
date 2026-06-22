import { z } from "zod";

export const whatsappMessageTypes = ["text", "image", "audio", "document", "location"] as const;

export const whatsappWebhookVerifySchema = z.object({
  "hub.mode": z.literal("subscribe"),
  "hub.verify_token": z.string().min(1),
  "hub.challenge": z.string().min(1)
});

export const whatsappInboundMessageSchema = z.object({
  from: z.string().min(3),
  id: z.string().min(1),
  timestamp: z.string().min(1),
  type: z.enum(whatsappMessageTypes)
});

export const whatsappSendTextSchema = z.object({
  to: z.string().min(3).max(32),
  body: z.string().trim().min(1).max(4096)
});

export const whatsappSendMediaSchema = z.object({
  to: z.string().min(3).max(32),
  type: z.enum(["image", "document"]),
  mediaId: z.string().min(1),
  caption: z.string().trim().max(1024).optional()
});

export type WhatsAppInboundMessage = z.infer<typeof whatsappInboundMessageSchema>;
export type WhatsAppSendTextInput = z.infer<typeof whatsappSendTextSchema>;
export type WhatsAppSendMediaInput = z.infer<typeof whatsappSendMediaSchema>;

export function normalizeWhatsAppRecipient(value: string) {
  const digits = value.replace(/\D/g, "");

  // Meta reports Argentine mobile wa_id values as 549..., but Cloud API
  // accepts test/recipient-list destinations in E.164 form without the 9.
  if (/^549\d{10}$/.test(digits)) {
    return `54${digits.slice(3)}`;
  }

  return digits;
}
