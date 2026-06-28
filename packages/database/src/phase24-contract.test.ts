import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../../..");
const migration = readFileSync(resolve(root, "supabase/migrations/20260628140000_phase_24_client_onboarding.sql"), "utf8");
const page = readFileSync(resolve(root, "apps/web/src/app/onboarding/page.tsx"), "utf8");
const actions = readFileSync(resolve(root, "apps/web/src/app/onboarding/setup-actions.ts"), "utf8");
const status = readFileSync(resolve(root, "apps/web/src/lib/onboarding/status.ts"), "utf8");

describe("phase 24 onboarding contracts", () => {
  it("provides all nine guided steps and final checklist", () => {
    for (const label of ["Negocio", "Actividad", "Asistentes", "Estilo", "Conocimiento", "WhatsApp", "Automatizaciones", "Prueba", "Checklist"]) expect(page).toContain(label);
    expect(page).toContain("SetupSummary");
  });

  it("creates assistants, initial knowledge and a safe routing preview", () => {
    expect(actions).toContain("createOnboardingAssistants");
    expect(actions).toContain("createInitialKnowledge");
    expect(actions).toContain("simulateOnboardingMessage");
    expect(actions).toContain("routeAssistant");
    expect(actions).toContain("indexKnowledgeDocument");
  });

  it("reports connected and disconnected WhatsApp without reading secrets client-side", () => {
    expect(status).toContain("tokenStatus");
    expect(status).toContain("WHATSAPP_VERIFY_TOKEN");
    expect(status).not.toContain("WHATSAPP_ACCESS_TOKEN");
  });

  it("enforces tenant RLS and leaves automatic sending off by default", () => {
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("public.is_org_member(organization_id)");
    expect(migration).toContain("public.is_org_admin(organization_id)");
    expect(page).toContain("Todo está apagado por defecto");
    expect(actions).toContain('auto_reply_enabled: false');
  });
});
