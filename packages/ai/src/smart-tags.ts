import { z } from "zod";

export const smartTagSchema = z.object({
  name: z.string().trim().min(2).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0f766e"),
  description: z.string().trim().max(500).optional().nullable(),
  classification_prompt: z.string().trim().min(10).max(2000),
  active: z.boolean().default(true),
  auto_pause_assistant: z.boolean().default(false),
  notify_team: z.boolean().default(false)
});

export const smartTagUpdateSchema = smartTagSchema.extend({
  id: z.string().uuid()
});

export const smartTagAssignmentSchema = z
  .object({
    tag_id: z.string().uuid(),
    lead_id: z.string().uuid().optional().nullable(),
    conversation_id: z.string().uuid().optional().nullable()
  })
  .refine((value) => value.lead_id || value.conversation_id, {
    message: "La asignacion necesita lead o conversacion."
  });

export type SmartTagInput = z.infer<typeof smartTagSchema>;

export type SmartTagDefinition = SmartTagInput & {
  id: string;
  organization_id: string;
};

export type SmartTagClassificationContext = {
  lead?: {
    name: string;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    status?: string | null;
    notes?: string | null;
  };
  conversation?: {
    id: string;
    channel: string;
    status: string;
    ai_status: string;
  };
  messages: Array<{
    direction: "inbound" | "outbound";
    body: string;
  }>;
};

export type SmartTagClassificationResult = {
  tagId: string;
  matched: boolean;
  confidence: number;
  reason: string;
};
