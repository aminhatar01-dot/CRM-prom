"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { logEvent } from "@/lib/observability/event-log";
import { checkDistributedRateLimit } from "@/lib/rate-limit/distributed";

const SECRET_KEYS = new Set(["password", "token", "secret", "key", "credential", "api_key", "access_token", "refresh_token", "private_key", "webhook_secret"]);
function omitSecrets(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SECRET_KEYS.has(k.toLowerCase())) { out[k] = "[redacted]"; continue; }
    if (v && typeof v === "object" && !Array.isArray(v)) { out[k] = omitSecrets(v as Record<string, unknown>); continue; }
    out[k] = v;
  }
  return out;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type LegalDocument = {
  id: string;
  doc_type: string;
  version: string;
  title: string;
  effective_at: string;
};

export type LegalAcceptance = {
  id: string;
  doc_type: string;
  version: string;
  accepted_at: string;
  document_id: string;
};

export type PrivacyRequest = {
  id: string;
  organization_id: string;
  request_type: string;
  status: string;
  target_type: string | null;
  target_id: string | null;
  reason: string | null;
  export_url: string | null;
  export_expires_at: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
};

export type ConsentStatus = {
  terms:           boolean;
  privacy:         boolean;
  data_processing: boolean;
  ai_consent:      boolean;
  allAccepted:     boolean;
};

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getActiveDocuments(): Promise<LegalDocument[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("legal_documents")
    .select("id, doc_type, version, title, effective_at")
    .eq("active", true)
    .order("effective_at", { ascending: false });
  return (data ?? []) as LegalDocument[];
}

export async function getMyAcceptances(): Promise<LegalAcceptance[]> {
  const { user } = await requireUser();
  const admin = createAdminClient();
  const { data } = await admin
    .from("legal_acceptances")
    .select("id, doc_type, version, accepted_at, document_id")
    .eq("user_id", user.id)
    .order("accepted_at", { ascending: false });
  return (data ?? []) as LegalAcceptance[];
}

export async function getConsentStatus(): Promise<ConsentStatus> {
  const { user } = await requireUser();
  const admin = createAdminClient();

  const { data: acceptances } = await admin
    .from("legal_acceptances")
    .select("doc_type, document_id, legal_documents(active)")
    .eq("user_id", user.id);

  const accepted = new Set<string>();
  for (const a of acceptances ?? []) {
    const doc = Array.isArray(a.legal_documents) ? a.legal_documents[0] : a.legal_documents;
    if (doc && (doc as { active: boolean }).active) {
      accepted.add(a.doc_type);
    }
  }

  const terms           = accepted.has("terms");
  const privacy         = accepted.has("privacy");
  const data_processing = accepted.has("data_processing");
  const ai_consent      = accepted.has("ai_consent");

  return { terms, privacy, data_processing, ai_consent, allAccepted: terms && privacy && data_processing && ai_consent };
}

export async function getMyPrivacyRequests(): Promise<PrivacyRequest[]> {
  const { user } = await requireUser();
  const admin = createAdminClient();
  const { data } = await admin
    .from("privacy_requests")
    .select("id, organization_id, request_type, status, target_type, target_id, reason, export_url, export_expires_at, completed_at, notes, created_at")
    .eq("requested_by", user.id)
    .order("created_at", { ascending: false });
  return (data ?? []) as PrivacyRequest[];
}

// ─── Accept legal document ────────────────────────────────────────────────────

export async function acceptDocument(docType: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);
  const admin = createAdminClient();

  const { data: doc } = await admin
    .from("legal_documents")
    .select("id, version")
    .eq("doc_type", docType)
    .eq("active", true)
    .order("effective_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!doc) throw new Error(`Documento '${docType}' no encontrado o no activo.`);

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = hdrs.get("user-agent") ?? null;

  const { error } = await admin.from("legal_acceptances").insert({
    user_id:         user.id,
    organization_id: org.id,
    document_id:     doc.id,
    doc_type:        docType,
    version:         doc.version,
    ip_address:      ip,
    user_agent:      ua?.slice(0, 500),
  });

  if (error && !error.message.includes("duplicate")) throw new Error(error.message);

  revalidatePath("/settings/privacy");
}

export async function acceptAllDocuments(docTypes: string[]): Promise<void> {
  for (const docType of docTypes) {
    await acceptDocument(docType);
  }
}

// ─── AI consent ───────────────────────────────────────────────────────────────

export async function grantAiConsent(): Promise<void> {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);
  const admin = createAdminClient();

  await admin
    .from("organizations")
    .update({ ai_consent_at: new Date().toISOString(), ai_consent_by: user.id })
    .eq("id", org.id);

  await acceptDocument("ai_consent");

  await logEvent(admin, {
    organizationId: org.id,
    source: "system",
    entityType: "user",
    entityId: user.id,
    eventType: "ai_consent_granted",
    severity: "info",
    message: "Consentimiento de procesamiento IA otorgado",
    metadata: {},
  });

  revalidatePath("/settings/privacy");
}

// ─── Privacy requests ─────────────────────────────────────────────────────────

