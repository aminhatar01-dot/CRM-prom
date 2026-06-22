import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260622213000_phase_19_knowledge_base_rag.sql"),
  "utf8",
);

describe("knowledge base tenant and embedding contracts", () => {
  it("stores organization_id on documents and chunks with RLS enabled", () => {
    expect(migration).toMatch(/create table public\.knowledge_documents[\s\S]*organization_id uuid not null/);
    expect(migration).toMatch(/create table public\.knowledge_chunks[\s\S]*organization_id uuid not null/);
    expect(migration).toContain("alter table public.knowledge_documents enable row level security");
    expect(migration).toContain("alter table public.knowledge_chunks enable row level security");
    expect(migration).toContain("document_id must belong to the same organization");
  });

  it("keeps embeddings server-only and scopes semantic search by tenant", () => {
    expect(migration).toContain("revoke all on table public.knowledge_chunks from anon, authenticated");
    expect(migration).toContain("grant execute on function public.match_knowledge_chunks");
    expect(migration).toMatch(/where chunk\.organization_id = p_organization_id/);
    expect(migration).toContain("auth.role() <> 'service_role'");
  });
});

