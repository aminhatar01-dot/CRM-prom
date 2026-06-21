import { NextResponse } from "next/server";
import { MetaEmbeddedSignupService } from "@crm-pro-ai/integrations/meta-embedded-signup";
import { isCronAuthorized } from "@/lib/automation/cron";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptWhatsAppToken, encryptWhatsAppToken } from "@/lib/whatsapp/credentials";

type CredentialRow = {
  id: string;
  organization_id: string;
  channel_setting_id: string;
  access_token_ciphertext: string;
  token_expires_at: string | null;
};

export async function GET(request: Request) {
  return maintainTokens(request);
}

export async function POST(request: Request) {
  return maintainTokens(request);
}

async function maintainTokens(request: Request) {
  const env = getServerEnv();
  const authorized = isCronAuthorized({
    authorization: request.headers.get("authorization"),
    headerSecret: request.headers.get("x-cron-secret"),
    cronSecret: env.CRON_SECRET
  });
  if (!authorized) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!env.META_APP_ID || !env.WHATSAPP_APP_SECRET || !env.WHATSAPP_TOKEN_ENCRYPTION_KEY) {
    return NextResponse.json({ error: "Meta Embedded Signup is not configured." }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: credentials } = await admin
    .from("whatsapp_channel_credentials")
    .select("id, organization_id, channel_setting_id, access_token_ciphertext, token_expires_at")
    .returns<CredentialRow[]>();
  const meta = new MetaEmbeddedSignupService({
    appId: env.META_APP_ID,
    appSecret: env.WHATSAPP_APP_SECRET,
    graphApiVersion: env.WHATSAPP_GRAPH_API_VERSION
  });
  const results: Array<{ settingId: string; status: string }> = [];

  for (const credential of credentials ?? []) {
    try {
      let token = decryptWhatsAppToken(
        credential.access_token_ciphertext,
        env.WHATSAPP_TOKEN_ENCRYPTION_KEY,
      );
      let debug = await meta.debugToken(token);
      if (!debug.is_valid) {
        await updateStatus(admin, credential.channel_setting_id, "revoked", null);
        results.push({ settingId: credential.channel_setting_id, status: "revoked" });
        continue;
      }

      const expiresAt = timestampToIso(debug.expires_at) ?? credential.token_expires_at;
      const shouldRefresh = expiresAt
        ? new Date(expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1_000
        : false;
      let status = shouldRefresh ? "expiring" : "active";

      if (shouldRefresh) {
        try {
          const refreshed = await meta.refreshLongLivedToken(token);
          token = refreshed.access_token;
          debug = await meta.debugToken(token);
          const refreshedExpiresAt = timestampToIso(debug.expires_at) ?? secondsFromNow(refreshed.expires_in);
          await admin
            .from("whatsapp_channel_credentials")
            .update({
              access_token_ciphertext: encryptWhatsAppToken(token, env.WHATSAPP_TOKEN_ENCRYPTION_KEY),
              token_expires_at: refreshedExpiresAt,
              last_refreshed_at: new Date().toISOString(),
              last_validated_at: new Date().toISOString(),
              scopes: debug.scopes ?? []
            })
            .eq("id", credential.id);
          await updateStatus(admin, credential.channel_setting_id, "active", refreshedExpiresAt);
          status = "refreshed";
        } catch {
          await updateStatus(admin, credential.channel_setting_id, "refresh_failed", expiresAt);
          status = "reconnect_required";
        }
      } else {
        await admin
          .from("whatsapp_channel_credentials")
          .update({ last_validated_at: new Date().toISOString(), token_expires_at: expiresAt })
          .eq("id", credential.id);
        await updateStatus(admin, credential.channel_setting_id, "active", expiresAt);
      }

      results.push({ settingId: credential.channel_setting_id, status });
    } catch {
      await updateStatus(admin, credential.channel_setting_id, "refresh_failed", credential.token_expires_at);
      results.push({ settingId: credential.channel_setting_id, status: "error" });
    }
  }

  return NextResponse.json({ processed: results.length, results });
}

async function updateStatus(
  admin: ReturnType<typeof createAdminClient>,
  settingId: string,
  status: string,
  expiresAt: string | null,
) {
  await admin
    .from("whatsapp_channel_settings")
    .update({
      token_status: status,
      token_expires_at: expiresAt,
      token_last_validated_at: new Date().toISOString()
    })
    .eq("id", settingId);
}

function timestampToIso(value?: number) {
  return value && value > 0 ? new Date(value * 1_000).toISOString() : null;
}

function secondsFromNow(value?: number) {
  return value && value > 0 ? new Date(Date.now() + value * 1_000).toISOString() : null;
}
