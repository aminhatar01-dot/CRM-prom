import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "../../..");
const migrationPath = resolve(
  root,
  "supabase/migrations/20260620163000_create_initial_organization_rpc.sql"
);

describe("initial organization onboarding contract", () => {
  it("creates organization and owner membership atomically", () => {
    const migration = readFileSync(migrationPath, "utf8");

    expect(migration).toContain("security definer");
    expect(migration).toContain("current_user_id uuid := auth.uid()");
    expect(migration).toContain("insert into public.organizations");
    expect(migration).toContain("insert into public.organization_members");
    expect(migration).toContain("'owner'");
    expect(migration).toContain("grant execute");
  });

  it("keeps the server action on the atomic RPC", () => {
    const action = readFileSync(
      resolve(root, "apps/web/src/app/onboarding/actions.ts"),
      "utf8"
    );

    expect(action).toContain('.rpc("create_initial_organization"');
    expect(action).not.toContain('.from("organizations").insert');
    expect(action).toContain('error.code === "23505"');
    expect(action).toContain("suggestOrganizationSlug");
  });
});
