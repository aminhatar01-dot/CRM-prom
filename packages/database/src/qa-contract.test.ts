import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");

describe("FASE 12 QA contracts", () => {
  it("keeps QA scripts and documentation available", () => {
    const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["qa:smoke"]).toContain("playwright");
    expect(packageJson.scripts["qa:e2e"]).toContain("mvp-full-flow.test.ts");
    expect(existsSync(resolve(root, "docs/QA_E2E_PLAN.md"))).toBe(true);
    expect(existsSync(resolve(root, "docs/PHASE_12_VALIDATION.md"))).toBe(true);
  });

  it("keeps safe remote demo reference data", () => {
    const seed = readFileSync(resolve(root, "supabase/seed.sql"), "utf8");
    const requiredTables = [
      "contacts",
      "leads",
      "conversations",
      "messages",
      "ai_assistants",
      "tags",
      "variables",
      "automation_rules",
      "automation_actions",
      "webchat_widgets",
      "integrations",
      "integration_tools"
    ];

    for (const table of requiredTables) {
      expect(seed).toContain(`public.${table}`);
    }

    expect(seed).not.toContain("session_replication_role");
    expect(seed).not.toContain("disable trigger");
  });

  it("keeps RLS documented and covered by its migration contract", () => {
    const databaseDocs = readFileSync(resolve(root, "docs/DATABASE.md"), "utf8").toLowerCase();
    const rlsTest = readFileSync(
      resolve(root, "packages/database/src/rls/contract.test.ts"),
      "utf8"
    );

    expect(databaseDocs).toContain("rls");
    expect(rlsTest).toContain("enable row level security");
  });
});
