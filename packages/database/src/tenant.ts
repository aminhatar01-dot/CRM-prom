import { z } from "zod";

const organizationNameSchema = z.string().trim().min(2).max(80);

export const organizationSchema = z.object({
  name: organizationNameSchema,
  slug: z
    .string()
    .trim()
    .min(2)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
});

export const organizationFormSchema = z
  .object({
    name: organizationNameSchema,
    slug: z
      .string()
      .trim()
      .max(60)
      .optional()
      .default("")
      .refine((value) => !value || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value), {
        message: "Invalid organization slug"
      })
  })
  .transform((value) => ({
    name: value.name,
    slug: normalizeOrganizationSlug(value.slug || value.name)
  }))
  .pipe(organizationSchema);

export type OrganizationInput = z.infer<typeof organizationSchema>;

export function normalizeOrganizationSlug(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");

  return normalized || "workspace";
}

export function suggestOrganizationSlug(slug: string, suffix: string) {
  const safeSuffix = normalizeOrganizationSlug(suffix).slice(0, 8);
  const maxBaseLength = Math.max(2, 60 - safeSuffix.length - 1);
  const base = normalizeOrganizationSlug(slug).slice(0, maxBaseLength).replace(/-+$/g, "");
  return `${base}-${safeSuffix}`;
}
