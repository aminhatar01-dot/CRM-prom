import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const migration = readFileSync(resolve(root, "supabase/migrations/20260627183000_phase_21_agent_configuration.sql"), "utf8");
const action = readFileSync(resolve(root, "apps/web/src/app/actions/ai.ts"), "utf8");
const form = readFileSync(resolve(root, "apps/web/src/app/(crm)/assistants/_components/assistant-form.tsx"), "utf8");

describe("phase 21 agent configuration contracts", () => {
  it("keeps configuration on the existing tenant-protected assistant", () => {
    expect(migration).toContain("alter table public.ai_assistants");
    expect(migration).toContain("agent_config jsonb");
    expect(migration).toContain("playbooks jsonb");
    expect(migration).not.toContain("disable row level security");
  });

  it("builds runtime fields server-side and does not expose a prompt editor", () => {
    expect(action).toContain("buildAgentRuntime");
    expect(action).toContain("agent_config");
    expect(form).not.toContain('name="prompt"');
    expect(form).not.toContain('name="rules"');
  });

  it("does not activate automations from playbook configuration", () => {
    expect(action).not.toContain('.from("automation_rules")');
    expect(action).not.toContain("dispatchAutomationEvent");
  });
});
