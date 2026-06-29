/**
 * Phase 30 contract tests — Admin Panel, Plans, and Credits
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../../..");

function readFile(rel: string) {
  return readFileSync(resolve(ROOT, rel), "utf-8");
}

// ─── Migration SQL ────────────────────────────────────────────────────────────

describe("Migration 20260629000000_phase_30_admin_plans", () => {
  const sql = readFile("supabase/migrations/20260629000000_phase_30_admin_plans.sql");

  it("creates platform_users table", () => {
    expect(sql.toLowerCase()).toContain("create table");
    expect(sql).toContain("platform_users");
  });

  it("restricts platform_users to service_role only", () => {
    // No SELECT granted to authenticated — service_role only via grant
    expect(sql).toContain("platform_users");
    expect(sql).toContain("service_role");
    // authenticated role is NOT granted SELECT
    expect(sql).not.toMatch(/grant select on public\.platform_users to authenticated/i);
  });

  it("creates is_super_admin() SECURITY DEFINER function", () => {
    expect(sql.toLowerCase()).toContain("function public.is_super_admin()");
    expect(sql.toLowerCase()).toContain("security definer");
  });

  it("creates admin_audit_log table", () => {
    expect(sql.toLowerCase()).toContain("create table");
    expect(sql).toContain("admin_audit_log");
  });

  it("audit log is service_role only", () => {
    expect(sql).toContain("admin_audit_log");
    expect(sql).toContain("service_role");
    // No SELECT granted to authenticated
    expect(sql).not.toMatch(/grant select on public\.admin_audit_log to authenticated/i);
  });

  it("adds slug column to plans", () => {
    expect(sql.toLowerCase()).toContain("add column if not exists slug");
  });

  it("adds commercial_status to organization_subscriptions", () => {
    expect(sql).toContain("commercial_status");
  });

  it("creates admin_load_credits function", () => {
    expect(sql.toLowerCase()).toContain("function public.admin_load_credits");
    expect(sql.toLowerCase()).toContain("security definer");
  });

  it("creates admin_set_subscription function", () => {
    expect(sql.toLowerCase()).toContain("function public.admin_set_subscription");
    expect(sql.toLowerCase()).toContain("security definer");
  });

  it("creates get_org_plan_limits function", () => {
    expect(sql.toLowerCase()).toContain("function public.get_org_plan_limits");
    expect(sql.toLowerCase()).toContain("security definer");
  });

  it("creates log_admin_action function", () => {
    expect(sql.toLowerCase()).toContain("function public.log_admin_action");
    expect(sql.toLowerCase()).toContain("security definer");
  });

  it("inserts Business and Enterprise plans", () => {
    expect(sql).toContain("business");
    expect(sql).toContain("enterprise");
  });

  it("inserts Demo plan with bypass_limits", () => {
    expect(sql).toContain("demo");
    expect(sql).toContain("bypass_limits");
  });
});

// ─── Auth lib ─────────────────────────────────────────────────────────────────

describe("Admin auth lib (apps/web/src/lib/admin/auth.ts)", () => {
  const src = readFile("apps/web/src/lib/admin/auth.ts");

  it("exports requireSuperAdmin", () => {
    expect(src).toContain("export async function requireSuperAdmin");
  });

  it("exports isSuperAdmin", () => {
    expect(src).toContain("export async function isSuperAdmin");
  });

  it("uses createAdminClient not service role directly", () => {
    expect(src).toContain("createAdminClient");
    expect(src).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("redirects non-super-admin users", () => {
    expect(src).toContain("redirect(");
  });

  it("queries platform_users table", () => {
    expect(src).toContain("platform_users");
  });
});

// ─── Organizations lib ────────────────────────────────────────────────────────

describe("Admin organizations lib (apps/web/src/lib/admin/organizations.ts)", () => {
  const src = readFile("apps/web/src/lib/admin/organizations.ts");

  it("exports listAdminOrganizations", () => {
    expect(src).toContain("export async function listAdminOrganizations");
  });

  it("exports getAdminOrgDetail", () => {
    expect(src).toContain("export async function getAdminOrgDetail");
  });

  it("exports AdminOrgRow type", () => {
    expect(src).toContain("AdminOrgRow");
  });

  it("exports AdminOrgDetail type", () => {
    expect(src).toContain("AdminOrgDetail");
  });

  it("includes member_count in org row", () => {
    expect(src).toContain("member_count");
  });

  it("includes whatsapp_connected in org row", () => {
    expect(src).toContain("whatsapp_connected");
  });

  it("includes wallet info", () => {
    expect(src).toContain("available_credits");
    expect(src).toContain("is_admin_exempt");
  });

  it("detail includes members array", () => {
    expect(src).toContain("members");
  });

  it("detail includes recent_errors", () => {
    expect(src).toContain("recent_errors");
  });

  it("detail includes failed_jobs", () => {
    expect(src).toContain("failed_jobs");
  });
});

// ─── Plans lib ────────────────────────────────────────────────────────────────

describe("Admin plans lib (apps/web/src/lib/admin/plans.ts)", () => {
  const src = readFile("apps/web/src/lib/admin/plans.ts");

  it("exports listPlans", () => {
    expect(src).toContain("export async function listPlans");
  });

  it("exports getPlanBySlug", () => {
    expect(src).toContain("export async function getPlanBySlug");
  });

  it("exports checkOrgLimit", () => {
    expect(src).toContain("export async function checkOrgLimit");
  });

  it("checkOrgLimit returns allowed boolean", () => {
    expect(src).toContain("allowed");
  });

  it("checkOrgLimit respects bypass_limits", () => {
    expect(src).toContain("bypass_limits");
  });

  it("queries plan limits from organization_subscriptions", () => {
    expect(src).toContain("organization_subscriptions");
  });

  it("PlanRow type includes slug", () => {
    expect(src).toContain("slug");
  });

  it("PlanRow type includes price_usd_monthly", () => {
    expect(src).toContain("price_usd_monthly");
  });

  it("PlanRow type includes max_automations", () => {
    expect(src).toContain("max_automations");
  });
});

// ─── Admin server actions ──────────────────────────────────────────────────────

describe("Admin server actions (apps/web/src/app/actions/admin.ts)", () => {
  const src = readFile("apps/web/src/app/actions/admin.ts");

  it("is a server action file", () => {
    expect(src).toMatch(/^"use server"/);
  });

  it("all actions gate through requireSuperAdmin", () => {
    expect(src).toContain("requireSuperAdmin");
  });

  it("exports adminListOrganizations", () => {
    expect(src).toContain("export async function adminListOrganizations");
  });

  it("exports adminGetOrganization", () => {
    expect(src).toContain("export async function adminGetOrganization");
  });

  it("exports adminLoadCredits", () => {
    expect(src).toContain("export async function adminLoadCredits");
  });

  it("exports adminAdjustCredits", () => {
    expect(src).toContain("export async function adminAdjustCredits");
  });

  it("exports adminSetSubscription", () => {
    expect(src).toContain("export async function adminSetSubscription");
  });

  it("exports adminGetSystemStatus", () => {
    expect(src).toContain("export async function adminGetSystemStatus");
  });

  it("exports adminGetAuditLog", () => {
    expect(src).toContain("export async function adminGetAuditLog");
  });

  it("logs admin actions to audit log", () => {
    expect(src).toContain("log_admin_action");
  });

  it("uses createAdminClient not authenticated client", () => {
    expect(src).toContain("createAdminClient");
  });

  it("does not expose secrets in metadata", () => {
    expect(src).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(src).not.toContain("OPENAI_API_KEY");
  });

  it("validates amount is positive for credit loads", () => {
    expect(src).toContain("amount <= 0");
  });

  it("revalidates paths after mutations", () => {
    expect(src).toContain("revalidatePath");
  });
});

// ─── Limit enforcement ────────────────────────────────────────────────────────

describe("Plan limit enforcement in create actions", () => {
  const aiSrc = readFile("apps/web/src/app/actions/ai.ts");
  const automationSrc = readFile("apps/web/src/app/actions/automations.ts");

  it("ai.ts imports checkOrgLimit", () => {
    expect(aiSrc).toContain("checkOrgLimit");
  });

  it("ai.ts checks max_assistants before insert", () => {
    expect(aiSrc).toContain("max_assistants");
    expect(aiSrc).toContain("plan_limit");
  });

  it("automations.ts imports checkOrgLimit", () => {
    expect(automationSrc).toContain("checkOrgLimit");
  });

  it("automations.ts checks max_automations before insert", () => {
    expect(automationSrc).toContain("max_automations");
    expect(automationSrc).toContain("plan_limit");
  });

  it("redirects with plan_limit error when limit exceeded", () => {
    expect(aiSrc).toContain("?error=plan_limit");
    expect(automationSrc).toContain("?error=plan_limit");
  });
});

// ─── Admin UI routes ──────────────────────────────────────────────────────────

describe("Admin UI routes exist", () => {
  it("admin layout exists with super_admin guard", () => {
    const src = readFile("apps/web/src/app/admin/layout.tsx");
    expect(src).toContain("requireSuperAdmin");
  });

  it("admin dashboard page exists", () => {
    const src = readFile("apps/web/src/app/admin/page.tsx");
    expect(src).toContain("adminGetSystemStatus");
  });

  it("admin organizations list page exists", () => {
    const src = readFile("apps/web/src/app/admin/organizations/page.tsx");
    expect(src).toContain("adminListOrganizations");
  });

  it("admin org detail page exists", () => {
    const src = readFile("apps/web/src/app/admin/organizations/[id]/page.tsx");
    expect(src).toContain("adminGetOrganization");
  });

  it("admin plans page exists", () => {
    const src = readFile("apps/web/src/app/admin/plans/page.tsx");
    expect(src).toContain("adminListPlans");
  });

  it("admin credits page exists", () => {
    const src = readFile("apps/web/src/app/admin/credits/page.tsx");
    expect(src).toContain("adminGetCreditsOverview");
  });

  it("admin system page exists", () => {
    const src = readFile("apps/web/src/app/admin/system/page.tsx");
    expect(src).toContain("adminGetSystemStatus");
    expect(src).toContain("adminGetAuditLog");
  });
});

// ─── Security invariants ──────────────────────────────────────────────────────

describe("Phase 30 security invariants", () => {
  it("admin auth does not expose platform_users to authenticated role via direct grant", () => {
    const sql = readFile("supabase/migrations/20260629000000_phase_30_admin_plans.sql");
    // No direct SELECT grant to authenticated on platform_users
    expect(sql).not.toMatch(/grant select on public\.platform_users to authenticated/i);
    // Access is via is_super_admin() SECURITY DEFINER which bypasses RLS
    expect(sql.toLowerCase()).toContain("is_super_admin");
  });

  it("admin layout requires super_admin before rendering children", () => {
    const layout = readFile("apps/web/src/app/admin/layout.tsx");
    // requireSuperAdmin must be called before JSX return
    const requireIdx = layout.indexOf("requireSuperAdmin");
    const returnIdx = layout.indexOf("return (");
    expect(requireIdx).toBeGreaterThanOrEqual(0);
    expect(returnIdx).toBeGreaterThanOrEqual(0);
    expect(requireIdx).toBeLessThan(returnIdx);
  });

  it("admin actions use createAdminClient not requireUser supabase", () => {
    const src = readFile("apps/web/src/app/actions/admin.ts");
    expect(src).toContain("createAdminClient()");
    // The admin client must be the one used for org queries, not the user's supabase
  });

  it("admin audit log is append-only (no UPDATE/DELETE policies)", () => {
    const sql = readFile("supabase/migrations/20260629000000_phase_30_admin_plans.sql");
    const auditLogSection = sql.substring(sql.indexOf("admin_audit_log"));
    // Should have INSERT but no UPDATE/DELETE policy for admin_audit_log
    expect(auditLogSection).not.toContain("FOR UPDATE\nON admin_audit_log");
    expect(auditLogSection).not.toContain("FOR DELETE\nON admin_audit_log");
  });
});
