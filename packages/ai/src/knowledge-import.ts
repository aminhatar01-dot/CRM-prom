import { z } from "zod";

export const knowledgeImportTypes = ["csv", "xlsx", "pdf", "docx", "txt", "google_sheets", "url"] as const;

export const knowledgeImportSchema = z.object({
  name: z.string().trim().min(2).max(160),
  source_type: z.enum(knowledgeImportTypes),
  source_url: z.string().trim().url().max(2000).optional().nullable(),
  category: z.string().trim().min(2).max(80).default("general"),
  column_mapping: z.record(z.string().trim().max(120)).default({})
}).superRefine((value, context) => {
  if (["url", "google_sheets"].includes(value.source_type) && !value.source_url) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["source_url"], message: "La URL es obligatoria." });
  }
});

export const catalogFields = ["product", "service", "price", "stock", "category", "description", "code", "sku", "currency", "availability"] as const;
export type CatalogField = (typeof catalogFields)[number];
export type ColumnMapping = Partial<Record<CatalogField, string>>;

const aliases: Record<CatalogField, string[]> = {
  product: ["producto", "product", "articulo", "item", "nombre"],
  service: ["servicio", "service"],
  price: ["precio", "price", "valor", "importe", "costo"],
  stock: ["stock", "cantidad", "existencia", "unidades"],
  category: ["categoria", "category", "rubro", "familia"],
  description: ["descripcion", "description", "detalle", "caracteristicas"],
  code: ["codigo", "code", "cod"],
  sku: ["sku"],
  currency: ["moneda", "currency", "divisa"],
  availability: ["disponibilidad", "available", "availability", "estado"]
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function detectCatalogColumns(headers: string[]): ColumnMapping {
  const result: ColumnMapping = {};
  for (const field of catalogFields) {
    const match = headers.find((header) => aliases[field].includes(normalize(header)));
    if (match) result[field] = match;
  }
  return result;
}

export function normalizeCatalogRows(
  rows: Array<Record<string, unknown>>,
  manualMapping: ColumnMapping = {},
) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const mapping = { ...detectCatalogColumns(headers), ...manualMapping };
  const content = rows.map((row, index) => {
    const fields = catalogFields.flatMap((field) => {
      const column = mapping[field];
      const value = column ? row[column] : undefined;
      return value === undefined || value === null || String(value).trim() === ""
        ? []
        : [`${field}: ${String(value).trim()}`];
    });
    return fields.length ? `Registro ${index + 1}\n${fields.join("\n")}` : "";
  }).filter(Boolean);

  return { content: content.join("\n\n"), mapping, rowCount: content.length, headers };
}
