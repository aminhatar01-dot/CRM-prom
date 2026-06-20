import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");
const seed = readFileSync(resolve(root, "supabase/seed.sql"), "utf8").toLowerCase();

describe("remote seed contract", () => {
  it("avoids auth, secrets and trigger bypasses", () => {
    expect(seed).not.toContain("insert into auth.");
    expect(seed).not.toContain("organization_members");
    expect(seed).not.toContain("integration_secrets");
    expect(seed).not.toContain("session_replication_role");
    expect(seed).not.toContain("disable trigger");
  });

  it("avoids tables affected by incompatible generic triggers", () => {
    expect(seed).not.toMatch(/insert\s+into\s+public\.leads\b/);
    expect(seed).not.toMatch(/insert\s+into\s+public\.conversations\b/);
    expect(seed).not.toMatch(/insert\s+into\s+public\.messages\b/);
    expect(seed).not.toMatch(/insert\s+into\s+public\.lead_tags\b/);
    expect(seed).not.toMatch(/insert\s+into\s+public\.automation_actions\b/);
    expect(seed).not.toMatch(/insert\s+into\s+public\.webchat_widgets\b/);
  });

  it("seeds the minimum CRM demo surface idempotently", () => {
    const requiredTables = [
      "organizations",
      "pipelines",
      "pipeline_stages",
      "tags",
      "contacts",
      "ai_assistants",
      "automation_rules",
      "variables",
      "integrations",
      "integration_tools"
    ];

    for (const table of requiredTables) {
      expect(seed).toContain(`insert into public.${table}`);
    }

    expect(seed.match(/on conflict \(id\) do update/g)?.length).toBe(requiredTables.length + 1);
  });

  it("keeps external and automatic behavior disabled or mocked", () => {
    expect(seed).toContain("'mock://success'");
    expect(seed).toContain("auto_reply_enabled = false");
    expect(seed).toContain("status = 'draft'");
    expect(seed).toContain("enabled = false");
  });
});
