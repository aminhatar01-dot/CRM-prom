import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
// @ts-expect-error The deployment checker is executable ESM without a build step.
import {
  checkEnvironment,
  checkEnvLocalIgnored,
  checkPackageScripts,
  checkRequiredDocs,
  checkServiceRoleFrontend,
  parseEnv,
  requiredDocs
} from "../../../scripts/deploy-check.mjs";

const root = resolve(__dirname, "../../..");

describe("deploy assistant contracts", () => {
  it("parses and validates required environment variables", () => {
    const env = parseEnv(`
      NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY="anon-key"
      AI_DEMO_MODE=true
    `);

    expect(checkEnvironment(env, true).some((check: { status: string }) => check.status === "fail")).toBe(false);
    expect(checkEnvironment({}, true)[0]).toMatchObject({ status: "fail" });
  });

  it("keeps required deployment docs and npm scripts available", () => {
    expect(checkRequiredDocs(root, requiredDocs)[0]).toMatchObject({ status: "pass" });
    expect(checkPackageScripts(root)[0]).toMatchObject({ status: "pass" });
  });

  it("provides an interactive deployment checklist", () => {
    const checklist = readFileSync(resolve(root, "docs/DEPLOY_CHECKLIST.md"), "utf8");
    const sections = [
      "Antes del deploy",
      "Durante el deploy",
      "Despues del deploy",
      "Validacion funcional",
      "Validacion de seguridad",
      "Validacion de WhatsApp",
      "Validacion de WebChat",
      "Validacion de IA"
    ];

    expect(checklist.match(/- \[ \]/g)?.length).toBeGreaterThan(20);
    for (const section of sections) expect(checklist).toContain(section);
  });

  it("keeps local environment files ignored and untracked", () => {
    expect(checkEnvLocalIgnored(root)[0]).toMatchObject({ status: "pass" });
  });

  it("rejects service role references from client modules", () => {
    const fixture = mkdtempSync(join(tmpdir(), "crm-deploy-check-"));
    const clientFile = "apps/web/src/client.ts";
    mkdirSync(join(fixture, "apps/web/src"), { recursive: true });
    writeFileSync(
      join(fixture, clientFile),
      '"use client";\nconst key = process.env.SUPABASE_SERVICE_ROLE_KEY;\n'
    );

    expect(checkServiceRoleFrontend(fixture, [clientFile])[0]).toMatchObject({ status: "fail" });
    expect(checkServiceRoleFrontend(root)[0]).toMatchObject({ status: "pass" });
  });
});
