"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { canManageTeam, INVITABLE_ROLES } from "@/lib/permissions/roles";
import type { OrganizationRole } from "@/lib/permissions/roles";
import { logEvent } from "@/lib/observability/event-log";

export type InvitationRow = {
  id: string;
  email: string;
  role: OrganizationRole;
  token: string;
  invited_by: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  resend_count: number;
  created_at: string;
};

export type MemberRow = {
  id: string;
  user_id: string;
  role: OrganizationRole;
  created_at: string;
  profiles: { full_name: string | null; avatar_url: string | null; phone: string | null; job_title: string | null } | null;
};

export async function getTeamData(): Promise<{
  members: MemberRow[];
  invitations: InvitationRow[];
  role: OrganizationRole;
}> {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);

  const [{ data: members }, { data: invitations }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id, user_id, role, created_at, profiles(full_name, avatar_url, phone, job_title)")
      .eq("organization_id", org.id)
      .order("created_at"),
    supabase
      .from("organization_invitations")
      .select("id, email, role, token, invited_by, expires_at, accepted_at, revoked_at, resend_count, created_at")
      .eq("organization_id", org.id)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false }),
  ]);

  return {
    members: (members ?? []) as unknown as MemberRow[],
    invitations: (invitations ?? []) as InvitationRow[],
    role: org.role as OrganizationRole,
  };
}

export async function inviteMember(email: string, role: OrganizationRole): Promise<void> {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);

  if (!canManageTeam(org.role)) throw new Error("Sin permisos para invitar miembros.");
  if (!INVITABLE_ROLES.includes(role)) throw new Error("Rol no válido.");

  const emailNorm = email.trim().toLowerCase();
  if (!emailNorm || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    throw new Error("Email inválido.");
  }

  const { error } = await supabase.rpc("invite_member", {
    p_organization_id: org.id,
    p_email: emailNorm,
    p_role: role,
    p_invited_by: user.id,
  });

  if (error) throw new Error(error.message);

  const admin = createAdminClient();
  await logEvent(admin, {
    organizationId: org.id,
    source: "system",
    entityType: "user",
    entityId: user.id,
    eventType: "member_invited",
    severity: "info",
    message: `Invitación enviada a ${emailNorm} con rol ${role}`,
    metadata: { email: emailNorm, role },
  });

  revalidatePath("/settings/team");
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);

  if (!canManageTeam(org.role)) throw new Error("Sin permisos para revocar invitaciones.");

  const { error } = await supabase.rpc("revoke_invitation", {
    p_invitation_id: invitationId,
  });

  if (error) throw new Error(error.message);

  const admin = createAdminClient();
  await logEvent(admin, {
    organizationId: org.id,
    source: "system",
    entityType: "user",
    entityId: user.id,
    eventType: "invitation_revoked",
    severity: "info",
    message: `Invitación ${invitationId} revocada`,
    metadata: { invitation_id: invitationId },
  });

  revalidatePath("/settings/team");
}

export async function resendInvitation(invitationId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);

  if (!canManageTeam(org.role)) throw new Error("Sin permisos para reenviar invitaciones.");

  const admin = createAdminClient();

  const { data: inv } = await admin
    .from("organization_invitations")
    .select("id, email, resend_count, expires_at, revoked_at, accepted_at")
    .eq("id", invitationId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!inv) throw new Error("Invitación no encontrada.");
  if (inv.revoked_at) throw new Error("La invitación ya fue revocada.");
  if (inv.accepted_at) throw new Error("La invitación ya fue aceptada.");

  await admin
    .from("organization_invitations")
    .update({
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      resend_count: (inv.resend_count ?? 0) + 1,
    })
    .eq("id", invitationId);

  await logEvent(admin, {
    organizationId: org.id,
    source: "system",
    entityType: "user",
    entityId: user.id,
    eventType: "invitation_resent",
    severity: "info",
    message: `Invitación reenviada a ${inv.email}`,
    metadata: { invitation_id: invitationId, email: inv.email },
  });

  revalidatePath("/settings/team");
}

export async function updateMemberRole(memberId: string, newRole: OrganizationRole): Promise<void> {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);

  if (!canManageTeam(org.role)) throw new Error("Sin permisos para cambiar roles.");
  if (newRole === "owner") throw new Error("No se puede asignar el rol de propietario.");

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("organization_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!target) throw new Error("Miembro no encontrado.");
  if (target.role === "owner") throw new Error("No se puede cambiar el rol del propietario.");

  await admin
    .from("organization_members")
    .update({ role: newRole })
    .eq("id", memberId)
    .eq("organization_id", org.id);

  await logEvent(admin, {
    organizationId: org.id,
    source: "system",
    entityType: "user",
    entityId: user.id,
    eventType: "member_role_updated",
    severity: "info",
    message: `Rol de miembro ${target.user_id} cambiado a ${newRole}`,
    metadata: { member_id: memberId, new_role: newRole },
  });

  revalidatePath("/settings/team");
}

export async function removeMember(memberId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);

  if (!canManageTeam(org.role)) throw new Error("Sin permisos para eliminar miembros.");

  const admin = createAdminClient();

  const { data: target } = await admin
    .from("organization_members")
    .select("id, user_id, role")
    .eq("id", memberId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!target) throw new Error("Miembro no encontrado.");
  if (target.role === "owner") throw new Error("No se puede eliminar al propietario.");
  if (target.user_id === user.id) throw new Error("No puedes eliminarte a ti mismo.");

  await admin
    .from("organization_members")
    .delete()
    .eq("id", memberId)
    .eq("organization_id", org.id);

  await logEvent(admin, {
    organizationId: org.id,
    source: "system",
    entityType: "user",
    entityId: user.id,
    eventType: "member_removed",
    severity: "warning",
    message: `Miembro ${target.user_id} eliminado de la organización`,
    metadata: { member_id: memberId },
  });

  revalidatePath("/settings/team");
}

export async function acceptInvitation(token: string): Promise<void> {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.rpc("accept_invitation", {
    p_token: token,
    p_user_id: user.id,
  });

  if (error) throw new Error(error.message);
}
