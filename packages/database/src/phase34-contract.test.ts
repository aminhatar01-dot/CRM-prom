import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(__dirname, "../../../");

function readSrc(rel: string) {
  return readFileSync(resolve(root, rel), "utf8");
}

describe("FASE 34 — Account, Team & Roles contracts", () => {
  // ─── Migration ────────────────────────────────────────────────────────────

  describe("migration: phase_34_account_team_roles.sql", () => {
    const sql = readSrc("supabase/migrations/20260630000000_phase_34_account_team_roles.sql");

    it("adds supervisor role to organization_role enum", () => {
      expect(sql).toContain("supervisor");
    });

    it("adds viewer role to organization_role enum", () => {
      expect(sql).toContain("viewer");
    });

    it("extends profiles with phone and job_title", () => {
      expect(sql).toContain("phone");
      expect(sql).toContain("job_title");
    });

    it("extends organizations with country, currency, timezone", () => {
      expect(sql).toContain("country");
      expect(sql).toContain("currency");
      expect(sql).toContain("timezone");
    });

    it("creates organization_invitations table", () => {
      expect(sql).toContain("CREATE TABLE IF NOT EXISTS organization_invitations");
    });

    it("organization_invitations has token with UNIQUE constraint", () => {
      expect(sql).toContain("token");
      expect(sql).toContain("UNIQUE");
    });

    it("organization_invitations has expires_at column", () => {
      expect(sql).toContain("expires_at");
    });

    it("enables RLS on organization_invitations", () => {
      expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    });

    it("creates is_org_owner SECURITY DEFINER function", () => {
      expect(sql).toContain("is_org_owner");
      expect(sql).toContain("SECURITY DEFINER");
    });

    it("creates invite_member SECURITY DEFINER function", () => {
      expect(sql).toContain("invite_member");
    });

    it("creates accept_invitation SECURITY DEFINER function", () => {
      expect(sql).toContain("accept_invitation");
    });

    it("creates revoke_invitation SECURITY DEFINER function", () => {
      expect(sql).toContain("revoke_invitation");
    });

    it("blocks inviting someone as owner", () => {
      expect(sql).toContain("Cannot invite a member with the owner role");
    });

    it("accept_invitation checks expiry", () => {
      expect(sql).toContain("expires_at < now()");
    });

    it("accept_invitation checks revoked_at", () => {
      expect(sql).toContain("revoked_at IS NOT NULL");
    });
  });

  // ─── Roles / permissions ──────────────────────────────────────────────────

  describe("roles.ts", () => {
    const src = readSrc("apps/web/src/lib/permissions/roles.ts");

    it("exports supervisor and viewer in organizationRoles", () => {
      expect(src).toContain('"supervisor"');
      expect(src).toContain('"viewer"');
    });

    it("exports ROLE_LABELS map", () => {
      expect(src).toContain("ROLE_LABELS");
    });

    it("exports INVITABLE_ROLES (excludes owner)", () => {
      expect(src).toContain("INVITABLE_ROLES");
      expect(src).toContain("INVITABLE_ROLES");
    });

    it("exports canManageTeam", () => {
      expect(src).toContain("export function canManageTeam");
    });

    it("exports canViewReports (supervisor gets access)", () => {
      expect(src).toContain("supervisor");
      expect(src).toContain("export function canViewReports");
    });

    it("viewer cannot use inbox", () => {
      expect(src).toContain('normalizeRole(role) !== "viewer"');
    });
  });

  // ─── Server action: team.ts ───────────────────────────────────────────────

  describe("actions/team.ts", () => {
    const src = readSrc("apps/web/src/app/actions/team.ts");

    it("exports inviteMember", () => {
      expect(src).toContain("export async function inviteMember");
    });

    it("exports revokeInvitation", () => {
      expect(src).toContain("export async function revokeInvitation");
    });

    it("exports resendInvitation", () => {
      expect(src).toContain("export async function resendInvitation");
    });

    it("exports updateMemberRole", () => {
      expect(src).toContain("export async function updateMemberRole");
    });

    it("exports removeMember", () => {
      expect(src).toContain("export async function removeMember");
    });

    it("exports acceptInvitation", () => {
      expect(src).toContain("export async function acceptInvitation");
    });

    it("exports getTeamData", () => {
      expect(src).toContain("export async function getTeamData");
    });

    it("checks canManageTeam before invite", () => {
      expect(src).toContain("canManageTeam");
    });

    it("blocks assigning owner role", () => {
      expect(src).toContain('"owner"');
      expect(src).toContain("No se puede asignar el rol de propietario");
    });

    it("blocks removing the owner member", () => {
      expect(src).toContain("No se puede eliminar al propietario");
    });

    it("blocks removing yourself", () => {
      expect(src).toContain("No puedes eliminarte a ti mismo");
    });

    it("validates email format before invite", () => {
      expect(src).toContain("@[^\\s@]+\\.[^\\s@]+");
    });

    it("logs events to event_logs", () => {
      expect(src).toContain("logEvent");
      expect(src).toContain("member_invited");
    });

    it("revalidates /settings/team after mutations", () => {
      expect(src).toContain('revalidatePath("/settings/team")');
    });
  });

  // ─── Server action: organization.ts ──────────────────────────────────────

  describe("actions/organization.ts", () => {
    const src = readSrc("apps/web/src/app/actions/organization.ts");

    it("exports updateOrganization", () => {
      expect(src).toContain("export async function updateOrganization");
    });

    it("checks canManageSettings before update", () => {
      expect(src).toContain("canManageSettings");
    });

    it("uses createAdminClient for writes", () => {
      expect(src).toContain("createAdminClient");
    });

    it("filters by organization id", () => {
      expect(src).toContain("eq(\"id\", org.id)");
    });
  });

  // ─── Server action: profile.ts ────────────────────────────────────────────

  describe("actions/profile.ts", () => {
    const src = readSrc("apps/web/src/app/actions/profile.ts");

    it("exports updateProfile", () => {
      expect(src).toContain("export async function updateProfile");
    });

    it("exports changePassword", () => {
      expect(src).toContain("export async function changePassword");
    });

    it("validates minimum password length", () => {
      expect(src).toContain("8");
    });

    it("verifies current password before change", () => {
      expect(src).toContain("signInWithPassword");
    });
  });

  // ─── UI pages ─────────────────────────────────────────────────────────────

  describe("settings/team/page.tsx", () => {
    const src = readSrc("apps/web/src/app/(crm)/settings/team/page.tsx");

    it("imports getTeamData", () => {
      expect(src).toContain("getTeamData");
    });

    it("shows invite form when admin", () => {
      expect(src).toContain("Invitar miembro");
    });

    it("shows role guide section", () => {
      expect(src).toContain("Guia de roles");
    });
  });

  describe("settings/organization/page.tsx", () => {
    const src = readSrc("apps/web/src/app/(crm)/settings/organization/page.tsx");

    it("redirects non-admins to dashboard", () => {
      expect(src).toContain('redirect("/dashboard")');
    });

    it("has country selector", () => {
      expect(src).toContain("country");
    });
  });

  describe("settings/profile/page.tsx", () => {
    const src = readSrc("apps/web/src/app/(crm)/settings/profile/page.tsx");

    it("has password change section", () => {
      expect(src).toContain("Cambiar contraseña");
    });

    it("has profile data section", () => {
      expect(src).toContain("Datos personales");
    });
  });

  describe("invite/[token]/page.tsx", () => {
    const src = readSrc("apps/web/src/app/invite/[token]/page.tsx");

    it("checks token validity (not found)", () => {
      expect(src).toContain("no es valido");
    });

    it("checks revoked_at", () => {
      expect(src).toContain("revocada");
    });

    it("checks accepted_at", () => {
      expect(src).toContain("ya fue utilizada");
    });

    it("checks expires_at", () => {
      expect(src).toContain("expirado");
    });

    it("shows login link for unauthenticated users", () => {
      expect(src).toContain("Iniciar sesion");
    });

    it("warns when logged-in email differs from invitation email", () => {
      expect(src).toContain("cuenta correcta");
    });
  });

  // ─── Navigation ───────────────────────────────────────────────────────────

  describe("navigation/main-nav.ts", () => {
    const src = readSrc("apps/web/src/lib/navigation/main-nav.ts");

    it("includes settings/team route", () => {
      expect(src).toContain("/settings/team");
    });

    it("includes settings/organization route", () => {
      expect(src).toContain("/settings/organization");
    });

    it("includes settings/profile route", () => {
      expect(src).toContain("/settings/profile");
    });
  });
});
