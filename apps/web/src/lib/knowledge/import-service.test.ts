import { beforeEach, describe, expect, it, vi } from "vitest";
import ExcelJS from "exceljs";

vi.mock("mammoth", () => ({
  extractRawText: vi.fn(async () => ({ value: "Documento Word con productos, servicios y condiciones comerciales.", messages: [] }))
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: async () => ({ getTextContent: async () => ({ items: [{ str: "Catalogo PDF con precios confirmados." }] }) })
    })
  })
}));

vi.mock("./service", () => ({ indexKnowledgeDocument: vi.fn() }));
vi.mock("../supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { extractHtml, extractKnowledgeBuffer, extractXlsx, fetchPublicText } from "./import-service";

describe("knowledge import extractors", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("imports CSV and Excel product catalogs", async () => {
    const csv = await extractKnowledgeBuffer("csv", Buffer.from("Producto,Precio,Stock\nTaladro,120000,4"));
    expect(csv.content).toContain("product: Taladro");

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Catalogo");
    sheet.addRow(["Producto", "Precio", "Stock"]);
    sheet.addRow(["Martillo", 15000, 12]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const excel = await extractXlsx(buffer);
    expect(excel.content).toContain("product: Martillo");
    expect(excel.metadata).toMatchObject({ sheet: "Catalogo", rows: 1 });
  });

  it("extracts TXT, Word and PDF without exposing binary content", async () => {
    const txt = await extractKnowledgeBuffer("txt", Buffer.from("Texto plano con informacion de productos y servicios."));
    const docx = await extractKnowledgeBuffer("docx", Buffer.from("mock-docx"));
    const pdf = await extractKnowledgeBuffer("pdf", Buffer.from("mock-pdf"));
    expect(txt.content).toContain("Texto plano");
    expect(docx.content).toContain("Documento Word");
    expect(pdf.content).toContain("precios confirmados");
  });

  it("cleans public URL content and blocks private network targets", async () => {
    const html = "<html><head><title>Catalogo</title><script>secret()</script></head><body><nav>Menu</nav><main>Taladro profesional disponible.</main></body></html>";
    expect(extractHtml(html)).toEqual({ title: "Catalogo", content: "Taladro profesional disponible." });

    const fetched = await fetchPublicText("https://catalog.example/products", 0, {
      resolver: vi.fn(async () => [{ address: "93.184.216.34", family: 4 }]) as never,
      fetcher: vi.fn(async () => new Response(html, { status: 200 })) as never
    });
    expect(fetched).toContain("Taladro profesional");
    await expect(fetchPublicText("http://127.0.0.1/private", 0, { fetcher: vi.fn() as never })).rejects.toThrow("red privada");
  });
});
