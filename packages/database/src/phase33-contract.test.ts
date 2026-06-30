import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../../../");

function readSrc(rel: string) {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("FASE 33 — Security Hardening contracts", () => {
  // ─── SSRF Guard ───────────────────────────────────────────────────────────

  describe("ssrf-guard.ts", () => {
    const src = readSrc("packages/integrations/src/ssrf-guard.ts");

    it("exports assertSafeUrl", () => {
      expect(src).toContain("export async function assertSafeUrl");
    });

    it("exports isPrivateIp", () => {
      expect(src).toContain("export { isPrivateIp }");
    });

    it("blocks file: protocol", () => {
      expect(src.toLowerCase()).toContain("file:");
    });

    it("blocks ftp: protocol", () => {
      expect(src.toLowerCase()).toContain("ftp:");
    });

    it("blocks cloud metadata 169.254.169.254", () => {
      expect(src).toContain("169.254.169.254");
    });

    it("blocks CGNAT range 100.64.x.x", () => {
      expect(src).toContain("100.");
      expect(src).toContain("CGNAT");
    });

    it("blocks IPv4-mapped IPv6", () => {
      expect(src).toContain("::ffff:");
    });

    it("resolves DNS before allowing URL", () => {
      expect(src).toContain("lookup");
    });
  });

  // ─── Custom Connect Executor ──────────────────────────────────────────────

  describe("custom-connect-executor.ts", () => {
    const src = readSrc("packages/integrations/src/custom-connect-executor.ts");

    it("imports assertSafeUrl from ssrf-guard", () => {
      expect(src).toContain("assertSafeUrl");
      expect(src).toContain("./ssrf-guard");
    });

    it("calls assertSafeUrl before fetch", () => {
      const ssrfIdx = src.indexOf("assertSafeUrl");
      const fetchIdx = src.indexOf("this.fetcher(tool.url");
      expect(ssrfIdx).toBeGreaterThan(0);
      expect(fetchIdx).toBeGreaterThan(ssrfIdx);
    });

    it("uses redirect: manual to prevent redirect following", () => {
      expect(src).toContain('redirect: "manual"');
    });

    it("validates redirect location before following", () => {
      expect(src).toContain("assertSafeUrl(location)");
    });

    it("limits response size via MAX_SSRF_RESPONSE_BYTES", () => {
      expect(src).toContain("MAX_SSRF_RESPONSE_BYTES");
    });
  });

  // ─── Knowledge import SSRF ────────────────────────────────────────────────

  describe("import-service.ts SSRF", () => {
    const src = readSrc("apps/web/src/lib/knowledge/import-service.ts");

    it("calls assertPublicUrl before fetch", () => {
      expect(src).toContain("assertPublicUrl");
    });

    it("blocks 169.254.169.254 (cloud metadata)", () => {
      expect(src).toContain("169.254.169.254");
    });

    it("blocks CGNAT range", () => {
      expect(src).toContain("CGNAT");
    });

    it("blocks IPv4-mapped IPv6", () => {
      expect(src).toContain("::ffff:");
    });

    it("blocks null bytes in filename", () => {
      expect(src).toContain("[\\0/\\\\]");
    });

    it("exports sanitizeFileName", () => {
      expect(src).toContain("export function sanitizeFileName");
    });
  });

  // ─── Mercado Pago signature fix ───────────────────────────────────────────

  describe("billing/providers.ts — MP signature", () => {
    const src = readSrc("apps/web/src/lib/billing/providers.ts");

    it("parses ts from x-signature header instead of using Date.now()", () => {
      expect(src).not.toContain("Date.now()");
    });

    it("parses v1 from x-signature header", () => {
      expect(src).toContain('parts["v1"]');
    });

    it("uses ts from header in manifest", () => {
      expect(src).toContain("ts:${ts}");
    });

    it("parses dataId from request body", () => {
      expect(src).toContain("dataId");
    });

    it("compares computed hex exactly to v1 (not substring)", () => {
      expect(src).toContain("expectedHex === v1");
    });
  });

  // ─── Security Headers ─────────────────────────────────────────────────────

  describe("next.config.ts — security headers", () => {
    const src = readSrc("apps/web/next.config.ts");

    it("sets X-Content-Type-Options: nosniff", () => {
      expect(src).toContain("X-Content-Type-Options");
      expect(src).toContain("nosniff");
    });

    it("sets Referrer-Policy", () => {
      expect(src).toContain("Referrer-Policy");
    });

    it("sets Permissions-Policy", () => {
      expect(src).toContain("Permissions-Policy");
    });

    it("sets Strict-Transport-Security", () => {
      expect(src).toContain("Strict-Transport-Security");
    });

    it("sets Content-Security-Policy", () => {
      expect(src).toContain("Content-Security-Policy");
    });

    it("sets X-Frame-Options: SAMEORIGIN", () => {
      expect(src).toContain("SAMEORIGIN");
    });

    it("exports async headers() function", () => {
      expect(src).toContain("async headers()");
    });
  });

  // ─── Upload guard ─────────────────────────────────────────────────────────

  describe("upload-guard.ts", () => {
    const src = readSrc("apps/web/src/lib/security/upload-guard.ts");

    it("exports validateUpload", () => {
      expect(src).toContain("export function validateUpload");
    });

    it("exports sanitizeFileName", () => {
      expect(src).toContain("export function sanitizeFileName");
    });

    it("blocks .exe extension", () => {
      expect(src).toContain(".exe");
    });

    it("blocks .sh extension", () => {
      expect(src).toContain(".sh");
    });

    it("blocks .php extension", () => {
      expect(src).toContain(".php");
    });

    it("throws UploadValidationError on violation", () => {
      expect(src).toContain("UploadValidationError");
    });

    it("enforces max file size", () => {
      expect(src).toContain("maxBytes");
    });
  });

  // ─── Distributed rate limit for integrations ─────────────────────────────

  describe("integrations/executor.ts — distributed rate limit", () => {
    const src = readSrc("apps/web/src/lib/integrations/executor.ts");

    it("imports checkDistributedRateLimit instead of in-memory limit", () => {
      expect(src).toContain("checkDistributedRateLimit");
      expect(src).toContain("rate-limit/distributed");
      expect(src).not.toContain("checkIntegrationRateLimit");
    });
  });

  // ─── Privacy actions ──────────────────────────────────────────────────────

  describe("actions/privacy.ts", () => {
    const src = readSrc("apps/web/src/app/actions/privacy.ts");

    it("exports exportOrgData", () => {
      expect(src).toContain("export async function exportOrgData");
    });

    it("exports requestDataDeletion", () => {
      expect(src).toContain("export async function requestDataDeletion");
    });

    it("exports anonymizeContact", () => {
      expect(src).toContain("export async function anonymizeContact");
    });

    it("logs export events to event_logs", () => {
      expect(src).toContain("logEvent");
      expect(src).toContain("data_export_requested");
    });

    it("logs deletion requests to event_logs", () => {
      expect(src).toContain("data_deletion_requested");
    });

    it("clears PII fields on anonymizeContact", () => {
      expect(src).toContain("[eliminado]");
    });

    it("uses service_role (createAdminClient) for data operations", () => {
      expect(src).toContain("createAdminClient");
    });

    it("filters by organization_id", () => {
      expect(src).toContain("eq(\"organization_id\", org.id)");
    });
  });
});
