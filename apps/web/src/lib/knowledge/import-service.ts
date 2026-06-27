import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { parse as parseCsv } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { load } from "cheerio";
import * as mammoth from "mammoth";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizeCatalogRows,
  type ColumnMapping
} from "@crm-pro-ai/ai/knowledge-import";
import { indexKnowledgeDocument } from "./service";
import { createAdminClient } from "../supabase/admin";

const maxFileBytes = 10 * 1024 * 1024;
const maxImportedCharacters = 500_000;

type ImportRow = {
  id: string;
  organization_id: string;
  source_type: "csv" | "xlsx" | "pdf" | "docx" | "txt" | "google_sheets" | "url";
  name: string;
  source_url: string | null;
  original_file_name: string | null;
  storage_path: string | null;
  column_mapping: ColumnMapping;
  metadata: { category?: string } & Record<string, unknown>;
  created_by: string | null;
  archived_at: string | null;
};

export const allowedKnowledgeFiles = {
  csv: ["text/csv", "application/csv", "text/plain"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  pdf: ["application/pdf"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  txt: ["text/plain"]
} as const;

export function validateKnowledgeFile(file: File, sourceType: string) {
  if (!(sourceType in allowedKnowledgeFiles)) throw new Error("Este tipo de fuente requiere una URL.");
  if (file.size <= 0 || file.size > maxFileBytes) throw new Error("El archivo debe pesar entre 1 byte y 10 MB.");
  const allowed = allowedKnowledgeFiles[sourceType as keyof typeof allowedKnowledgeFiles] as readonly string[];
  if (!allowed.includes(file.type)) throw new Error("El tipo MIME del archivo no esta permitido.");
  const expectedExtension = sourceType === "txt" ? ".txt" : `.${sourceType}`;
  if (!file.name.toLowerCase().endsWith(expectedExtension)) throw new Error("La extension no coincide con el tipo seleccionado.");
}

export async function processKnowledgeImport(importId: string, organizationId: string) {
  const admin = createAdminClient();
  const { data: source, error } = await admin.from("knowledge_imports")
    .select("id, organization_id, source_type, name, source_url, original_file_name, storage_path, column_mapping, metadata, created_by, archived_at")
    .eq("id", importId).eq("organization_id", organizationId).is("archived_at", null)
    .single<ImportRow>();
  if (error || !source) throw new Error("Fuente de conocimiento no encontrada.");

  await admin.from("knowledge_imports").update({ status: "processing", error_message: null })
    .eq("id", importId).eq("organization_id", organizationId);

  let createdIds: string[] = [];
  try {
    const extracted = await extractImport(source, admin);
    if (extracted.content.trim().length < 20) throw new Error("La fuente no contiene suficiente texto indexable.");
    const parts = splitContent(extracted.content);
    const { data: created, error: createError } = await admin.from("knowledge_documents").insert(
      parts.map((content, index) => ({
        organization_id: organizationId,
        import_id: importId,
        title: parts.length === 1 ? source.name : `${source.name} (${index + 1}/${parts.length})`,
        content,
        category: source.metadata.category ?? "general",
        active: true,
        source_type: source.source_type,
        source_file_name: source.original_file_name,
        storage_path: source.storage_path,
        source_url: source.source_url,
        source_metadata: extracted.metadata,
        created_by: source.created_by,
        indexing_status: "pending"
      })),
    ).select("id").returns<Array<{ id: string }>>();
    if (createError || !created?.length) throw createError ?? new Error("No se pudieron crear documentos.");
    createdIds = created.map((document) => document.id);

    let chunkCount = 0;
    for (const document of created) {
      const indexed = await indexKnowledgeDocument(document.id, organizationId);
      chunkCount += indexed.chunks;
    }

    const newIds = createdIds;
    await admin.from("knowledge_documents").update({ archived_at: new Date().toISOString(), active: false })
      .eq("organization_id", organizationId).eq("import_id", importId).not("id", "in", `(${newIds.join(",")})`)
      .is("archived_at", null);

    await admin.from("knowledge_imports").update({
      status: "indexed",
      error_message: null,
      document_count: created.length,
      chunk_count: chunkCount,
      column_mapping: "mapping" in extracted ? extracted.mapping : source.column_mapping,
      metadata: { ...source.metadata, ...extracted.metadata },
      last_imported_at: new Date().toISOString()
    }).eq("id", importId).eq("organization_id", organizationId);
    return { documents: created.length, chunks: chunkCount, metadata: extracted.metadata };
  } catch (caught) {
    const message = safeError(caught);
    if (createdIds.length) {
      await admin.from("knowledge_documents").update({ archived_at: new Date().toISOString(), active: false })
        .eq("organization_id", organizationId).in("id", createdIds);
    }
    await admin.from("knowledge_imports").update({ status: "error", error_message: message })
      .eq("id", importId).eq("organization_id", organizationId);
    throw new Error(message);
  }
}

async function extractImport(source: ImportRow, admin: SupabaseClient) {
  if (source.source_type === "url") {
    const html = await fetchPublicText(source.source_url ?? "");
    const extracted = extractHtml(html);
    return { content: extracted.content, metadata: { source_url: source.source_url, page_title: extracted.title } };
  }
  if (source.source_type === "google_sheets") {
    const csv = await fetchPublicText(toGoogleSheetsCsvUrl(source.source_url ?? ""));
    return extractCsv(csv, source.column_mapping, { source_url: source.source_url });
  }

  if (!source.storage_path) throw new Error("La fuente no tiene archivo original almacenado.");
  const { data, error } = await admin.storage.from("knowledge-imports").download(source.storage_path);
  if (error || !data) throw new Error("No se pudo leer el archivo original.");
  const buffer = Buffer.from(await data.arrayBuffer());

  return extractKnowledgeBuffer(source.source_type, buffer, source.column_mapping, source.original_file_name);
}

export async function extractKnowledgeBuffer(
  sourceType: "csv" | "xlsx" | "pdf" | "docx" | "txt",
  buffer: Buffer,
  mapping: ColumnMapping = {},
  fileName: string | null = null,
) {
  if (sourceType === "csv") return extractCsv(buffer.toString("utf8"), mapping, { file_name: fileName });
  if (sourceType === "xlsx") return extractXlsx(buffer, mapping, fileName);
  if (sourceType === "txt") return { content: cleanText(buffer.toString("utf8")), metadata: { file_name: fileName } };
  if (sourceType === "docx") {
    const result = await mammoth.extractRawText({ buffer });
    return { content: cleanText(result.value), metadata: { file_name: fileName, warnings: result.messages.length } };
  }
  if (sourceType === "pdf") {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const text = await page.getTextContent();
      pages.push(text.items.map((item) => "str" in item ? item.str : "").join(" "));
    }
    return { content: cleanText(pages.join("\n\n")), metadata: { file_name: fileName, pages: pdf.numPages } };
  }
  throw new Error("Tipo de fuente no soportado.");
}

export function extractCsv(csv: string, mapping: ColumnMapping, metadata: Record<string, unknown> = {}) {
  const rows = parseCsv(csv, { columns: true, skip_empty_lines: true, trim: true, bom: true, relax_column_count: true }) as Array<Record<string, unknown>>;
  const normalized = normalizeCatalogRows(rows.slice(0, 5000), mapping);
  return { content: normalized.content, mapping: normalized.mapping, metadata: { ...metadata, rows: normalized.rowCount, headers: normalized.headers } };
}

export async function extractXlsx(buffer: Buffer, mapping: ColumnMapping = {}, fileName: string | null = null) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("El Excel no contiene hojas.");
  const headers = (worksheet.getRow(1).values as unknown[]).slice(1).map(cellText);
  const rows: Array<Record<string, unknown>> = [];
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || rows.length >= 5000) return;
    const record: Record<string, unknown> = {};
    headers.forEach((header, index) => { if (header) record[header] = cellText(row.getCell(index + 1).value); });
    rows.push(record);
  });
  const normalized = normalizeCatalogRows(rows, mapping);
  return { content: normalized.content, mapping: normalized.mapping, metadata: { file_name: fileName, sheet: worksheet.name, rows: normalized.rowCount, headers } };
}

