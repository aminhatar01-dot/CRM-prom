import { describe, expect, it } from "vitest";
import {
  chunkKnowledgeContent,
  cosineSimilarity,
  knowledgeDocumentSchema
} from "./knowledge";

describe("knowledge base utilities", () => {
  it("chunks long content with stable indexes and overlap", () => {
    const content = Array.from(
      { length: 20 },
      (_, index) => `Seccion ${index + 1}. Esta es informacion comercial verificable para clientes.`,
    ).join("\n");
    const chunks = chunkKnowledgeContent(content, {
      maxCharacters: 320,
      overlapCharacters: 40
    });

    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.map((chunk) => chunk.index)).toEqual(chunks.map((_, index) => index));
    expect(chunks.every((chunk) => chunk.content.length <= 320)).toBe(true);
    expect(chunks.every((chunk) => chunk.tokenEstimate > 0)).toBe(true);
  });

  it("validates manual knowledge documents", () => {
    const parsed = knowledgeDocumentSchema.parse({
      title: "Politica comercial",
      content: "Los presupuestos tienen una validez de treinta dias corridos.",
      category: "ventas",
      active: true
    });

    expect(parsed.category).toBe("ventas");
    expect(() => knowledgeDocumentSchema.parse({ title: "", content: "corto" })).toThrow();
  });

  it("ranks semantically closer vectors above unrelated vectors", () => {
    const query = [1, 0, 0];
    expect(cosineSimilarity(query, [0.9, 0.1, 0])).toBeGreaterThan(
      cosineSimilarity(query, [0, 1, 0]),
    );
  });
});

