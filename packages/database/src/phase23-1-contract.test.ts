import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const migration = readFileSync(
  resolve(
    root,
    "supabase/migrations/20260628123000_phase_23_1_assistant_capabilities.sql",
  ),
  "utf8",
);
const engine = readFileSync(
  resolve(root, "apps/web/src/lib/automation/real-engine.ts"),
  "utf8",
);
const inbox = readFileSync(
  resolve(root, "apps/web/src/app/(crm)/inbox/page.tsx"),
  "utf8",
);

describe("phase 23.1 assistant capability contracts", () => {
  it("persists tenant-safe automatic or manual routing", () => {
    expect(migration).toContain("assistant_routing_mode");
    expect(migration).toContain("validate_conversation_assistant_tenant");
    expect(migration).toContain("organization_id = new.organization_id");
  });
  it("routes by default even when a legacy action has assistant_id", () => {
    expect(engine).toContain("config.auto_route !== false");
    expect(engine).toContain("resolveSimplePriceFromConversation");
    expect(engine).toContain("quote_human_approval_required");
  });
  it("exposes manual override and return to automatic routing", () => {
    expect(inbox).toContain("Forzar asistente");
    expect(inbox).toContain("Volver al router automatico");
  });
});
