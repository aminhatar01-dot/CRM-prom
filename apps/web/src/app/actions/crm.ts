"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  contactInputSchema,
  contactUpdateSchema,
  conversationInputSchema,
  conversationUpdateSchema,
  leadInputSchema,
  leadUpdateSchema,
  messageInputSchema
} from "@crm-pro-ai/database/crm";
import { WhatsAppCloudService } from "@crm-pro-ai/integrations/whatsapp-cloud-service";
import { requireUser } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { getActiveOrganization } from "@/lib/organization";
import { z } from "zod";

function value(formData: FormData, key: string) {
  const formValue = formData.get(key);
  return typeof formValue === "string" ? formValue : "";
}

function leadPayload(formData: FormData) {
  return {
    first_name: value(formData, "first_name"),
    last_name: value(formData, "last_name"),
    email: value(formData, "email"),
    phone: value(formData, "phone"),
    company: value(formData, "company"),
    source: value(formData, "source"),
    status: value(formData, "status"),
    owner_id: value(formData, "owner_id"),
    notes: value(formData, "notes")
  };
}

function contactPayload(formData: FormData) {
  return {
    first_name: value(formData, "first_name"),
    last_name: value(formData, "last_name"),
    email: value(formData, "email"),
    phone: value(formData, "phone"),
    company: value(formData, "company"),
    location: value(formData, "location"),
    owner_id: value(formData, "owner_id"),
    notes: value(formData, "notes")
  };
}

const whatsappSettingsSchema = z.object({
  phone_number_id: z.string().trim().min(3).max(80),
  business_account_id: z.string().trim().max(80).optional().transform((value) => value || null),
  display_phone_number: z.string().trim().max(40).optional().transform((value) => value || null),
  webhook_verify_token_hint: z.string().trim().max(120).optional().transform((value) => value || null),
  enabled: z.boolean().default(false)
});

export async function createLead(formData: FormData) {
  const parsed = leadInputSchema.safeParse(leadPayload(formData));
  if (!parsed.success) redirect("/leads/new?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const fullName = [parsed.data.first_name, parsed.data.last_name].filter(Boolean).join(" ");
  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...parsed.data,
      title: fullName,
      organization_id: organization.id
    })
    .select("id")
    .single();

  if (error || !data) redirect("/leads/new?error=create");

  revalidatePath("/leads");
  redirect(`/leads/${data.id}`);
}

export async function updateLead(formData: FormData) {
  const parsed = leadUpdateSchema.safeParse({
    id: value(formData, "id"),
    ...leadPayload(formData)
  });
  if (!parsed.success) redirect(`/leads/${value(formData, "id")}/edit?error=invalid`);

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const fullName = [parsed.data.first_name, parsed.data.last_name].filter(Boolean).join(" ");
  const { id, ...payload } = parsed.data;
  const { error } = await supabase
    .from("leads")
    .update({
      ...payload,
      title: fullName
    })
    .eq("id", id)
    .eq("organization_id", organization.id);

  if (error) redirect(`/leads/${id}/edit?error=update`);

  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  redirect(`/leads/${id}`);
}

export async function convertLeadToContact(formData: FormData) {
  const leadId = value(formData, "lead_id");
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: lead } = await supabase
    .from("leads")
    .select("id, first_name, last_name, email, phone, company, owner_id, notes")
    .eq("id", leadId)
    .eq("organization_id", organization.id)
    .single();

  if (!lead) redirect(`/leads/${leadId}?error=missing-lead`);

  const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(" ");
  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      organization_id: organization.id,
      first_name: lead.first_name,
      last_name: lead.last_name,
      full_name: fullName,
      email: lead.email,
      phone: lead.phone,
      company: lead.company,
      owner_id: lead.owner_id,
      notes: lead.notes,
      converted_from_lead_id: lead.id
    })
    .select("id")
    .single();

  if (error || !contact) redirect(`/leads/${leadId}?error=convert`);

  await supabase
    .from("leads")
    .update({ contact_id: contact.id, status: "ganado" })
    .eq("id", lead.id)
    .eq("organization_id", organization.id);

  revalidatePath("/contacts");
  redirect(`/contacts/${contact.id}`);
}

