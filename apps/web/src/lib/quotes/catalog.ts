import type { KnowledgeSource } from "@crm-pro-ai/ai/knowledge";

export type CatalogProduct = {
  name: string;
  description: string | null;
  sku: string | null;
  code: string | null;
  price: number | null;
  currency: string | null;
  stock: string | null;
  availability: string | null;
  sourceDocumentId: string;
  sourceTitle: string;
  score: number;
};

export type CatalogMatch =
  | { kind: "match"; product: CatalogProduct }
  | { kind: "ambiguous"; products: CatalogProduct[] }
  | { kind: "missing_price"; product: CatalogProduct }
  | { kind: "not_found" };

export function parseCatalogSources(sources: KnowledgeSource[]): CatalogProduct[] {
  return sources.flatMap((source) => splitRecords(source.content).flatMap((record) => {
    const fields = parseFields(record);
    const name = fields.product || fields.service || fields.name || fields.nombre;
    if (!name) return [];
    return [{
      name,
      description: fields.description || fields.descripcion || null,
      sku: fields.sku || null,
      code: fields.code || fields.codigo || null,
      price: parsePrice(fields.price || fields.precio),
      currency: normalizeCurrency(fields.currency || fields.moneda),
      stock: fields.stock || null,
      availability: fields.availability || fields.disponibilidad || null,
      sourceDocumentId: source.documentId,
      sourceTitle: source.title,
      score: source.score
    }];
  }));
}

export function matchCatalogProduct(query: string, products: CatalogProduct[]): CatalogMatch {
  const queryTokens = tokens(query);
  if (queryTokens.length === 0) return { kind: "not_found" };
  const ranked = products
    .map((product) => ({ product, relevance: productRelevance(queryTokens, product) }))
    .filter((candidate) => candidate.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance || b.product.score - a.product.score);
  if (ranked.length === 0) return { kind: "not_found" };
  const top = ranked[0];
  const similarlyNamed = ranked.filter((candidate) => candidate.relevance >= top.relevance * 0.9).slice(0, 4);
  if (similarlyNamed.length > 1 && !exactIdentity(query, top.product)) {
    return { kind: "ambiguous", products: similarlyNamed.map((candidate) => candidate.product) };
  }
  if (top.product.price === null) return { kind: "missing_price", product: top.product };
  return { kind: "match", product: top.product };
}

function splitRecords(content: string) {
  const parts = content.split(/\n(?=Registro\s+\d+)/i).map((part) => part.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [content];
}

function parseFields(record: string) {
  return Object.fromEntries(record.split(/\r?\n/).flatMap((line) => {
    const separator = line.indexOf(":");
    if (separator < 1) return [];
    return [[line.slice(0, separator).trim().toLowerCase(), line.slice(separator + 1).trim()]];
  })) as Record<string, string>;
}

function parsePrice(value?: string) {
  if (!value?.trim()) return null;
  const compact = value.replace(/[^0-9,.-]/g, "");
  const normalized = compact.includes(",") && compact.includes(".")
    ? compact.lastIndexOf(",") > compact.lastIndexOf(".") ? compact.replace(/\./g, "").replace(",", ".") : compact.replace(/,/g, "")
    : compact.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function normalizeCurrency(value?: string) {
  if (!value) return null;
  const normalized = value.trim().toUpperCase();
  const aliases: Record<string, string> = { "$": "ARS", PESOS: "ARS", PESO: "ARS", DOLARES: "USD", DOLAR: "USD", "US$": "USD" };
  return /^[A-Z]{3}$/.test(normalized) ? normalized : aliases[normalized] ?? null;
}

function tokens(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 1);
}

function productRelevance(queryTokens: string[], product: CatalogProduct) {
  const haystack = new Set(tokens([product.name, product.sku, product.code, product.description].filter(Boolean).join(" ")));
  const matched = queryTokens.filter((token) => haystack.has(token)).length;
  return matched / queryTokens.length;
}

function exactIdentity(query: string, product: CatalogProduct) {
  const normalized = tokens(query).join(" ");
  return [product.name, product.sku, product.code].filter(Boolean).some((value) => tokens(value!).join(" ") === normalized);
}
