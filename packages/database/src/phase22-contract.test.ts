import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const migration = readFileSync(resolve(root, "supabase/migrations/20260627203000_phase_22_knowledge_import_routing.sql"), "utf8");
const routing = readFileSync(resolve(root, "apps/web/src/lib/ai/assistant-routing.ts"), "utf8");
const importAction = readFileSync(resolve(root, "apps/web/src/app/actions/knowledge.ts"), "utf8");
const importPage = readFileSync(resolve(root, "apps/web/src/app/(crm)/knowledge/import/page.tsx"), "utf8");

describe("phase 22 knowledge import and routing contracts", () => {
  it("protects imported sources and tenant relationships", () => {
    expect(migration).toContain("organization_id uuid not null");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("validate_knowledge_document_import_tenant");
    expect(migration).toContain("public.is_org_member(organization_id)");
    expect(migration).toContain("public.is_org_admin(organization_id)");
  });

  it("keeps originals private and embeddings out of the frontend", () => {
    expect(migration).toContain("'knowledge-imports'");
    expect(migration).toContain("false,");
    expect(migration).toContain("10485760");
    expect(importPage).not.toContain("embedding");
    expect(importAction).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("routes only assistants loaded for the active organization", () => {
    expect(routing).toContain('.eq("organization_id", organizationId)');
    expect(routing).toContain("agentConfigSchema.safeParse");
    expect(routing).toContain("relevantKnowledgeCategories");
  });
});
