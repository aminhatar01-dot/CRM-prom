import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const migration = readFileSync(
  resolve(root, "supabase/migrations/20260622190000_phase_18_real_automations.sql"),
  "utf8"
);
const correctiveMigration = readFileSync(
  resolve(root, "supabase/migrations/20260622200000_phase_18_specific_tenant_triggers.sql"),
  "utf8"
);
const webhook = readFileSync(
  resolve(root, "apps/web/src/app/api/webhooks/whatsapp/route.ts"),
  "utf8"
);
const engine = readFileSync(
  resolve(root, "apps/web/src/lib/automation/real-engine.ts"),
  "utf8"
);
const automationCore = readFileSync(
  resolve(root, "packages/automation/src/engine.ts"),
  "utf8"
);

describe("phase 18 real automation contracts", () => {
  it("stores tenant-scoped drafts, execution logs and idempotency keys", () => {
    expect(migration).toContain("create table public.automation_drafts");
    expect(migration).toContain("create table public.automation_execution_logs");
    expect(migration).toContain("automation_runs_org_idempotency_idx");
    expect(correctiveMigration).toContain("validate_phase18_automation_run_tenant");
    expect(correctiveMigration).toContain("validate_phase18_automation_draft_tenant");
    expect(correctiveMigration).toContain("validate_phase18_automation_log_tenant");
    expect(correctiveMigration).not.toContain("tg_table_name");
  });

  it("dispatches real inbound WhatsApp events", () => {
    expect(webhook).toContain('trigger: "message_received"');
    expect(webhook).toContain('trigger: "conversation_created"');
    expect(webhook).toContain("dispatchAutomationEvent");
  });

  it("keeps automatic sending opt-in and guarded", () => {
    expect(migration).toContain("auto_send boolean not null default false");
    expect(engine).toContain("isWithinWhatsAppWindow");
    expect(automationCore).toContain("organization_rate_limit");
    expect(engine).toContain("idempotencyKey");
    expect(engine).toContain('triggerMessage?.direction !== "inbound"');
    expect(engine).toContain('triggerMessage.sender_type === "assistant"');
    expect(engine).toContain('status: fallback.status');
    expect(automationCore).toContain('status: "pending" as const');
  });
});
