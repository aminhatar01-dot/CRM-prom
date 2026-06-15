import { z } from "zod";

export const assistantTones = ["professional", "friendly", "direct", "warm"] as const;

export const assistantConfigSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(2).max(80),
  description: z.string().max(500).optional().nullable(),
  prompt: z.string().min(20).max(8000),
  objective: z.string().max(1000).optional().nullable(),
  tone: z.enum(assistantTones).default("professional"),
  rules: z.string().max(4000).optional().nullable(),
  fallback_message: z.string().min(2).max(1000),
  active: z.boolean().default(true),
  channel_id: z.string().max(80).optional().nullable(),
  auto_reply_enabled: z.boolean().default(false)
});

export type AssistantConfig = z.infer<typeof assistantConfigSchema>;

export const assistantFormSchema = assistantConfigSchema.omit({ organization_id: true });

export const assistantTestSchema = z.object({
  assistant_id: z.string().uuid(),
  conversation_id: z.string().uuid().optional().nullable(),
  input: z.string().trim().min(1).max(2000)
});

export type AssistantTestInput = z.infer<typeof assistantTestSchema>;

export type AIMessageContext = {
  direction: "inbound" | "outbound";
  body: string;
  channel: string;
  status: string;
  created_at: string;
};

export type AIConversationContext = {
  id: string;
  channel: string;
  status: string;
  ai_status: string;
  metadata?: Record<string, unknown>;
};

export type AIPersonContext = {
  kind: "lead" | "contact" | "unknown";
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  status?: string | null;
  notes?: string | null;
};

export type AIContext = {
  organizationName: string;
  assistant: AssistantConfig;
  conversation?: AIConversationContext;
  person?: AIPersonContext;
  messages: AIMessageContext[];
  userInput?: string;
};
