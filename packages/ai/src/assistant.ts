import { z } from "zod";

export const assistantConfigSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(2).max(80),
  prompt: z.string().min(20).max(8000),
  tone: z.enum(["professional", "friendly", "direct", "warm"]).default("professional"),
  fallback_message: z.string().min(2).max(1000)
});

export type AssistantConfig = z.infer<typeof assistantConfigSchema>;
