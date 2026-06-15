import { NextResponse } from "next/server";
import { WhatsAppCloudService } from "@crm-pro-ai/integrations/whatsapp-cloud-service";
import { getServerEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  messageBody,
  whatsappWebhookPayloadSchema,
  type WhatsAppWebhookMessage
} from "@/lib/whatsapp/payload";

type WhatsAppSetting = {
  organization_id: string;
  phone_number_id: string;
  display_phone_number: string | null;
  enabled: boolean;
};

export async function GET(request: Request) {
  const env = getServerEnv();
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && token === env.WHATSAPP_VERIFY_TOKEN && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request) {
  const env = getServerEnv();
  const rawBody = await request.text();
  const service = new WhatsAppCloudService({
    accessToken: env.WHATSAPP_ACCESS_TOKEN ?? "not-used-for-webhook",
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID ?? "not-used-for-webhook",
    graphApiVersion: env.WHATSAPP_GRAPH_API_VERSION,
    appSecret: env.WHATSAPP_APP_SECRET
  });

  if (!service.verifySignature(rawBody, request.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let jsonPayload: unknown;
  try {
    jsonPayload = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = whatsappWebhookPayloadSchema.safeParse(jsonPayload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const supabase = createAdminClient();

  for (const entry of parsed.data.entry) {
    for (const change of entry.changes) {
      const phoneNumberId = change.value.metadata?.phone_number_id;
      if (!phoneNumberId) continue;

      const { data: setting } = await supabase
        .from("whatsapp_channel_settings")
        .select("organization_id, phone_number_id, display_phone_number, enabled")
        .eq("phone_number_id", phoneNumberId)
        .eq("enabled", true)
        .maybeSingle<WhatsAppSetting>();

      if (!setting) continue;

      for (const status of change.value.statuses ?? []) {
        await persistStatus(supabase, setting, status, change.value);
      }

      for (const message of change.value.messages ?? []) {
        const contact = change.value.contacts?.find((item) => item.wa_id === message.from);
        await persistInboundMessage(supabase, setting, message, contact?.profile?.name, change.value);
      }
    }
  }

  return NextResponse.json({ ok: true });
}

async function persistInboundMessage(
  supabase: ReturnType<typeof createAdminClient>,
  setting: WhatsAppSetting,
  message: WhatsAppWebhookMessage,
  profileName: string | undefined,
  payload: unknown,
) {
  const fullName = profileName || message.from;
  const [firstName, ...rest] = fullName.split(" ");
  const lastName = rest.join(" ") || null;
  const body = messageBody(message);
  const media = message.type === "image" ? message.image : message.type === "audio" ? message.audio : message.type === "document" ? message.document : undefined;

  const { data: existingContact } = await supabase
    .from("contacts")
    .select("id")
    .eq("organization_id", setting.organization_id)
    .eq("phone", message.from)
    .maybeSingle<{ id: string }>();

  const contactId =
    existingContact?.id ??
    (
      await supabase
        .from("contacts")
        .insert({
          organization_id: setting.organization_id,
          first_name: firstName,
          last_name: lastName,
          full_name: fullName,
          phone: message.from
        })
        .select("id")
        .single<{ id: string }>()
    ).data?.id;

  if (!contactId) return;

  const { data: existingConversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("organization_id", setting.organization_id)
    .eq("channel", "whatsapp")
    .eq("external_contact_id", message.from)
    .neq("status", "cerrada")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  const conversationId =
    existingConversation?.id ??
    (
      await supabase
        .from("conversations")
        .insert({
          organization_id: setting.organization_id,
          contact_id: contactId,
          channel: "whatsapp",
          status: "abierta",
          ai_status: "human",
          external_contact_id: message.from
        })
        .select("id")
        .single<{ id: string }>()
    ).data?.id;

  if (!conversationId) return;

  const { data: createdMessage } = await supabase
    .from("messages")
    .insert({
      organization_id: setting.organization_id,
      conversation_id: conversationId,
      direction: "inbound",
      sender_type: "contact",
      body,
      channel: "whatsapp",
      status: "delivered",
      external_message_id: message.id,
      media_id: media?.id,
      media_mime_type: media?.mime_type,
      media_filename: media?.filename,
      location_latitude: message.location?.latitude,
      location_longitude: message.location?.longitude,
      metadata: {
        whatsapp_type: message.type,
        raw: message
      }
    })
    .select("id")
    .single<{ id: string }>();

  await supabase.from("whatsapp_events").insert({
    organization_id: setting.organization_id,
    direction: "inbound",
    event_type: message.type,
    whatsapp_message_id: message.id,
    conversation_id: conversationId,
    message_id: createdMessage?.id,
    phone_number_id: setting.phone_number_id,
    contact_wa_id: message.from,
    payload: payload as Record<string, unknown>
  });
}

async function persistStatus(
  supabase: ReturnType<typeof createAdminClient>,
  setting: WhatsAppSetting,
  status: {
    id: string;
    status: "sent" | "delivered" | "read" | "failed";
    recipient_id?: string;
    errors?: unknown[];
  },
  payload: unknown,
) {
  const { data: message } = await supabase
    .from("messages")
    .update({ status: status.status })
    .eq("organization_id", setting.organization_id)
    .eq("external_message_id", status.id)
    .select("id, conversation_id")
    .maybeSingle<{ id: string; conversation_id: string }>();

  await supabase.from("whatsapp_events").insert({
    organization_id: setting.organization_id,
    direction: status.status === "failed" ? "error" : "status",
    event_type: status.status,
    whatsapp_message_id: status.id,
    conversation_id: message?.conversation_id,
    message_id: message?.id,
    phone_number_id: setting.phone_number_id,
    contact_wa_id: status.recipient_id,
    payload: payload as Record<string, unknown>,
    error_message: status.errors?.length ? JSON.stringify(status.errors) : null
  });
}
