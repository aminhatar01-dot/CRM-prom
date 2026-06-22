import { z } from "zod";
import { sanitizeAIText } from "./openai-client";

export const knowledgeDocumentSchema = z.object({
  title: z.string().trim().min(2).max(160),
  content: z.string().trim().min(20).max(100_000),
  category: z.string().trim().min(2).max(80).default("general"),
  active: z.boolean().default(true)
});

export const knowledgeDocumentUpdateSchema = knowledgeDocumentSchema.extend({
  id: z.string().uuid()
});

export const knowledgeDocumentIdSchema = z.object({
  id: z.string().uuid()
});

export type KnowledgeChunk = {
  index: number;
  content: string;
  tokenEstimate: number;
};

export type KnowledgeSource = {
  documentId: string;
  title: string;
  category: string;
  content: string;
  score: number;
};

export function chunkKnowledgeContent(
  content: string,
  options: { maxCharacters?: number; overlapCharacters?: number } = {},
): KnowledgeChunk[] {
  const maxCharacters = options.maxCharacters ?? 1_200;
  const overlapCharacters = options.overlapCharacters ?? 180;
  if (maxCharacters < 200 || overlapCharacters < 0 || overlapCharacters >= maxCharacters) {
    throw new Error("Invalid knowledge chunking configuration.");
  }

  const normalized = sanitizeAIText(content, 100_000);
  if (!normalized) return [];

  const chunks: KnowledgeChunk[] = [];
  let start = 0;
  while (start < normalized.length) {
    let end = Math.min(start + maxCharacters, normalized.length);
    if (end < normalized.length) {
      const boundary = Math.max(
        normalized.lastIndexOf("\n", end),
        normalized.lastIndexOf(". ", end),
        normalized.lastIndexOf(" ", end),
      );
      if (boundary > start + Math.floor(maxCharacters * 0.55)) end = boundary + 1;
    }

    const chunk = normalized.slice(start, end).trim();
    if (chunk) {
      chunks.push({
        index: chunks.length,
        content: chunk,
        tokenEstimate: Math.ceil(chunk.length / 4)
      });
    }
    if (end >= normalized.length) break;
    start = Math.max(end - overlapCharacters, start + 1);
  }

  return chunks;
}

export function cosineSimilarity(left: number[], right: number[]) {
  if (left.length === 0 || left.length !== right.length) return 0;
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  if (leftNorm === 0 || rightNorm === 0) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

