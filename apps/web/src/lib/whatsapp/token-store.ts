import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { decryptWhatsAppToken } from "./credentials";

export async function getWhatsAppAccessToken({
  organizationId,
  channelSettingId,
  connectionMethod
}: {
  organizationId: string;
  channelSettingId: string;
  connectionMethod: string;
}) {
  const env = getServerEnv();
  if (connectionMethod !== "embedded_signup") return env.WHATSAPP_ACCESS_TOKEN ?? null;
  if (!env.WHATSAPP_TOKEN_ENCRYPTION_KEY) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("whatsapp_channel_credentials")
    .select("access_token_ciphertext")
    .eq("organization_id", organizationId)
    .eq("channel_setting_id", channelSettingId)
    .maybeSingle<{ access_token_ciphertext: string }>();

  if (!data) return null;
  return decryptWhatsAppToken(data.access_token_ciphertext, env.WHATSAPP_TOKEN_ENCRYPTION_KEY);
}