function cellText(value: unknown) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const record = value as { text?: string; result?: unknown; richText?: Array<{ text: string }> };
    if (record.text) return record.text;
    if (record.result !== undefined) return String(record.result);
    if (record.richText) return record.richText.map((item) => item.text).join("");
  }
  return String(value);
}

function cleanText(value: string) {
  return value.replace(/\0/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, maxImportedCharacters);
}

export function extractHtml(html: string) {
  const $ = load(html);
  $("script, style, noscript, nav, footer, svg").remove();
  const content = $("main, article").first().text() || $("body").text();
  return { content: cleanText(content), title: $("title").text().trim() };
}

function splitContent(content: string) {
  const result: string[] = [];
  let remaining = cleanText(content);
  while (remaining.length > 95_000) {
    let boundary = remaining.lastIndexOf("\n\n", 95_000);
    if (boundary < 50_000) boundary = 95_000;
    result.push(remaining.slice(0, boundary).trim());
    remaining = remaining.slice(boundary).trim();
  }
  if (remaining) result.push(remaining);
  return result;
}

function toGoogleSheetsCsvUrl(value: string) {
  const url = new URL(value);
  if (!/^(docs|drive)\.google\.com$/i.test(url.hostname)) throw new Error("Debe ser un enlace publico de Google Sheets.");
  const match = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/);
  if (!match?.[1]) throw new Error("No se pudo identificar la hoja de Google Sheets.");
  const gid = url.searchParams.get("gid") ?? "0";
  return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv&gid=${gid}`;
}

export async function fetchPublicText(
  value: string,
  redirects = 0,
  dependencies: {
    fetcher?: typeof fetch;
    resolver?: typeof lookup;
  } = {},
): Promise<string> {
  const url = await assertPublicUrl(value, dependencies.resolver ?? lookup);
  const response = await (dependencies.fetcher ?? fetch)(url, { redirect: "manual", signal: AbortSignal.timeout(12_000), headers: { "User-Agent": "CRM-PRO-AI-KnowledgeImporter/1.0" } });
  if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
    if (redirects >= 3) throw new Error("La URL tiene demasiadas redirecciones.");
    return fetchPublicText(new URL(response.headers.get("location")!, url).toString(), redirects + 1, dependencies);
  }
  if (!response.ok) throw new Error(`La fuente publica respondio HTTP ${response.status}.`);
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > maxFileBytes) throw new Error("La fuente publica supera 10 MB.");
  return (await response.text()).slice(0, maxImportedCharacters * 2);
}

async function assertPublicUrl(value: string, resolver: typeof lookup) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Solo se permiten URLs HTTP o HTTPS.");
  if (url.username || url.password) throw new Error("No se permiten credenciales dentro de la URL.");
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await resolver(url.hostname, { all: true });
  if (addresses.some(({ address }) => isPrivateAddress(address))) throw new Error("La URL apunta a una red privada o local.");
  return url;
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase();
  return normalized === "::1" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")
    || /^127\./.test(normalized) || /^10\./.test(normalized) || /^192\.168\./.test(normalized)
    || /^169\.254\./.test(normalized) || /^172\.(1[6-9]|2\d|3[01])\./.test(normalized) || normalized === "0.0.0.0";
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : "Fallo de importacion.")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 500);
}