export async function createContact(formData: FormData) {
  const parsed = contactInputSchema.safeParse(contactPayload(formData));
  if (!parsed.success) redirect("/contacts/new?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const fullName = [parsed.data.first_name, parsed.data.last_name].filter(Boolean).join(" ");
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      ...parsed.data,
      full_name: fullName,
      organization_id: organization.id
    })
    .select("id")
    .single();

  if (error || !data) redirect("/contacts/new?error=create");

  revalidatePath("/contacts");
  redirect(`/contacts/${data.id}`);
}

export async function updateContact(formData: FormData) {
  const parsed = contactUpdateSchema.safeParse({
    id: value(formData, "id"),
    ...contactPayload(formData)
  });
  if (!parsed.success) redirect(`/contacts/${value(formData, "id")}/edit?error=invalid`);

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { id, ...payload } = parsed.data;
  const fullName = [payload.first_name, payload.last_name].filter(Boolean).join(" ");
  const { error } = await supabase
    .from("contacts")
    .update({
      ...payload,
      full_name: fullName
    })
    .eq("id", id)
    .eq("organization_id", organization.id);

  if (error) redirect(`/contacts/${id}/edit?error=update`);

  revalidatePath("/contacts");
  revalidatePath(`/contacts/${id}`);
  redirect(`/contacts/${id}`);
}

export async function createConversation(formData: FormData) {
  const parsed = conversationInputSchema.safeParse({
    lead_id: value(formData, "lead_id"),
    contact_id: value(formData, "contact_id"),
    channel: value(formData, "channel"),
    status: value(formData, "status"),
    ai_status: value(formData, "ai_status"),
    owner_id: value(formData, "owner_id")
  });
  const fallback = value(formData, "return_to") || "/inbox";
  if (!parsed.success) redirect(`${fallback}?error=invalid-conversation`);

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      ...parsed.data,
      organization_id: organization.id
    })
    .select("id")
    .single();

  if (error || !data) redirect(`${fallback}?error=create-conversation`);

  revalidatePath("/inbox");
  redirect(`/inbox?conversation=${data.id}`);
}

export async function updateConversation(formData: FormData) {
  const parsed = conversationUpdateSchema.safeParse({
    id: value(formData, "id"),
    status: value(formData, "status"),
    ai_status: value(formData, "ai_status"),
    owner_id: value(formData, "owner_id")
  });
  if (!parsed.success) redirect("/inbox?error=invalid-conversation");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { id, ...payload } = parsed.data;
  const { error } = await supabase
    .from("conversations")
    .update(payload)
    .eq("id", id)
    .eq("organization_id", organization.id);

  if (error) redirect(`/inbox?conversation=${id}&error=update-conversation`);

  revalidatePath("/inbox");
  redirect(`/inbox?conversation=${id}`);
}

