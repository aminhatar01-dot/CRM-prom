import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnv(content) {
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^["']|["']$/g, "")];
      }),
  );
}

const root = resolve(import.meta.dirname, "..");
const envFile = resolve(root, "apps/web/.env.local");
const localEnv = existsSync(envFile) ? parseEnv(readFileSync(envFile, "utf8")) : {};
const env = { ...localEnv, ...process.env };
const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "invalid-anon-key";

if (!baseUrl || !serviceRole) {
  throw new Error("Phase 19 remote smoke requires Supabase URL and service role locally.");
}

const serviceHeaders = {
  apikey: serviceRole,
  Authorization: `Bearer ${serviceRole}`,
  "Content-Type": "application/json"
};
let documentId;

try {
  const organizations = await request("/rest/v1/organizations?select=id&limit=1", {
    headers: serviceHeaders
  });
  const organizationId = organizations[0]?.id;
  if (!organizationId) throw new Error("No organization is available for the smoke test.");

  documentId = randomUUID();
  const chunkId = randomUUID();
  const embeddingResult = await createEmbedding(
    "Contenido temporal para validar recuperacion semantica aislada por organizacion.",
  );
  const embedding = embeddingResult.embedding;
  await request("/rest/v1/knowledge_documents", {
    method: "POST",
    headers: serviceHeaders,
    body: JSON.stringify({
      id: documentId,
      organization_id: organizationId,
      title: "Phase 19 smoke document",
      content: "Contenido temporal para validar recuperacion semantica aislada por organizacion.",
      category: "qa",
      indexing_status: "indexed",
      chunk_count: 1,
      embedding_model: embeddingResult.model,
      indexed_at: new Date().toISOString()
    })
  });
  await request("/rest/v1/knowledge_chunks", {
    method: "POST",
    headers: serviceHeaders,
    body: JSON.stringify({
      id: chunkId,
      organization_id: organizationId,
      document_id: documentId,
      chunk_index: 0,
      content: "Contenido temporal para validar recuperacion semantica aislada.",
      token_estimate: 10,
      embedding
    })
  });

  const matches = await request("/rest/v1/rpc/match_knowledge_chunks", {
    method: "POST",
    headers: serviceHeaders,
    body: JSON.stringify({
      p_organization_id: organizationId,
      p_query_embedding: embedding,
      p_match_count: 3,
      p_min_similarity: 0.9
    })
  });
  if (matches.length !== 1 || matches[0]?.document_id !== documentId) {
    throw new Error("Semantic search did not return the tenant-scoped smoke document.");
  }

  const denied = await fetch(`${baseUrl}/rest/v1/knowledge_chunks?select=id&limit=1`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
  });
  if (denied.ok) throw new Error("Anonymous clients can unexpectedly read knowledge chunks.");

  console.log("Phase 19 remote smoke: PASS");
  console.log(`Embedding mode: ${embeddingResult.mode}`);
  console.log("Tenant semantic match: 1");
  console.log("Anonymous chunk access: BLOCKED");
} finally {
  if (documentId) {
    await fetch(`${baseUrl}/rest/v1/knowledge_documents?id=eq.${documentId}`, {
      method: "DELETE",
      headers: serviceHeaders
    });
  }
}

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Supabase smoke request failed with HTTP ${response.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : [];
}

async function createEmbedding(input) {
  if (!env.OPENAI_API_KEY || env.AI_DEMO_MODE === "true") {
    return {
      embedding: Array.from({ length: 1536 }, (_, index) => (index === 0 ? 1 : 0)),
      model: "smoke-vector",
      mode: "demo"
    };
  }
  const model = env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ model, input, encoding_format: "float", dimensions: 1536 })
  });
  const payload = await response.json();
  const embedding = payload.data?.[0]?.embedding;
  if (!response.ok || !Array.isArray(embedding) || embedding.length !== 1536) {
    throw new Error(`OpenAI embedding smoke failed with HTTP ${response.status}.`);
  }
  return { embedding, model: payload.model || model, mode: "openai" };
}
