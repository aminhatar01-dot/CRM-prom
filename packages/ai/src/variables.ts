import { z } from "zod";

export const variableTypes = ["text", "long_text", "number", "price", "boolean", "option", "link"] as const;

export const variableSchema = z.object({
  name: z.string().trim().min(2).max(80),
  key: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z][a-z0-9_]*$/),
  description: z.string().trim().max(500).optional().nullable(),
  type: z.enum(variableTypes),
  extraction_prompt: z.string().trim().min(10).max(2000),
  active: z.boolean().default(true),
  required: z.boolean().default(false),
  options: z.array(z.string().trim().min(1).max(80)).default([])
});

export const variableUpdateSchema = variableSchema.extend({
  id: z.string().uuid()
});

export type VariableDefinition = z.infer<typeof variableSchema> & {
  id: string;
  organization_id: string;
};

export type VariableExtractionContext = {
  lead?: {
    id?: string;
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
  };
  messages: Array<{
    id?: string;
    direction: "inbound" | "outbound";
    body: string;
  }>;
};

export type VariableExtractionResult = {
  variableId: string;
  extracted: boolean;
  value: unknown;
  confidence: number;
  sourceMessageId?: string | null;
  reason: string;
};

export function validateVariableValue(type: (typeof variableTypes)[number], value: unknown, options: string[] = []) {
  if (value === null || value === undefined || value === "") return null;
  if (type === "text" || type === "long_text") return String(value);
  if (type === "number" || type === "price") {
    const numberValue = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.-]/g, ""));
    if (Number.isNaN(numberValue)) throw new Error("Invalid numeric value");
    return numberValue;
  }
  if (type === "boolean") {
    if (typeof value === "boolean") return value;
    const normalized = String(value).toLowerCase();
    if (["true", "si", "sí", "yes", "1"].includes(normalized)) return true;
    if (["false", "no", "0"].includes(normalized)) return false;
    throw new Error("Invalid boolean value");
  }
  if (type === "option") {
    const option = String(value);
    if (options.length > 0 && !options.includes(option)) throw new Error("Invalid option value");
    return option;
  }
  if (type === "link") {
    const url = String(value);
    new URL(url);
    return url;
  }

  return value;
}
