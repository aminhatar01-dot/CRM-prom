import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const migration = readFileSync(resolve(root, "supabase/migrations/20260627223000_phase_23_quotes_and_estimates.sql"), "utf8");
const actions = readFileSync(resolve(root, "apps/web/src/app/actions/quotes.ts"), "utf8");
const publicPage = readFileSync(resolve(root, "apps/web/src/app/q/[token]/page.tsx"), "utf8");
const automation = readFileSync(resolve(root, "apps/web/src/lib/automation/real-engine.ts"), "utf8");

describe("phase 23 database and integration contracts", () => {
  it("enforces tenant RLS and table-specific integrity", () => {
    expect(migration).toContain("alter table public.quotes enable row level security");
    expect(migration).toContain("public.is_org_member(organization_id)");
    expect(migration).toContain("validate_quote_item_tenant");
    expect(migration).not.toContain("NEW.user_id");
  });

  it("keeps public access server-side and token scoped", () => {
    expect(migration).toContain("gen_random_bytes(32)");
    expect(migration).not.toMatch(/policy .*anon/i);
    expect(publicPage).toContain("createAdminClient");
    expect(publicPage).toContain('.eq("public_token", token)');
  });

  it("sends approved quotes as outbound WhatsApp messages", () => {
    expect(actions).toContain("WhatsAppCloudService");
    expect(actions).toContain('direction: "outbound"');
    expect(actions).toContain('event_type: "quote"');
  });

  it("supports quote automation while keeping drafts manual", () => {
    expect(automation).toContain('action.action_type === "create_quote"');
    expect(automation).toContain('action.action_type === "send_quote_draft"');
    expect(automation).toContain("auto_send_requested: false");
  });
});
