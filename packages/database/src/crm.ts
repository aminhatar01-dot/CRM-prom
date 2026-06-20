import { z } from "zod";

export const leadStatuses = [
  "nuevo",
  "contactado",
  "interesado",
  "propuesta",
  "ganado",
  "perdido"
] as const;

export const conversationStatuses = ["abierta", "pendiente", "cerrada"] as const;
export const conversationChannels = ["whatsapp", "webchat", "manual"] as const;
export const conversationAiStatuses = ["active", "paused", "human"] as const;
export const messageDirections = ["inbound", "outbound"] as const;
export const messageStatuses = ["pending", "sent", "delivered", "read", "failed"] as const;

const optionalEmail = z
  .string()
  .trim()
  .email()
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : null));

const optionalText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .or(z.literal(""))
    .optional()
    .transform((value) => (value ? value : null));

const optionalUuid = z
  .string()
  .uuid()
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : null));

export const leadInputSchema = z.object({
  first_name: z.string().trim().min(2).max(80),
  last_name: optionalText(80),
  email: optionalEmail,
  phone: optionalText(40),
  company: optionalText(120),
  source: optionalText(80),
  status: z.enum(leadStatuses).default("nuevo"),
  owner_id: optionalUuid,
  notes: optionalText(2000)
});

export const leadUpdateSchema = leadInputSchema.extend({
  id: z.string().uuid()
});

export const leadSearchSchema = z.object({
  q: z.string().trim().max(120).optional().default(""),
  status: z.enum(leadStatuses).or(z.literal("all")).optional().default("all")
});

export const contactInputSchema = z.object({
  first_name: z.string().trim().min(2).max(80),
  last_name: optionalText(80),
  email: optionalEmail,
  phone: optionalText(40),
  company: optionalText(120),
  location: optionalText(120),
  owner_id: optionalUuid,
  notes: optionalText(2000)
});

export const contactUpdateSchema = contactInputSchema.extend({
  id: z.string().uuid()
});

export const conversationInputSchema = z
  .object({
    lead_id: optionalUuid,
    contact_id: optionalUuid,
    channel: z.enum(conversationChannels).default("manual"),
    status: z.enum(conversationStatuses).default("abierta"),
    ai_status: z.enum(conversationAiStatuses).default("human"),
    owner_id: optionalUuid
  })
  .refine((value) => value.lead_id || value.contact_id, {
    message: "La conversacion necesita un lead o contacto asociado."
  });

export const conversationUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(conversationStatuses),
  ai_status: z.enum(conversationAiStatuses),
  owner_id: optionalUuid
});

export const messageInputSchema = z.object({
  conversation_id: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
  direction: z.enum(messageDirections).default("outbound"),
  channel: z.enum(conversationChannels).default("manual"),
  status: z.enum(messageStatuses).default("sent")
});

export const messageUpdateSchema = z.object({
  id: z.string().uuid(),
  conversation_id: z.string().uuid(),
  body: z.string().trim().min(1).max(4000)
});

export type LeadInput = z.infer<typeof leadInputSchema>;
export type ContactInput = z.infer<typeof contactInputSchema>;
export type ConversationInput = z.infer<typeof conversationInputSchema>;
export type MessageInput = z.infer<typeof messageInputSchema>;
