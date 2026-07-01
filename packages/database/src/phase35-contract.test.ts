import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../../../");

function readSrc(rel: string) {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("FASE 35 — Legal, Privacy & Compliance contracts", () => {
  // ─── Migration ────────────────────────────────────────────────────────────

  describe("migration: phase_35_legal_privacy.sql", () => {
    const sql = readSrc("supabase/migrations/20260630060000_phase_35_legal_privacy.sql");

    it("creates legal_documents table", () => {
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS legal_documents");
    });

    it("legal_documents has doc_type and version columns", () => {
      expect(sql).toContain("doc_type");
      expect(sql).toContain("version");
    });

    it("creates legal_acceptances table", () => {
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS legal_acceptances");
    });

    it("legal_acceptances stores user_id and organization_id", () => {
      expect(sql).toContain("user_id");
      expect(sql).toContain("organization_id");
    });

    it("creates privacy_requests table", () => {
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS privacy_requests");
    });

    it("privacy_requests has request_type and status columns", () => {
      expect(sql).toContain("request_type");
      expect(sql).toContain("status");
    });

    it("privacy_requests has handled_by and notes for admin", () => {
      expect(sql).toContain("handled_by");
      expect(sql).toContain("notes");
    });

    it("enables RLS on all three tables", () => {
      const rlsCount = (sql.match(/ENABLE ROW LEVEL SECURITY/g) ?? []).length;
      expect(rlsCount).toBeGreaterThanOrEqual(3);
    });

    it("users can only read their own acceptances (RLS)", () => {
      expect(sql).toContain("user_id = auth.uid()");
    });

    it("users can only see their own privacy requests (RLS)", () => {
      expect(sql).toContain("requested_by = auth.uid()");
    });

    it("creates get_active_legal_document function", () => {
      expect(sql).toContain("get_active_legal_document");
    });

    it("creates user_has_accepted_current function", () => {
      expect(sql).toContain("user_has_accepted_current");
    });

    it("adds ai_consent_at to organizations", () => {
      expect(sql).toContain("ai_consent_at");
    });

    it("seeds initial legal document types", () => {
      expect(sql).toContain("terms");
      expect(sql).toContain("privacy");
      expect(sql).toContain("data_processing");
      expect(sql).toContain("ai_consent");
      expect(sql).toContain("cookies");
    });
  });

  // ─── Legal actions ────────────────────────────────────────────────────────

  describe("actions/legal.ts", () => {
    const src = readSrc("apps/web/src/app/actions/legal.ts");

    it("exports getConsentStatus", () => {
      expect(src).toContain("export async function getConsentStatus");
    });

    it("exports acceptDocument", () => {
      expect(src).toContain("export async function acceptDocument");
    });

    it("exports acceptAllDocuments", () => {
      expect(src).toContain("export async function acceptAllDocuments");
    });

    it("exports grantAiConsent", () => {
      expect(src).toContain("export async function grantAiConsent");
    });

    it("exports createPrivacyRequest", () => {
      expect(src).toContain("export async function createPrivacyRequest");
    });

    it("exports cancelPrivacyRequest", () => {
      expect(src).toContain("export async function cancelPrivacyRequest");
    });

    it("exports exportOrgDataSecure", () => {
      expect(src).toContain("export async function exportOrgDataSecure");
    });

    it("exports adminListPrivacyRequests", () => {
      expect(src).toContain("export async function adminListPrivacyRequests");
    });

    it("exports adminHandlePrivacyRequest", () => {
      expect(src).toContain("export async function adminHandlePrivacyRequest");
    });

    it("getConsentStatus checks all required doc types", () => {
      expect(src).toContain('"terms"');
      expect(src).toContain('"privacy"');
      expect(src).toContain('"data_processing"');
      expect(src).toContain('"ai_consent"');
    });

    it("export omits secrets via omitSecrets", () => {
      expect(src).toContain("omitSecrets");
    });

    it("export does not include embeddings or service_role tokens", () => {
      expect(src).not.toContain("embedding");
      expect(src).not.toContain("service_role");
    });

    it("uses rate limiting for privacy requests", () => {
      expect(src).toContain("checkDistributedRateLimit");
    });

    it("blocks duplicate pending privacy requests", () => {
      expect(src).toContain("Ya tienes una solicitud pendiente");
    });

    it("blocks cancelling other users requests", () => {
      expect(src).toContain("No puedes cancelar solicitudes de otros usuarios");
    });

    it("blocks cancelling non-pending requests", () => {
      expect(src).toContain("Solo se pueden cancelar solicitudes pendientes");
    });

    it("logs events to event_logs", () => {
      expect(src).toContain("logEvent");
      expect(src).toContain("privacy_request_created");
      expect(src).toContain("ai_consent_granted");
    });

    it("adminHandlePrivacyRequest requires super admin", () => {
      expect(src).toContain("requireSuperAdmin");
    });

    it("acceptDocument captures IP and user agent", () => {
      expect(src).toContain("ip_address");
      expect(src).toContain("user_agent");
    });
  });

  // ─── Legal public pages ───────────────────────────────────────────────────

  describe("legal/terms/page.tsx", () => {
    const src = readSrc("apps/web/src/app/legal/terms/page.tsx");
    it("renders terms page with LegalLayout", () => {
      expect(src).toContain("LegalLayout");
    });
    it("mentions AI processing", () => {
      expect(src).toContain("inteligencia artificial");
    });
    it("mentions acceptable use", () => {
      expect(src).toContain("Uso aceptable");
    });
  });

  describe("legal/privacy/page.tsx", () => {
    const src = readSrc("apps/web/src/app/legal/privacy/page.tsx");
    it("renders privacy page with LegalLayout", () => {
      expect(src).toContain("LegalLayout");
    });
    it("mentions user rights", () => {
      expect(src).toContain("Sus derechos");
    });
    it("mentions AI data processing disclosure", () => {
      expect(src).toContain("OpenAI");
    });
  });

  describe("legal/cookies/page.tsx", () => {
    const src = readSrc("apps/web/src/app/legal/cookies/page.tsx");
    it("renders cookies page", () => {
      expect(src).toContain("LegalLayout");
    });
    it("lists essential cookies", () => {
      expect(src).toContain("Esencial");
    });
  });

  describe("legal/data-processing/page.tsx", () => {
    const src = readSrc("apps/web/src/app/legal/data-processing/page.tsx");
    it("renders DPA page", () => {
      expect(src).toContain("LegalLayout");
    });
    it("lists subprocessors", () => {
      expect(src).toContain("Supabase");
      expect(src).toContain("OpenAI");
    });
  });

  // ─── Settings/privacy page ────────────────────────────────────────────────

  describe("settings/privacy/page.tsx", () => {
    const src = readSrc("apps/web/src/app/(crm)/settings/privacy/page.tsx");

    it("shows consent status for required docs", () => {
      expect(src).toContain("getConsentStatus");
      expect(src).toContain("Documentos legales aceptados");
    });

    it("shows AI consent section", () => {
      expect(src).toContain("Procesamiento con inteligencia artificial");
    });

    it("shows privacy requests section", () => {
      expect(src).toContain("Solicitudes de privacidad");
    });

    it("offers export data request", () => {
      expect(src).toContain("Exportar mis datos");
    });

    it("offers delete data request", () => {
      expect(src).toContain("Solicitar eliminacion");
    });

    it("shows acceptance history", () => {
      expect(src).toContain("Historial de aceptaciones");
    });

    it("links to legal documents", () => {
      expect(src).toContain("/legal/terms");
      expect(src).toContain("/legal/privacy");
    });
  });

  // ─── Cookie banner ────────────────────────────────────────────────────────

  describe("cookie-banner.tsx", () => {
    const src = readSrc("apps/web/src/components/cookie-banner.tsx");

    it("is a client component", () => {
      expect(src).toContain('"use client"');
    });

    it("uses cookie_consent key", () => {
      expect(src).toContain("cookie_consent");
    });

    it("links to cookies policy", () => {
      expect(src).toContain("/legal/cookies");
    });

    it("only activates essential cookies", () => {
      expect(src).toContain("esenciales");
    });
  });

  // ─── Admin privacy page ───────────────────────────────────────────────────

  describe("admin/privacy/page.tsx", () => {
    const src = readSrc("apps/web/src/app/admin/privacy/page.tsx");

    it("imports adminListPrivacyRequests", () => {
      expect(src).toContain("adminListPrivacyRequests");
    });

    it("imports adminHandlePrivacyRequest", () => {
      expect(src).toContain("adminHandlePrivacyRequest");
    });

    it("shows pending count", () => {
      expect(src).toContain("Pendientes");
    });

    it("allows processing/completed/rejected transitions", () => {
      expect(src).toContain('"processing"');
      expect(src).toContain('"completed"');
      expect(src).toContain('"rejected"');
    });
  });

  // ─── Onboarding consent gate ──────────────────────────────────────────────

  describe("onboarding/setup-actions.ts — consent gate", () => {
    const src = readSrc("apps/web/src/app/onboarding/setup-actions.ts");

    it("finishOnboarding checks consent before completing", () => {
      expect(src).toContain("getConsentStatus");
    });

    it("redirects to error if consent missing", () => {
      expect(src).toContain("consent_required");
    });

    it("checks terms, privacy and data_processing", () => {
      expect(src).toContain("consent.terms");
      expect(src).toContain("consent.privacy");
      expect(src).toContain("consent.data_processing");
    });
  });

  // ─── Navigation ───────────────────────────────────────────────────────────

  describe("navigation/main-nav.ts", () => {
    const src = readSrc("apps/web/src/lib/navigation/main-nav.ts");

    it("includes settings/privacy route", () => {
      expect(src).toContain("/settings/privacy");
    });

    it("privacy route is visible for all roles (not adminOnly)", () => {
      const privacyLine = src.split("\n").find((l) => l.includes("/settings/privacy"));
      expect(privacyLine).toBeDefined();
      expect(privacyLine).toContain("false");
    });
  });

  // ─── Admin nav ────────────────────────────────────────────────────────────

  describe("admin/layout.tsx", () => {
    const src = readSrc("apps/web/src/app/admin/layout.tsx");

    it("includes privacy link in admin nav", () => {
      expect(src).toContain("/admin/privacy");
    });
  });

  // ─── Root layout cookie banner ────────────────────────────────────────────

  describe("app/layout.tsx", () => {
    const src = readSrc("apps/web/src/app/layout.tsx");

    it("imports and renders CookieBanner", () => {
      expect(src).toContain("CookieBanner");
    });
  });
});
