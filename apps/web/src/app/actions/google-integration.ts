"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { roleCapabilities } from "@/lib/permissions/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteConnectionCredentials, getDecryptedCredential, storeCredential } from "@/lib/integrations/credentials";
import { refreshGoogleToken, revokeGoogleToken } from "@crm-pro-ai/integrations/google/oauth";
import { logEvent } from "@/lib/observability/event-log";

async function assertAdmin() {
  const { supabase, user } = await requireUser();
  const org  = await getActiveOrganization(supabase, user);
  const caps = roleCapabilities(org.role);
  if (!caps.manageSettings) {
    throw new Error("Admin access required");
  }
  return { user, org };
}

export async function disconnectGoogleIntegration(formData: FormData) {
  const { org } = await assertAdmin();
  const connectionId = formData.get("connection_id") as string;
  if (!connectionId) throw new Error("connection_id required");

  const adminSupabase = createAdminClient();

  // Best-effort token revocation
  try {
    const token = await getDecryptedCredential(adminSupabase, connectionId, org.id, "access_token");
    if (token) await revokeGoogleToken(token);
  } catch { /* ignore */ }

  await deleteConnectionCredentials(adminSupabase, connectionId, org.id);

  await adminSupabase
    .from("integration_connections")
    .update({ status: "disconnected" })
    .eq("id", connectionId)
    .eq("organization_id", org.id);

  await logEvent(adminSupabase, {
    organizationId: org.id,
    severity:       "info",
    source:         "integration",
    eventType:      "google_integration_disconnected",
    message:        "Google integration disconnected",
    entityType:     "integration_connection",
    entityId:       connectionId,
  });

  revalidatePath("/integrations/hub");
  return { success: true };
}

export async function testGoogleIntegration(formData: FormData) {
  const { org } = await assertAdmin();
  const connectionId = formData.get("connection_id") as string;
  if (!connectionId) throw new Error("connection_id required");

  const adminSupabase = createAdminClient();
  const token = await getDecryptedCredential(adminSupabase, connectionId, org.id, "access_token");
  if (!token) return { success: false, error: "No access token found. Please reconnect this integration." };

  // Test by fetching userinfo
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    return { success: false, error: "Token expired. Use refresh to get a new token." };
  }
  if (!res.ok) {
    return { success: false, error: `Google API error: ${res.status}` };
  }

  const info = await res.json() as { email?: string };
  return { success: true, email: info.email };
}

export async function refreshGoogleIntegration(formData: FormData) {
  const { org } = await assertAdmin();
  const connectionId = formData.get("connection_id") as string;
  if (!connectionId) throw new Error("connection_id required");

  const adminSupabase = createAdminClient();

  const refreshToken = await getDecryptedCredential(adminSupabase, connectionId, org.id, "refresh_token");
  if (!refreshToken) return { success: false, error: "No refresh token available. Please reconnect this integration." };

  const clientId     = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return { success: false, error: "Google OAuth not configured." };

  const { access_token, expires_in } = await refreshGoogleToken({ refreshToken, clientId, clientSecret });

  const expiresAt = new Date(Date.now() + expires_in * 1000);
  await storeCredential(adminSupabase, connectionId, org.id, "access_token", access_token, expiresAt);

  await adminSupabase
    .from("integration_connections")
    .update({ status: "connected" })
    .eq("id", connectionId)
    .eq("organization_id", org.id);

  await logEvent(adminSupabase, {
    organizationId: org.id,
    severity:       "info",
    source:         "integration",
    eventType:      "google_token_refreshed",
    message:        "Google access token refreshed",
    entityType:     "integration_connection",
    entityId:       connectionId,
  });

  revalidatePath("/integrations/hub");
  return { success: true };
}

export async function getGoogleConnections() {
  const { supabase, user } = await requireUser();
  const org  = await getActiveOrganization(supabase, user);
  const adminSupabase = createAdminClient();

  const { data, error } = await adminSupabase
    .from("integration_connections")
    .select("id, provider_key, display_name, status, metadata, created_at")
    .eq("organization_id", org.id)
    .in("provider_key", ["gmail", "google_calendar", "google_sheets", "google_drive"])
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}
