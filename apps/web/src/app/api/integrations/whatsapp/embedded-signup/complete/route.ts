import { NextResponse } from "next/server";
import { z } from "zod";
import { MetaEmbeddedSignupService } from "@crm-pro-ai/integrations/meta-embedded-signup";
import { requireUser } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { getActiveOrganization } from "@/lib/organization";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptWhatsAppToken, verifyEmbeddedSignupState } from "@/lib/whatsapp/credentials";

const requestSchema = z.object({
  code: z.string().min(10).max(2_000),
  wabaId: z.string().min(3).max(100),
  phoneNumberId: z.string().min(3).max(100).optional(),
  state: z.string().min(20).max(4_000)
});

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
  }

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Solicitud invalida." }, { status: 400 });

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  if (!["owner", "admin"].includes(organization.role)) {
    return NextResponse.json({ error: "No tienes permisos para conectar canales." }, { status: 403 });
  }

  const env = getServerEnv();
  if (
    !env.META_APP_ID ||
    !env.WHATSAPP_APP_SECRET ||
    !env.META_WHATSAPP_CONFIGURATION_ID ||
    !env.WHATSAPP_TOKEN_ENCRYPTION_KEY
  ) {
    return NextResponse.json({ error: "Embedded Signup no esta configurado en el servidor." }, { status: 503 });
  }
  if (
    !verifyEmbeddedSignupState({
      state: parsed.data.state,
      organizationId: organization.id,
      userId: user.id,
      appSecret: env.WHATSAPP_APP_SECRET
    })
  ) {
    return NextResponse.json({ error: "La sesion de conexion vencio. Recarga la pagina." }, { status: 403 });
  }

  const meta = new MetaEmbeddedSignupService({
    appId: env.META_APP_ID,
    appSecret: env.WHATSAPP_APP_SECRET,
    graphApiVersion: env.WHATSAPP_GRAPH_API_VERSION
  });

  try {
    const exchanged = await meta.exchangeCode(parsed.data.code);
    const debug = await meta.debugToken(exchanged.access_token);
    if (!debug.is_valid || (debug.app_id && debug.app_id !== env.META_APP_ID)) {
      return NextResponse.json({ error: "Meta devolvio un token invalido para esta aplicacion." }, { status: 400 });
    }

    const phoneNumbers = await meta.getPhoneNumbers(parsed.data.wabaId, exchanged.access_token);
    const phone =
      phoneNumbers.find((item) => item.id === parsed.data.phoneNumberId) ??
      (!parsed.data.phoneNumberId && phoneNumbers.length === 1 ? phoneNumbers[0] : undefined);
    if (!phone) {
      return NextResponse.json({ error: "El numero seleccionado no pertenece a la cuenta autorizada." }, { status: 400 });
    }

    const subscription = await meta.subscribeApp(parsed.data.wabaId, exchanged.access_token);
    if (!subscription.success) {
      return NextResponse.json({ error: "No pudimos suscribir la cuenta al webhook." }, { status: 502 });
    }

    const expiresAt = timestampToIso(debug.expires_at) ?? secondsFromNow(exchanged.expires_in);
    const admin = createAdminClient();
    const { data: setting, error: settingError } = await admin
      .from("whatsapp_channel_settings")
      .upsert(
        {
          organization_id: organization.id,
          phone_number_id: phone.id,
          business_account_id: parsed.data.wabaId,
          display_phone_number: phone.display_phone_number,
          verified_name: phone.verified_name,
          quality_rating: phone.quality_rating,
          enabled: true,
          connection_method: "embedded_signup",
          token_status: "active",
          token_expires_at: expiresAt,
          token_last_validated_at: new Date().toISOString(),
          connected_by: user.id,
          connected_at: new Date().toISOString()
        },
        { onConflict: "organization_id,phone_number_id" },
      )
      .select("id")
      .single<{ id: string }>();
    if (settingError || !setting) throw new Error("No pudimos guardar la configuracion del canal.");

    const { error: credentialError } = await admin.from("whatsapp_channel_credentials").upsert(
      {
        organization_id: organization.id,
        channel_setting_id: setting.id,
        access_token_ciphertext: encryptWhatsAppToken(
          exchanged.access_token,
          env.WHATSAPP_TOKEN_ENCRYPTION_KEY,
        ),
        token_type: debug.type ?? exchanged.token_type ?? "business",
        scopes: debug.scopes ?? [],
        token_expires_at: expiresAt,
        last_refreshed_at: new Date().toISOString(),
        last_validated_at: new Date().toISOString()
      },
      { onConflict: "channel_setting_id" },
    );
    if (credentialError) {
      await admin
        .from("whatsapp_channel_settings")
        .update({ enabled: false, token_status: "missing" })
        .eq("id", setting.id);
      throw new Error("No pudimos guardar las credenciales cifradas.");
    }

    await admin.from("audit_logs").insert({
      organization_id: organization.id,
      actor_user_id: user.id,
      action: "connect_whatsapp_embedded_signup",
      entity_table: "whatsapp_channel_settings",
      entity_id: setting.id,
      metadata: {
        waba_id: parsed.data.wabaId,
        phone_number_id: phone.id,
        token_expires_at: expiresAt
      }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Meta no pudo completar la conexion." },
      { status: 502 },
    );
  }
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return origin === new URL(request.url).origin;
}

function timestampToIso(value?: number) {
  return value && value > 0 ? new Date(value * 1_000).toISOString() : null;
}

function secondsFromNow(value?: number) {
  return value && value > 0 ? new Date(Date.now() + value * 1_000).toISOString() : null;
}
