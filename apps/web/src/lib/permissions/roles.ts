export const organizationRoles = ["owner", "admin", "agent", "member"] as const;
export type OrganizationRole = (typeof organizationRoles)[number];

export function normalizeRole(role: string): OrganizationRole {
  return role === "owner" || role === "admin" || role === "agent" ? role : "member";
}

export function canManageSettings(role: string) {
  const normalized = normalizeRole(role);
  return normalized === "owner" || normalized === "admin";
}

export function canManageIntegrations(role: string) {
  return canManageSettings(role);
}

export function canUseInbox(role: string) {
  return organizationRoles.includes(normalizeRole(role));
}

export function roleCapabilities(role: string) {
  return {
    manageSettings: canManageSettings(role),
    manageIntegrations: canManageIntegrations(role),
    useInbox: canUseInbox(role)
  };
}
