import { createHash } from "node:crypto";
import { OpenAIEmbeddingClient } from "@crm-pro-ai/ai/embedding-client";
import {
  chunkKnowledgeContent,
  type KnowledgeSource
} from "@crm-pro-ai/ai/knowledge";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

type KnowledgeDocumentRow = {
  id: string;
  organization_id: string;
  title: string;
  content: string;
  category: string;
  active: boolean;
  archived_at: string | null;
};

type MatchRow = {
  chunk_id: string;
  document_id: string;
  title: string;
  category: string;
  content: string;
  similarity: number;
};

export async function indexKnowledgeDocument(documentId: string, organizationId: string) {
  const admin = createAdminClient();
  const { data: document, error: documentError } = await admin
    .from("knowledge_documents")
    .select("id, organization_id, title, content, category, active, archived_at")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .single<KnowledgeDocumentRow>();

  if (documentError || !document) throw new Error("Documento de conocimiento no encontrado.");
  await admin
    .from("knowledge_documents")
    .update({ indexing_status: "indexing", indexing_error: null })
    .eq("id", documentId)
    .eq("organization_id", organizationId);

  try {
    const chunks = chunkKnowledgeContent(document.content);
    if (chunks.length === 0) throw new Error("El documento no contiene texto indexable.");

    const env = getServerEnv();
    const embeddingClient = new OpenAIEmbeddingClient({
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_EMBEDDING_MODEL,
      demoMode: env.AI_DEMO_MODE
    });
    const embedded = await embeddingClient.embed(chunks.map((chunk) => chunk.content));

    const { error: deleteError } = await admin
      .from("knowledge_chunks")
      .delete()
      .eq("document_id", documentId)
      .eq("organization_id", organizationId);
    if (deleteError) throw deleteError;

    const { error: insertError } = await admin.from("knowledge_chunks").insert(
      chunks.map((chunk, index) => ({
        organization_id: organizationId,
        document_id: documentId,
        chunk_index: chunk.index,
        content: chunk.content,
        token_estimate: chunk.tokenEstimate,
        metadata: {
          title: document.title,
          category: document.category,
          source_type: "manual"
        },
        embedding: vectorLiteral(embedded.embeddings[index])
      })),
    );
    if (insertError) throw insertError;

    const { error: updateError } = await admin
      .from("knowledge_documents")
      .update({
        indexing_status: "indexed",
        indexing_error: null,
        content_hash: createHash("sha256").update(document.content).digest("hex"),
        chunk_count: chunks.length,
        embedding_model: embedded.model,
        indexed_at: new Date().toISOString()
      })
      .eq("id", documentId)
      .eq("organization_id", organizationId);
    if (updateError) throw updateError;

    return {
      chunks: chunks.length,
      mode: embedded.mode,
      model: embedded.model,
      usage: embedded.usage
    };
  } catch (error) {
    await admin
      .from("knowledge_documents")
      .update({
        indexing_status: "failed",
        indexing_error: safeIndexingError(error),
        chunk_count: 0
      })
      .eq("id", documentId)
      .eq("organization_id", organizationId);
    throw error;
  }
}

export async function searchKnowledge({
  organizationId,
  query,
  limit = 5,
  minSimilarity = 0.35
}: {
  organizationId: string;
  query: string;
  limit?: number;
  minSimilarity?: number;
}): Promise<KnowledgeSource[]> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) return [];

  const env = getServerEnv();
  const embeddingClient = new OpenAIEmbeddingClient({
    apiKey: env.OPENAI_API_KEY,
    model: env.OPENAI_EMBEDDING_MODEL,
    demoMode: env.AI_DEMO_MODE
  });
  const embedded = await embeddingClient.embed([normalizedQuery]);
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("match_knowledge_chunks", {
    p_organization_id: organizationId,
    p_query_embedding: vectorLiteral(embedded.embeddings[0]),
    p_match_count: Math.max(1, Math.min(limit, 10)),
    p_min_similarity: minSimilarity
  });
  if (error) throw new Error(`No pudimos buscar la base de conocimiento: ${error.message}`);

  return ((data ?? []) as MatchRow[]).map((row) => ({
    documentId: row.document_id,
    title: row.title,
    category: row.category,
    content: row.content,
    score: Number(row.similarity)
  }));
}

export function buildKnowledgeQuery({
  userInput,
  messages,
  person
}: {
  userInput?: string;
  messages: Array<{ direction: string; body: string }>;
  person?: { name?: string; company?: string | null; notes?: string | null };
}) {
  const inbound = [...messages]
    .reverse()
    .filter((message) => message.direction === "inbound")
    .slice(0, 3)
    .map((message) => message.body);
  return [
    userInput,
    ...inbound,
    person?.company ? `Empresa del contacto: ${person.company}` : "",
    person?.notes ? `Notas: ${person.notes}` : ""
  ]
    .filter(Boolean)
    .join("\n")
    .slice(0, 4_000);
}

function vectorLiteral(vector: number[]) {
  return `[${vector.join(",")}]`;
}

function safeIndexingError(error: unknown) {
  const message = error instanceof Error ? error.message : "Fallo de indexacion.";
  return message.replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]").slice(0, 500);
}

