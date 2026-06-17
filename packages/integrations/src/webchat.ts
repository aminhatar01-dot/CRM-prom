import { z } from "zod";

export const webchatWidgetPositions = ["bottom-right", "bottom-left"] as const;

const optionalUuid = z
  .string()
  .uuid()
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : null));

const optionalEmail = z
  .string()
  .trim()
  .email()
  .or(z.literal(""))
  .optional()
  .transform((value) => (value ? value : null));

export const webchatWidgetSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  primary_color: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).default("#0f766e"),
  initial_message: z.string().trim().min(1).max(500),
  position: z.enum(webchatWidgetPositions).default("bottom-right"),
  active: z.boolean().default(false),
  allowed_domains: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  assistant_id: optionalUuid
});

export const webchatStartSchema = z.object({
  token: z.string().trim().min(10).max(120),
  visitor_id: z.string().trim().max(120).optional(),
  name: z.string().trim().max(120).optional().default(""),
  email: optionalEmail,
  phone: z.string().trim().max(40).optional().default(""),
  page_url: z.string().url().optional()
});

export const webchatMessageSchema = z.object({
  token: z.string().trim().min(10).max(120),
  conversation_id: z.string().uuid(),
  visitor_id: z.string().trim().max(120).optional(),
  body: z.string().trim().min(1).max(2000)
});

export const webchatHistorySchema = z.object({
  token: z.string().trim().min(10).max(120),
  conversation_id: z.string().uuid()
});

export type WebchatWidgetInput = z.infer<typeof webchatWidgetSchema>;
export type WebchatStartInput = z.infer<typeof webchatStartSchema>;
export type WebchatMessageInput = z.infer<typeof webchatMessageSchema>;

export function normalizeDomain(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";

  try {
    return new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`).hostname;
  } catch {
    return trimmed.replace(/^https?:\/\//, "").split("/")[0];
  }
}

export function isAllowedWebchatOrigin(origin: string | null, allowedDomains: string[]) {
  if (!origin) return false;
  const originDomain = normalizeDomain(origin);
  return allowedDomains.some((domain) => {
    const allowedDomain = normalizeDomain(domain);
    return originDomain === allowedDomain || originDomain.endsWith(`.${allowedDomain}`);
  });
}

export function isLocalDemoOrigin(origin: string | null) {
  if (!origin) return false;
  return ["localhost", "127.0.0.1", "::1"].includes(normalizeDomain(origin));
}
