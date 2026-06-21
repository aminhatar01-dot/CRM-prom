import { z } from "zod";

export const integrationKinds = ["custom_connect", "google_sheets"] as const;
export const integrationToolTypes = ["custom_connect", "google_sheets"] as const;
export const httpMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

const jsonRecordSchema = z.record(z.unknown()).default({});
const optionalText = (max = 1000) =>
  z
    .string()
    .trim()
    .max(max)
    .or(z.literal(""))
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

export const integrationSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  description: optionalText(1000),
  kind: z.enum(integrationKinds),
  active: z.boolean().default(false),
  credentials_ref: optionalText(160),
  config: jsonRecordSchema
});

export const customConnectToolSchema = z.object({
  organization_id: z.string().uuid(),
  integration_id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(100),
  description: optionalText(1000),
  type: z.literal("custom_connect").default("custom_connect"),
  method: z.enum(httpMethods),
  url: z
    .string()
    .trim()
    .refine((value) => value.startsWith("mock://") || z.string().url().safeParse(value).success, {
      message: "URL must be valid or use mock:// for demo mode"
    }),
  headers_schema: jsonRecordSchema,
  body_schema: jsonRecordSchema,
  response_schema: jsonRecordSchema,
  active: z.boolean().default(false),
  timeout_ms: z.coerce.number().int().min(1000).max(30000).default(8000),
  config: jsonRecordSchema
});

export const googleSheetsConnectionSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  description: optionalText(1000),
  spreadsheet_url: z
    .string()
    .trim()
    .refine((value) => value.startsWith("demo://") || z.string().url().safeParse(value).success, {
      message: "Spreadsheet URL must be public or use demo://"
    }),
  sheet_name: optionalText(120),
  api_key_ref: optionalText(160),
  active: z.boolean().default(false)
});

export const toolRunInputSchema = z.object({
  tool_id: z.string().uuid(),
  input: jsonRecordSchema
});

export type Integration = z.infer<typeof integrationSchema>;
export type CustomConnectTool = z.infer<typeof customConnectToolSchema>;
export type GoogleSheetsConnection = z.infer<typeof googleSheetsConnectionSchema>;
export type ToolRunInput = z.infer<typeof toolRunInputSchema>;

export type AvailableTool = {
  id: string;
  name: string;
  description?: string | null;
  type: (typeof integrationToolTypes)[number];
  input_schema: Record<string, unknown>;
};

export function validateToolTenant(toolOrganizationId: string, requestedOrganizationId: string) {
  if (toolOrganizationId !== requestedOrganizationId) {
    throw new Error("Cross-tenant tool execution rejected");
  }
}

export function availableToolSummary(tools: AvailableTool[]) {
  return tools.map((tool) => ({
    id: tool.id,
    name: tool.name,
    type: tool.type,
    description: tool.description ?? null,
    input_schema: tool.input_schema
  }));
}