export async function createPrivacyRequest(
  requestType: "export_data" | "delete_data" | "anonymize_contact" | "restrict_processing",
  options?: { targetType?: string; targetId?: string; reason?: string },
): Promise<void> {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);

  const allowed = await checkDistributedRateLimit(supabase, org.id, "api_requests");
  if (!allowed) throw new Error("Demasiadas solicitudes. Espera un momento antes de intentarlo nuevamente.");

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("privacy_requests")
    .select("id")
    .eq("organization_id", org.id)
    .eq("requested_by", user.id)
    .eq("request_type", requestType)
    .in("status", ["pending", "processing"])
    .maybeSingle();

  if (existing) throw new Error("Ya tienes una solicitud pendiente de este tipo.");

  const { error } = await admin.from("privacy_requests").insert({
    organization_id: org.id,
    requested_by:    user.id,
    request_type:    requestType,
    target_type:     options?.targetType ?? null,
    target_id:       options?.targetId ?? null,
    reason:          options?.reason?.slice(0, 1000) ?? null,
  });

  if (error) throw new Error(error.message);

  await logEvent(admin, {
    organizationId: org.id,
    source: "system",
    entityType: "user",
    entityId: user.id,
    eventType: "privacy_request_created",
    severity: "info",
    message: `Solicitud de privacidad creada: ${requestType}`,
    metadata: { request_type: requestType },
  });

  revalidatePath("/settings/privacy");
}

export async function cancelPrivacyRequest(requestId: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);
  const admin = createAdminClient();

  const { data: req } = await admin
    .from("privacy_requests")
    .select("id, status, requested_by")
    .eq("id", requestId)
    .eq("organization_id", org.id)
    .maybeSingle();

  if (!req) throw new Error("Solicitud no encontrada.");
  if (req.requested_by !== user.id) throw new Error("No puedes cancelar solicitudes de otros usuarios.");
  if (req.status !== "pending") throw new Error("Solo se pueden cancelar solicitudes pendientes.");

  await admin
    .from("privacy_requests")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", requestId);

  revalidatePath("/settings/privacy");
}

// ─── Data export ──────────────────────────────────────────────────────────────

export async function exportOrgDataSecure(): Promise<Record<string, unknown>> {
  const { supabase, user } = await requireUser();
  const org = await getActiveOrganization(supabase, user);
  const admin = createAdminClient();

  const [
    { data: contacts },
    { data: leads },
    { data: conversations },
    { data: messages },
    { data: assistants },
    { data: knowledge },
    { data: quotes },
    { data: invoices },
    { data: credits },
  ] = await Promise.all([
    admin.from("contacts").select("id, name, email, phone, company, created_at").eq("organization_id", org.id),
    admin.from("leads").select("id, name, email, phone, status, source, created_at").eq("organization_id", org.id),
    admin.from("conversations").select("id, channel, status, created_at").eq("organization_id", org.id).limit(10000),
    admin.from("messages").select("id, conversation_id, content, direction, created_at").eq("organization_id", org.id).limit(50000),
    admin.from("assistants").select("id, name, mode, active, created_at").eq("organization_id", org.id),
    admin.from("knowledge_documents").select("id, title, category, source_type, created_at").eq("organization_id", org.id).is("archived_at", null),
    admin.from("quotes").select("id, status, total_amount, currency, created_at").eq("organization_id", org.id),
    admin.from("invoices").select("id, status, amount_due, currency, created_at").eq("organization_id", org.id),
    admin.from("ai_credit_wallets").select("balance, total_purchased, total_consumed, plan_slug").eq("organization_id", org.id).maybeSingle(),
  ]);

  await logEvent(admin, {
    organizationId: org.id,
    source: "system",
    entityType: "user",
    entityId: user.id,
    eventType: "data_export_requested",
    severity: "info",
    message: "Exportacion de datos ejecutada por usuario",
    metadata: {},
  });

  return omitSecrets({
    exported_at:   new Date().toISOString(),
    organization:  { id: org.id, name: org.name, slug: org.slug },
    contacts:      contacts ?? [],
    leads:         leads ?? [],
    conversations: conversations ?? [],
    messages:      messages ?? [],
    assistants:    assistants ?? [],
    knowledge:     knowledge ?? [],
    quotes:        quotes ?? [],
    billing: {
      invoices: invoices ?? [],
      credits:  credits ?? null,
    },
  });
}

// ─── Admin actions ────────────────────────────────────────────────────────────

export async function adminListPrivacyRequests(): Promise<Array<PrivacyRequest & { org_name: string; user_email: string | null }>> {
  const { requireSuperAdmin } = await import("@/lib/admin/auth");
  await requireSuperAdmin();
  const admin = createAdminClient();

  const { data } = await admin
    .from("privacy_requests")
    .select("id, organization_id, requested_by, request_type, status, target_type, target_id, reason, export_url, export_expires_at, completed_at, notes, created_at, organizations(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  return ((data ?? []) as unknown as Array<{
    id: string; organization_id: string; requested_by: string; request_type: string; status: string;
    target_type: string | null; target_id: string | null; reason: string | null; export_url: string | null;
    export_expires_at: string | null; completed_at: string | null; notes: string | null; created_at: string;
    organizations: { name: string } | null;
  }>).map((r) => ({
    ...r,
    org_name:   r.organizations?.name ?? r.organization_id,
    user_email: null,
  }));
}

export async function adminHandlePrivacyRequest(
  requestId: string,
  newStatus: "processing" | "completed" | "rejected",
  notes?: string,
): Promise<void> {
  const { requireSuperAdmin } = await import("@/lib/admin/auth");
  const { user } = await requireSuperAdmin();
  const admin = createAdminClient();

  const { error } = await admin
    .from("privacy_requests")
    .update({
      status:       newStatus,
      handled_by:   user.id,
      notes:        notes?.slice(0, 2000) ?? null,
      completed_at: newStatus === "completed" ? new Date().toISOString() : null,
      updated_at:   new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/privacy");
}
