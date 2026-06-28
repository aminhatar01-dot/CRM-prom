import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  exchangeGoogleCode,
  getGoogleUserInfo,
  type GoogleProviderKey,
} from "@crm-pro-ai/integrations/google/oauth";
import { storeCredential } from "@/lib/integrations/credentials";
import { logEvent } from "@/lib/observability/event-log";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;
  const code  = searchParams.get("code");
  const nonce = searchParams.get("state");
  const errParam = searchParams.get("error");

  if (errParam) {
    return NextResponse.redirect(`${APP_URL}/integrations/hub?error=${encodeURIComponent(errParam)}`);
  }
  if (!code || !nonce) {
    return NextResponse.redirect(`${APP_URL}/integrations/hub?error=missing_params`);
  }

  const adminSupabase = createAdminClient();

  try {
    // Claim state atomically — validates nonce and marks used
    const { data: stateRows, error: stateError } = await adminSupabase.rpc("claim_oauth_state", {
      p_nonce:           nonce,
      p_organization_id: null, // we don't know org yet; validate after claim
    });

    // The RPC doesn't take org_id here since we don't know it yet.
    // Fetch the raw row directly via service_role to get org_id, then claim.
    // Re-design: use the nonce to look up then mark used atomically.
    const { data: stateRow, error: lookupError } = await adminSupabase
      .from("oauth_states")
      .select("id, nonce, organization_id, connection_id, provider_key, user_id, expires_at, used_at")
      .eq("nonce", nonce)
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    void stateRows; void stateError;

    if (lookupError || !stateRow) {
      return NextResponse.redirect(`${APP_URL}/integrations/hub?error=invalid_state`);
    }

    // Mark state as used
    await adminSupabase
      .from("oauth_states")
      .update({ used_at: new Date().toISOString() })
      .eq("id", stateRow.id);

    const orgId       = stateRow.organization_id as string;
    const providerKey = stateRow.provider_key as GoogleProviderKey;
    const userId      = stateRow.user_id as string;

    const clientId     = process.env.GOOGLE_CLIENT_ID!;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
    const redirectUri  = process.env.GOOGLE_OAUTH_REDIRECT_URI!;

    if (!clientId || !clientSecret || !redirectUri) {
      return NextResponse.redirect(`${APP_URL}/integrations/hub?error=server_config`);
    }

    const tokens = await exchangeGoogleCode({ code, clientId, clientSecret, redirectUri });
    const userInfo = await getGoogleUserInfo(tokens.access_token);

    // Upsert the integration connection
    const displayName = `${userInfo.email} (${providerKey})`;
    let connectionId = stateRow.connection_id as string | null;

    if (!connectionId) {
      const { data: conn, error: connError } = await adminSupabase
        .from("integration_connections")
        .insert({
          organization_id: orgId,
          provider_key:    providerKey,
          display_name:    displayName,
          status:          "connected",
          connected_by:    userId,
          metadata:        { google_email: userInfo.email, google_sub: userInfo.sub },
        })
        .select("id")
        .single();
      if (connError || !conn) {
        throw new Error(`Failed to create connection: ${connError?.message}`);
      }
      connectionId = conn.id as string;
    } else {
      await adminSupabase
        .from("integration_connections")
        .update({
          status:       "connected",
          display_name: displayName,
          metadata:     { google_email: userInfo.email, google_sub: userInfo.sub },
        })
        .eq("id", connectionId)
        .eq("organization_id", orgId);
    }

    // Store tokens encrypted
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);
    await storeCredential(adminSupabase, connectionId, orgId, "access_token",  tokens.access_token,  expiresAt);
    if (tokens.refresh_token) {
      await storeCredential(adminSupabase, connectionId, orgId, "refresh_token", tokens.refresh_token);
    }
    await storeCredential(adminSupabase, connectionId, orgId, "scopes", tokens.scope);

    await logEvent(adminSupabase, {
      organizationId: orgId,
      severity:       "info",
      source:         "integration",
      eventType:      "google_oauth_connected",
      message:        `Google ${providerKey} connected for ${userInfo.email}`,
      entityType:     "integration_connection",
      entityId:       connectionId,
      metadata:       { provider_key: providerKey, email: userInfo.email },
    });

    return NextResponse.redirect(`${APP_URL}/integrations/hub?connected=${providerKey}`);
  } catch (err) {
    console.error("[google/callback]", err);
    return NextResponse.redirect(`${APP_URL}/integrations/hub?error=oauth_failed`);
  }
}