export async function createMessage(formData: FormData) {
  const parsed = messageInputSchema.safeParse({
    conversation_id: value(formData, "conversation_id"),
    body: value(formData, "body"),
    direction: value(formData, "direction"),
    channel: value(formData, "channel"),
    status: value(formData, "status")
  });
  if (!parsed.success) redirect("/inbox?error=invalid-message");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, organization_id, channel, contacts(phone), leads(phone)")
    .eq("id", parsed.data.conversation_id)
    .eq("organization_id", organization.id)
    .single<{
      id: string;
      organization_id: string;
      channel: string;
      contacts: { phone: string | null } | null;
      leads: { phone: string | null } | null;
    }>();

  if (!conversation) redirect("/inbox?error=missing-conversation");

  const initialStatus = conversation.channel === "whatsapp" ? "pending" : parsed.data.status;
  const { data: createdMessage, error } = await supabase
    .from("messages")
    .insert({
      ...parsed.data,
      status: initialStatus,
      organization_id: organization.id,
      sender_type: parsed.data.direction === "outbound" ? "user" : "contact",
      sender_user_id: parsed.data.direction === "outbound" ? user.id : null,
      metadata: {}
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !createdMessage) redirect(`/inbox?conversation=${conversation.id}&error=create-message`);

  if (conversation.channel === "whatsapp" && parsed.data.direction === "outbound") {
    await sendWhatsAppMessage({
      body: parsed.data.body,
      conversation,
      messageId: createdMessage.id,
      organizationId: organization.id
    });
  }

  revalidatePath("/inbox");
  redirect(`/inbox?conversation=${conversation.id}`);
}

export async function saveWhatsAppSettings(formData: FormData) {
  const parsed = whatsappSettingsSchema.safeParse({
    phone_number_id: value(formData, "phone_number_id"),
    business_account_id: value(formData, "business_account_id"),
    display_phone_number: value(formData, "display_phone_number"),
    webhook_verify_token_hint: value(formData, "webhook_verify_token_hint"),
    enabled: formData.get("enabled") === "on"
  });

  if (!parsed.success) redirect("/settings/channels/whatsapp?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { error } = await supabase.from("whatsapp_channel_settings").upsert(
    {
      ...parsed.data,
      organization_id: organization.id
    },
    {
      onConflict: "organization_id,phone_number_id"
    },
  );

  if (error) redirect("/settings/channels/whatsapp?error=save");

  revalidatePath("/settings/channels/whatsapp");
  redirect("/settings/channels/whatsapp?saved=1");
}

async function sendWhatsAppMessage({
  body,
  conversation,
  messageId,
  organizationId
}: {
  body: string;
  conversation: {
    id: string;
    contacts: { phone: string | null } | null;
    leads: { phone: string | null } | null;
  };
  messageId: string;
  organizationId: string;
}) {
  const { supabase } = await requireUser();
  const env = getServerEnv();
  const recipient = conversation.contacts?.phone ?? conversation.leads?.phone;
  const { data: setting } = await supabase
    .from("whatsapp_channel_settings")
    .select("phone_number_id, enabled")
    .eq("organization_id", organizationId)
    .eq("enabled", true)
    .limit(1)
    .maybeSingle<{ phone_number_id: string; enabled: boolean }>();

  if (!recipient || !setting || !env.WHATSAPP_ACCESS_TOKEN) {
    await supabase
      .from("messages")
      .update({
        status: "failed",
        metadata: { error: "WhatsApp is not configured or recipient phone is missing." }
      })
      .eq("id", messageId)
      .eq("organization_id", organizationId);
    return;
  }

  const service = new WhatsAppCloudService({
    accessToken: env.WHATSAPP_ACCESS_TOKEN,
    phoneNumberId: setting.phone_number_id,
    graphApiVersion: env.WHATSAPP_GRAPH_API_VERSION,
    appSecret: env.WHATSAPP_APP_SECRET
  });

  try {
    const response = await service.sendText({ to: recipient, body });
    const externalMessageId = response.messages?.[0]?.id;

    await supabase
      .from("messages")
      .update({
        status: "sent",
        external_message_id: externalMessageId,
        metadata: { whatsapp_response: response }
      })
      .eq("id", messageId)
      .eq("organization_id", organizationId);

    await supabase.from("whatsapp_events").insert({
      organization_id: organizationId,
      direction: "outbound",
      event_type: "text",
      whatsapp_message_id: externalMessageId,
      conversation_id: conversation.id,
      message_id: messageId,
      phone_number_id: setting.phone_number_id,
      contact_wa_id: recipient,
      payload: response
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown WhatsApp error";
    await supabase
      .from("messages")
      .update({
        status: "failed",
        metadata: { error: errorMessage }
      })
      .eq("id", messageId)
      .eq("organization_id", organizationId);

    await supabase.from("whatsapp_events").insert({
      organization_id: organizationId,
      direction: "error",
      event_type: "send_failed",
      conversation_id: conversation.id,
      message_id: messageId,
      phone_number_id: setting.phone_number_id,
      contact_wa_id: recipient,
      payload: {},
      error_message: errorMessage
    });
  }
}
