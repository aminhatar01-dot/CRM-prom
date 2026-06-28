import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { buildGoogleAuthUrl, isGoogleProvider, type GoogleProviderKey } from "@crm-pro-ai/integrations/google/oauth";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { supabase, user } = await requireUser();
    const org  = await getActiveOrganization(supabase, user);

    const { searchParams } = req.nextUrl;
    const providerKey   = searchParams.get("provider");
    const connectionId  = searchParams.get("connection_id") ?? undefined;

    if (!providerKey || !isGoogleProvider(providerKey)) {
      return NextResponse.json({ error: "Invalid provider. Must be one of: gmail, google_calendar, google_sheets, google_drive" }, { status: 400 });
    }

    const clientId     = process.env.GOOGLE_CLIENT_ID;
    const redirectUri  = process.env.GOOGLE_OAUTH_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      return NextResponse.json({ error: "Google OAuth not configured on this server." }, { status: 500 });
    }

    const nonce = crypto.randomUUID();
    const adminSupabase = createAdminClient();

    const { error } = await adminSupabase.from("oauth_states").insert({
      nonce,
      organization_id: org.id,
      connection_id:   connectionId ?? null,
      provider_key:    providerKey,
      user_id:         user.id,
    });
    if (error) throw new Error(`Failed to create OAuth state: ${error.message}`);

    const authUrl = buildGoogleAuthUrl({
      clientId,
      redirectUri,
      state:       nonce,
      providerKey: providerKey as GoogleProviderKey,
    });

    return NextResponse.redirect(authUrl);
  } catch (err) {
    console.error("[google/start]", err);
    return NextResponse.json({ error: "OAuth initiation failed." }, { status: 500 });
  }
}
