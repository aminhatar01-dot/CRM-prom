import { z } from "zod";

const whatsappTextSchema = z.object({
  body: z.string().default("")
});

const whatsappMediaSchema = z.object({
  id: z.string(),
  mime_type: z.string().optional(),
  caption: z.string().optional(),
  filename: z.string().optional()
});

const whatsappLocationSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  name: z.string().optional(),
  address: z.string().optional()
});

export const whatsappWebhookPayloadSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.object({
            messaging_product: z.string().optional(),
            metadata: z
              .object({
                display_phone_number: z.string().optional(),
                phone_number_id: z.string()
              })
              .optional(),
            contacts: z
              .array(
                z.object({
                  wa_id: z.string(),
                  profile: z.object({ name: z.string().optional() }).optional()
                }),
              )
              .optional(),
            messages: z
              .array(
                z.object({
                  from: z.string(),
                  id: z.string(),
                  timestamp: z.string(),
                  type: z.enum(["text", "image", "audio", "document", "location"]),
                  text: whatsappTextSchema.optional(),
                  image: whatsappMediaSchema.optional(),
                  audio: whatsappMediaSchema.optional(),
                  document: whatsappMediaSchema.optional(),
                  location: whatsappLocationSchema.optional()
                }),
              )
              .optional(),
            statuses: z
              .array(
                z.object({
                  id: z.string(),
                  status: z.enum(["sent", "delivered", "read", "failed"]),
                  timestamp: z.string().optional(),
                  recipient_id: z.string().optional(),
                  errors: z.array(z.unknown()).optional()
                }),
              )
              .optional()
          })
        }),
      )
    }),
  )
});

export type WhatsAppWebhookPayload = z.infer<typeof whatsappWebhookPayloadSchema>;
export type WhatsAppWebhookMessage = NonNullable<
  WhatsAppWebhookPayload["entry"][number]["changes"][number]["value"]["messages"]
>[number];

export function messageBody(message: WhatsAppWebhookMessage) {
  if (message.type === "text") return message.text?.body ?? "";
  if (message.type === "image") return message.image?.caption ?? "[imagen]";
  if (message.type === "audio") return "[audio]";
  if (message.type === "document") return message.document?.filename ?? message.document?.caption ?? "[documento]";
  if (message.type === "location") {
    const location = message.location;
    return location?.name ?? location?.address ?? `[ubicacion ${location?.latitude}, ${location?.longitude}]`;
  }

  return "[mensaje]";
}
