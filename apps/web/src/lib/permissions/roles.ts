export const organizationRoles = ["owner", "admin", "supervisor", "agent", "member", "viewer"] as const;
export type OrganizationRole = (typeof organizationRoles)[number];

export const ROLE_LABELS: Record<OrganizationRole, string> = {
  owner:      "Propietario",
  admin:      "Administrador",
  supervisor: "Supervisor",
  agent:      "Agente",
  member:     "Miembro",
  viewer:     "Visor",
};

export const INVITABLE_ROLES: OrganizationRole[] = ["admin", "supervisor", "agent", "member", "viewer"];

export function normalizeRole(role: string): OrganizationRole {
  return (organizationRoles as readonly string[]).includes(role)
    ? (role as OrganizationRole)
    : "member";
}

export function canManageSettings(role: string) {
  const r = normalizeRole(role);
  return r === "owner" || r === "admin";
}

export function canManageIntegrations(role: string) {
  return canManageSettings(role);
}

export function canManageTeam(role: string) {
  return canManageSettings(role);
}

export function canViewReports(role: string) {
  const r = normalizeRole(role);
  return r === "owner" || r === "admin" || r === "supervisor";
}

export function canUseInbox(role: string) {
  return normalizeRole(role) !== "viewer";
}

export function canEditData(role: string) {
  return normalizeRole(role) !== "viewer";
}

export function roleCapabilities(role: string) {
  return {
    manageSettings:     canManageSettings(role),
    manageIntegrations: canManageIntegrations(role),
    manageTeam:         canManageTeam(role),
    viewReports:        canViewReports(role),
    useInbox:           canUseInbox(role),
    editData:           canEditData(role),
  };
}
