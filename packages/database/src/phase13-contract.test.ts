import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../../..");
const migration = fs.readFileSync(
  path.join(root, "supabase/migrations/20260620213000_phase_13_integrity_and_archiving.sql"),
  "utf8",
);
const sqlTest = fs.readFileSync(
  path.join(root, "supabase/tests/phase_13_integrity_crud.sql"),
  "utf8",
);
const crmActions = fs.readFileSync(path.join(root, "apps/web/src/app/actions/crm.ts"), "utf8");

describe("Phase 13 critical database contracts", () => {
  it("removes polymorphic trigger functions that accessed missing NEW fields", () => {
    for (const functionName of [
      "enforce_crm_tenant_integrity",
      "enforce_smart_tag_tenant_integrity",
      "enforce_variable_tenant_integrity",
      "enforce_automation_tenant_integrity",
      "enforce_webchat_tenant_integrity",
      "enforce_integration_tenant_integrity"
    ]) {
      expect(migration).toContain(`drop function if exists public.${functionName}()`);
    }
  });

  it("uses table-specific validators and non-destructive archive columns", () => {
    for (const validator of [
      "validate_lead_tenant",
      "validate_contact_tenant",
      "validate_conversation_tenant",
      "validate_message_tenant",
      "validate_webchat_widget_tenant",
      "validate_automation_action_tenant"
    ]) {
      expect(migration).toContain(`function public.${validator}()`);
    }

    for (const table of [
      "leads",
      "contacts",
      "conversations",
      "messages",
      "ai_assistants",
      "tags",
      "variables"
    ]) {
      expect(migration).toContain(`alter table public.${table} add column if not exists archived_at`);
    }
  });

  it("ships PostgreSQL CRUD and RLS smoke coverage", () => {
    expect(sqlTest).toContain("lead insert no longer reads conversation_id");
    expect(sqlTest).toContain("automation action insert no longer reads user_id");
    expect(sqlTest).toContain("RLS exposes only the current organization leads");
    expect(sqlTest).toContain("conversation rejects a cross-tenant contact");
  });

  it("adds archive actions for the CRM core", () => {
    expect(crmActions).toContain("export async function archiveLead");
    expect(crmActions).toContain("export async function archiveContact");
    expect(crmActions).toContain("export async function archiveConversation");
    expect(crmActions).toContain("export async function archiveMessage");
  });
});
