import { describe, expect, it } from "vitest";
import { matchCatalogProduct, parseCatalogSources } from "./catalog";

const source = (content: string) => ({ documentId: "00000000-0000-4000-8000-000000000001", title: "Lista de precios", category: "catalogo", content, score: 0.92 });

describe("quote catalog matching", () => {
  it("finds a product by partial name with verified price", () => {
    const products = parseCatalogSources([source("Registro 1\nproduct: Taladro profesional 20V\nprice: 120000\ncurrency: ARS\nstock: 4\nsku: TAL-20")]);
    expect(matchCatalogProduct("taladro profesional", products)).toMatchObject({ kind: "match", product: { name: "Taladro profesional 20V", price: 120000 } });
  });

  it("requires clarification for ambiguous products", () => {
    const products = parseCatalogSources([source("Registro 1\nproduct: Taladro 12V\nprice: 90000\n\nRegistro 2\nproduct: Taladro 20V\nprice: 120000")]);
    expect(matchCatalogProduct("taladro", products).kind).toBe("ambiguous");
  });

  it("does not quote a product without a price", () => {
    const products = parseCatalogSources([source("Registro 1\nproduct: Instalacion premium\navailability: consultar")]);
    expect(matchCatalogProduct("instalacion premium", products).kind).toBe("missing_price");
  });
});
