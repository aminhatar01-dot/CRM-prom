import { z } from "zod";

export const externalToolSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(2).max(80),
  kind: z.enum(["google_sheets", "http_custom"]),
  enabled: z.boolean().default(true)
});

export type ExternalTool = z.infer<typeof externalToolSchema>;
