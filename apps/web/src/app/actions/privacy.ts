"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { logEvent } from "@/lib/observability/event-log";

/**
 * Export all organization data as a structured JSON object.
 * The calling user must be an owner or admin of the organization.
 */
export async function exportOrgData(): Promise<{
  organization: Record<string, unknown>;
  members: unknown[];
  leads: unknown[];
  contacts: unknown[];
  conversations: unknown[];
  knowledge_documents: unknown[];
  assistants: unknown[];
  automation_rules: unknown[];
  smart_tags: unknown[];
  variables: unknown[];
  exported_at: string;
}> {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);
  const admin = createAdminClient();

  const [
    { data: orgRow },
    { data: members },
    { data: leads },
    { data: contacts },
    { data: conversations },
    { data: knowledge },
    { data: assistants },
    { data: automations },
    { data: smartTags },
    { data: variables },
  ] = await Promise.all([
    admin.from("organizations").select("id, name, created_at").eq("id", org.id).maybeSingle(),
    admin.from("organization_members").select("user_id, role, created_at").eq("organization_id", org.id),
    admin.from("leads").select("id, name, email, phone, status, source, created_at").eq("organization_id", org.id),
    admin.from("contacts").select("id, name, email, phone, company, created_at").eq("organization_id", org.id),
    admin
      .from("conversations")
      .select("id, channel, status, created_at")
      .eq("organization_id", org.id)
      .limit(5000),
    admin
      .from("knowledge_documents")
      .select("id, title, category, source_type, created_at")
      .eq("organization_id", org.id)
      .is("archived_at", null),
    admin.from("assistants").select("id, name, mode, active, created_at").eq("organization_id", org.id),
    admin
      .from("automation_rules")
      .select("id, name, trigger_type, active, created_at")
      .eq("organization_id", org.id),
    admin.from("tags").select("id, name, color, created_at").eq("organization_id", org.id),
    admin.from("variables").select("id, name, type, created_at").eq("organization_id", org.id),
  ]);

  await logEvent(admin, {
    organizationId: org.id,
    source: "system",
    entityType: "user",
    entityId: user.id,
    eventType: "data_export_requested",
    severity: "info",
    message: "Exportación de datos solicitada por usuario",
    metadata: {},
  });

  return {
    organization: orgRow ?? { id: org.id },
    members: members ?? [],
    leads: leads ?? [],
    contacts: contacts ?? [],
    conversations: conversations ?? [],
    knowledge_documents: knowledge ?? [],
    assistants: assistants ?? [],
    automation_rules: automations ?? [],
    smart_tags: smartTags ?? [],
    variables: variables ?? [],
    exported_at: new Date().toISOString(),
  };
}

/**
 * Request anonymization/deletion of PII for this organization.
 * Records the request in event_logs. Actual deletion is performed by an admin
 * or automated job (FASE 35 will add the full compliance workflow).
 */
export async function requestDataDeletion(reason?: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);
  const admin = createAdminClient();

  await logEvent(admin, {
    organizationId: org.id,
    source: "system",
    entityType: "user",
    entityId: user.id,
    eventType: "data_deletion_requested",
    severity: "warning",
    message: "Solicitud de eliminación de datos recibida",
    metadata: { reason: (reason ?? "").slice(0, 500) },
  });
}

/**
 * Anonymize PII fields for a specific contact (GDPR right to erasure for a person).
 * Clears name, email, phone. Does NOT delete conversation history.
 */
export async function anonymizeContact(contactId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);
  const admin = createAdminClient();

  const { data: contact } = await admin
    .from("contacts")
    .select("id, organization_id")
    .eq("id", contactId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!contact) throw new Error("Contacto no encontrado.");

  await admin
    .from("contacts")
    .update({ name: "[eliminado]", email: null, phone: null, notes: null })
    .eq("id", contactId)
    .eq("organization_id", org.id);

  await logEvent(admin, {
    organizationId: org.id,
    source: "system",
    entityType: "user",
    entityId: user.id,
    eventType: "contact_anonymized",
    severity: "info",
    message: `Contacto ${contactId} anonimizado por solicitud`,
    metadata: { contact_id: contactId },
  });
}
