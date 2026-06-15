import { z } from "zod";

export const organizationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
});

export type OrganizationInput = z.infer<typeof organizationSchema>;
