import { describe, expect, it } from "vitest";
import {
  normalizeOrganizationSlug,
  organizationFormSchema,
  organizationSchema,
  suggestOrganizationSlug
} from "./tenant";

describe("organizationSchema", () => {
  it("accepts a valid organization payload", () => {
    expect(
      organizationSchema.parse({
        name: "Equipo Comercial",
        slug: "equipo-comercial"
      }),
    ).toEqual({
      name: "Equipo Comercial",
      slug: "equipo-comercial"
    });
  });

  it("rejects unsafe slugs", () => {
    expect(() =>
      organizationSchema.parse({
        name: "Equipo Comercial",
        slug: "Equipo Comercial!"
      }),
    ).toThrow();
  });

  it("generates a slug from the organization name", () => {
    expect(
      organizationFormSchema.parse({
        name: "Inmobiliaria Cordoba",
        slug: ""
      })
    ).toEqual({
      name: "Inmobiliaria Cordoba",
      slug: "inmobiliaria-cordoba"
    });
  });

  it("rejects an invalid manually entered slug", () => {
    expect(() =>
      organizationFormSchema.parse({
        name: "Equipo Comercial",
        slug: "Equipo Comercial!"
      })
    ).toThrow();
  });

  it("normalizes names and suggests a bounded alternative", () => {
    expect(normalizeOrganizationSlug("  Gestión & Ventas  ")).toBe("gestion-ventas");
    expect(suggestOrganizationSlug("equipo-comercial", "a1b2c3")).toBe(
      "equipo-comercial-a1b2c3"
    );
  });
});
