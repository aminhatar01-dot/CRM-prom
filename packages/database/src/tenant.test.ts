import { describe, expect, it } from "vitest";
import { organizationSchema } from "./tenant";

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
});
