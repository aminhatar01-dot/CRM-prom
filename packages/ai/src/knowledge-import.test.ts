import { describe, expect, it } from "vitest";
import { detectCatalogColumns, knowledgeImportSchema, normalizeCatalogRows } from "./knowledge-import";

describe("knowledge catalog import", () => {
  it("detects common product columns and normalizes rows", () => {
    const rows = [
      { Producto: "Taladro", Precio: 120000, Stock: 4, SKU: "T-01", Moneda: "ARS" },
      { Producto: "Martillo", Precio: 15000, Stock: 12, SKU: "M-02", Moneda: "ARS" }
    ];
    const result = normalizeCatalogRows(rows);
    expect(detectCatalogColumns(Object.keys(rows[0]))).toMatchObject({ product: "Producto", price: "Precio", stock: "Stock", sku: "SKU" });
    expect(result.content).toContain("product: Taladro");
    expect(result.content).toContain("price: 120000");
    expect(result.rowCount).toBe(2);
  });

  it("allows manual mapping when headers are custom", () => {
    const result = normalizeCatalogRows([{ ART: "Tornillo", PVP: "25.50", DISP: "Si" }], {
      product: "ART",
      price: "PVP",
      availability: "DISP"
    });
    expect(result.content).toContain("product: Tornillo");
    expect(result.content).toContain("availability: Si");
  });

  it("requires a URL for public URL and Google Sheets sources", () => {
    expect(knowledgeImportSchema.safeParse({ name: "Catalogo", source_type: "url", category: "productos", column_mapping: {} }).success).toBe(false);
  });
});
