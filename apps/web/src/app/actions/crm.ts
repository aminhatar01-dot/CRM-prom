"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  contactInputSchema,
  contactUpdateSchema,
  conversationInputSchema,
  conversationUpdateSchema,
  leadInputSchema,
  leadPipelineStatusSchema,
  leadUpdateSchema,
  messageInputSchema,
  messageUpdateSchema,
} from "@crm-pro-ai/database/crm";
import { WhatsAppCloudService } from "@crm-pro-ai/integrations/whatsapp-cloud-service";
import { requireUser } from "@/lib/auth";
import { actionErrorCode, addQueryParam } from "@/lib/action-errors";
import { getServerEnv } from "@/lib/env";
import { getActiveOrganization } from "@/lib/organization";
import { getWhatsAppAccessToken } from "@/lib/whatsapp/token-store";
import { dispatchAutomationEvent } from "@/lib/automation/real-engine";
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
    notes: value(formData, "notes"),
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
    notes: value(formData, "notes"),
  };
}

const whatsappSettingsSchema = z.object({
  phone_number_id: z.string().trim().min(3).max(80),
  business_account_id: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value) => value || null),
  display_phone_number: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((value) => value || null),
  webhook_verify_token_hint: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((value) => value || null),
  enabled: z.boolean().default(false),
});

const archiveSchema = z.object({
  id: z.string().uuid(),
  return_to: z.string().startsWith("/").max(300),
});

const conversationAIControlSchema = z.object({
  id: z.string().uuid(),
  ai_status: z.enum(["active", "paused", "human"]),
  ai_paused: z.boolean().default(false),
  return_to: z.string().startsWith("/").max(300),
});
const conversationAssistantRoutingSchema = z
  .object({
    id: z.string().uuid(),
    mode: z.enum(["auto", "manual"]),
    assistant_id: z
      .string()
      .uuid()
      .or(z.literal(""))
      .transform((item) => item || null),
    return_to: z.string().startsWith("/").max(300),
  })
  .refine((item) => item.mode === "auto" || Boolean(item.assistant_id), {
    message: "Manual routing requires an assistant.",
  });

export async function createLead(formData: FormData) {
  const parsed = leadInputSchema.safeParse(leadPayload(formData));
  if (!parsed.success) redirect("/leads/new?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const fullName = [parsed.data.first_name, parsed.data.last_name]
    .filter(Boolean)
    .join(" ");
  const { data, error } = await supabase
    .from("leads")
    .insert({
      ...parsed.data,
      title: fullName,
      organization_id: organization.id,
    })
    .select("id")
    .single();

  if (error || !data) redirect(`/leads/new?error=${actionErrorCode(error)}`);

  await audit("create_lead", "leads", data.id, organization.id);
  await dispatchAutomationEvent(supabase, {
    organizationId: organization.id,
    trigger: "lead_created",
    eventId: data.id,
    leadId: data.id,
    ownerId: parsed.data.owner_id || null,
    actorUserId: user.id,
  });
  revalidatePath("/leads");
  redirect(`/leads/${data.id}`);
}

export async function updateLead(formData: FormData) {
  const parsed = leadUpdateSchema.safeParse({
    id: value(formData, "id"),
    ...leadPayload(formData),
  });
  if (!parsed.success)
    redirect(`/leads/${value(formData, "id")}/edit?error=invalid`);

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: previous } = await supabase
    .from("leads")
    .select("status")
    .eq("id", parsed.data.id)
    .eq("organization_id", organization.id)
    .maybeSingle<{ status: string }>();
  const fullName = [parsed.data.first_name, parsed.data.last_name]
    .filter(Boolean)
    .join(" ");
  const { id, ...payload } = parsed.data;
  const { data: updated, error } = await supabase
    .from("leads")
    .update({
      ...payload,
      title: fullName,
    })
    .eq("id", id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) redirect(`/leads/${id}/edit?error=${actionErrorCode(error)}`);
  if (!updated) redirect(`/leads/${id}/edit?error=not-found`);

  await audit("update_lead", "leads", id, organization.id);
  if (previous?.status && previous.status !== payload.status) {
    await dispatchAutomationEvent(supabase, {
      organizationId: organization.id,
      trigger: "lead_status_changed",
      eventId: `${id}:${payload.status}`,
      leadId: id,
      ownerId: payload.owner_id || null,
      actorUserId: user.id,
      metadata: {
        previous_status: previous.status,
        lead_status: payload.status,
      },
    });
  }
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  redirect(`/leads/${id}`);
}

export async function updateLeadPipelineStatus(input: {
  id: string;
  status: string;
}): Promise<{ ok: true; updatedAt: string } | { ok: false; error: string }> {
  const parsed = leadPipelineStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Estado o lead invalido." };

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: previous } = await supabase
    .from("leads")
    .select("status, owner_id")
    .eq("id", parsed.data.id)
    .eq("organization_id", organization.id)
    .maybeSingle<{ status: string; owner_id: string | null }>();
  const { data, error } = await supabase
    .from("leads")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .select("id, updated_at")
    .maybeSingle<{ id: string; updated_at: string }>();

  if (error) {
    const code = actionErrorCode(error);
    return {
      ok: false,
      error:
        code === "forbidden"
          ? "No tienes permisos para mover este lead."
          : "No pudimos actualizar el estado. Intenta nuevamente.",
    };
  }
  if (!data)
    return { ok: false, error: "El lead ya no existe o fue archivado." };

  await audit(
    "update_lead_pipeline_status",
    "leads",
    data.id,
    organization.id,
    {
      status: parsed.data.status,
    },
  );
  if (previous?.status && previous.status !== parsed.data.status) {
    await dispatchAutomationEvent(supabase, {
      organizationId: organization.id,
      trigger: "lead_status_changed",
      eventId: `${data.id}:${data.updated_at}`,
      leadId: data.id,
      ownerId: previous.owner_id,
      actorUserId: user.id,
      metadata: {
        previous_status: previous.status,
        lead_status: parsed.data.status,
      },
    });
  }
  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath(`/leads/${data.id}`);

  return { ok: true, updatedAt: data.updated_at };
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
    .is("archived_at", null)
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
      converted_from_lead_id: lead.id,
    })
    .select("id")
    .single();

  if (error || !contact)
    redirect(`/leads/${leadId}?error=${actionErrorCode(error)}`);

  const { error: leadUpdateError } = await supabase
    .from("leads")
    .update({ contact_id: contact.id, status: "ganado" })
    .eq("id", lead.id)
    .eq("organization_id", organization.id);
  if (leadUpdateError)
    redirect(`/leads/${leadId}?error=${actionErrorCode(leadUpdateError)}`);

  await audit("convert_lead_to_contact", "leads", lead.id, organization.id, {
    contact_id: contact.id,
  });
  revalidatePath("/contacts");
  redirect(`/contacts/${contact.id}`);
}

export async function createContact(formData: FormData) {
  const parsed = contactInputSchema.safeParse(contactPayload(formData));
  if (!parsed.success) redirect("/contacts/new?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const fullName = [parsed.data.first_name, parsed.data.last_name]
    .filter(Boolean)
    .join(" ");
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      ...parsed.data,
      full_name: fullName,
      organization_id: organization.id,
    })
    .select("id")
    .single();

  if (error || !data) redirect(`/contacts/new?error=${actionErrorCode(error)}`);

  await audit("create_contact", "contacts", data.id, organization.id);
  revalidatePath("/contacts");
  redirect(`/contacts/${data.id}`);
}

export async function updateContact(formData: FormData) {
  const parsed = contactUpdateSchema.safeParse({
    id: value(formData, "id"),
    ...contactPayload(formData),
  });
  if (!parsed.success)
    redirect(`/contacts/${value(formData, "id")}/edit?error=invalid`);

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { id, ...payload } = parsed.data;
  const fullName = [payload.first_name, payload.last_name]
    .filter(Boolean)
    .join(" ");
  const { data: updated, error } = await supabase
    .from("contacts")
    .update({
      ...payload,
      full_name: fullName,
    })
    .eq("id", id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) redirect(`/contacts/${id}/edit?error=${actionErrorCode(error)}`);
  if (!updated) redirect(`/contacts/${id}/edit?error=not-found`);

  await audit("update_contact", "contacts", id, organization.id);
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
    owner_id: value(formData, "owner_id"),
  });
  const fallback = value(formData, "return_to") || "/inbox";
  if (!parsed.success) redirect(`${fallback}?error=invalid-conversation`);

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      ...parsed.data,
      organization_id: organization.id,
    })
    .select("id")
    .single();

  if (error || !data)
    redirect(addQueryParam(fallback, "error", actionErrorCode(error)));

  await audit("create_conversation", "conversations", data.id, organization.id);
  revalidatePath("/inbox");
  redirect(`/inbox?conversation=${data.id}`);
}

export async function updateConversation(formData: FormData) {
  const parsed = conversationUpdateSchema.safeParse({
    id: value(formData, "id"),
    status: value(formData, "status"),
    ai_status: value(formData, "ai_status"),
    owner_id: value(formData, "owner_id"),
  });
  if (!parsed.success) redirect("/inbox?error=invalid-conversation");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { id, ...payload } = parsed.data;
  const { data: updated, error } = await supabase
    .from("conversations")
    .update(payload)
    .eq("id", id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error)
    redirect(`/inbox?conversation=${id}&error=${actionErrorCode(error)}`);
  if (!updated) redirect("/inbox?error=not-found");

  await audit("update_conversation", "conversations", id, organization.id);
  revalidatePath("/inbox");
  redirect(`/inbox?conversation=${id}`);
}

export async function updateConversationAIControl(formData: FormData) {
  const parsed = conversationAIControlSchema.safeParse({
    id: value(formData, "id"),
    ai_status: value(formData, "ai_status"),
    ai_paused: formData.get("ai_paused") === "true",
    return_to: value(formData, "return_to") || "/inbox",
  });
  if (!parsed.success) redirect("/inbox?error=invalid-ai-mode");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data, error } = await supabase
    .from("conversations")
    .update({
      ai_status: parsed.data.ai_status,
      ai_paused: parsed.data.ai_paused,
    })
    .eq("id", parsed.data.id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error)
    redirect(
      addQueryParam(parsed.data.return_to, "error", actionErrorCode(error)),
    );
  if (!data)
    redirect(addQueryParam(parsed.data.return_to, "error", "not-found"));

  await audit(
    "update_conversation_ai_control",
    "conversations",
    parsed.data.id,
    organization.id,
    {
      ai_status: parsed.data.ai_status,
      ai_paused: parsed.data.ai_paused,
    },
  );
  revalidatePath("/inbox");
  redirect(addQueryParam(parsed.data.return_to, "ai", parsed.data.ai_status));
}

export async function updateConversationAssistantRouting(formData: FormData) {
  const parsed = conversationAssistantRoutingSchema.safeParse({
    id: value(formData, "id"),
    mode: value(formData, "mode"),
    assistant_id: value(formData, "assistant_id"),
    return_to: value(formData, "return_to") || "/inbox",
  });
  if (!parsed.success) redirect("/inbox?error=invalid-assistant-routing");
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  if (parsed.data.assistant_id) {
    const { data: assistant } = await supabase
      .from("ai_assistants")
      .select("id")
      .eq("id", parsed.data.assistant_id)
      .eq("organization_id", organization.id)
      .eq("active", true)
      .is("archived_at", null)
      .maybeSingle();
    if (!assistant)
      redirect(
        addQueryParam(parsed.data.return_to, "error", "invalid-reference"),
      );
  }
  const payload =
    parsed.data.mode === "manual"
      ? {
          assistant_routing_mode: "manual",
          forced_assistant_id: parsed.data.assistant_id,
          current_assistant_id: parsed.data.assistant_id,
          assistant_routing_metadata: {
            reason: "Asignado manualmente",
            actor_user_id: user.id,
            changed_at: new Date().toISOString(),
          },
        }
      : {
          assistant_routing_mode: "auto",
          forced_assistant_id: null,
          assistant_routing_metadata: {
            reason: "Router automatico habilitado",
            actor_user_id: user.id,
            changed_at: new Date().toISOString(),
          },
        };
  const { data, error } = await supabase
    .from("conversations")
    .update(payload)
    .eq("id", parsed.data.id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  if (error)
    redirect(
      addQueryParam(parsed.data.return_to, "error", actionErrorCode(error)),
    );
  if (!data)
    redirect(addQueryParam(parsed.data.return_to, "error", "not-found"));
  await audit(
    "update_conversation_assistant_routing",
    "conversations",
    parsed.data.id,
    organization.id,
    { mode: parsed.data.mode, assistant_id: parsed.data.assistant_id },
  );
  revalidatePath("/inbox");
  redirect(addQueryParam(parsed.data.return_to, "routing", parsed.data.mode));
}

export async function createMessage(formData: FormData) {
  const parsed = messageInputSchema.safeParse({
    conversation_id: value(formData, "conversation_id"),
    body: value(formData, "body"),
    direction: value(formData, "direction"),
    channel: value(formData, "channel"),
    status: value(formData, "status"),
  });
  if (!parsed.success) redirect("/inbox?error=invalid-message");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, organization_id, channel, contacts(phone), leads(phone)")
    .eq("id", parsed.data.conversation_id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .single<{
      id: string;
      organization_id: string;
      channel: string;
      contacts: { phone: string | null } | null;
      leads: { phone: string | null } | null;
    }>();

  if (!conversation) redirect("/inbox?error=missing-conversation");

  const initialStatus =
    conversation.channel === "whatsapp" ? "pending" : parsed.data.status;
  const { data: createdMessage, error } = await supabase
    .from("messages")
    .insert({
      ...parsed.data,
      status: initialStatus,
      organization_id: organization.id,
      sender_type: parsed.data.direction === "outbound" ? "user" : "contact",
      sender_user_id: parsed.data.direction === "outbound" ? user.id : null,
      metadata: {},
    })
    .select("id")
    .single<{ id: string }>();

  if (error || !createdMessage) {
    redirect(
      `/inbox?conversation=${conversation.id}&error=${actionErrorCode(error)}`,
    );
  }

  if (
    conversation.channel === "whatsapp" &&
    parsed.data.direction === "outbound"
  ) {
    await sendWhatsAppMessage({
      body: parsed.data.body,
      conversation,
      messageId: createdMessage.id,
      organizationId: organization.id,
    });
  }

  await audit(
    "create_message",
    "messages",
    createdMessage.id,
    organization.id,
    {
      conversation_id: conversation.id,
      direction: parsed.data.direction,
      channel: conversation.channel,
    },
  );
  revalidatePath("/inbox");
  redirect(`/inbox?conversation=${conversation.id}`);
}

export async function updateMessage(formData: FormData) {
  const parsed = messageUpdateSchema.safeParse({
    id: value(formData, "id"),
    conversation_id: value(formData, "conversation_id"),
    body: value(formData, "body"),
  });
  if (!parsed.success) redirect("/inbox?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data, error } = await supabase
    .from("messages")
    .update({ body: parsed.data.body })
    .eq("id", parsed.data.id)
    .eq("conversation_id", parsed.data.conversation_id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error) {
    redirect(
      `/inbox?conversation=${parsed.data.conversation_id}&error=${actionErrorCode(error)}`,
    );
  }
  if (!data)
    redirect(
      `/inbox?conversation=${parsed.data.conversation_id}&error=not-found`,
    );

  await audit("update_message", "messages", parsed.data.id, organization.id, {
    conversation_id: parsed.data.conversation_id,
  });
  revalidatePath("/inbox");
  redirect(
    `/inbox?conversation=${parsed.data.conversation_id}&success=updated`,
  );
}

export async function saveWhatsAppSettings(formData: FormData) {
  const parsed = whatsappSettingsSchema.safeParse({
    phone_number_id: value(formData, "phone_number_id"),
    business_account_id: value(formData, "business_account_id"),
    display_phone_number: value(formData, "display_phone_number"),
    webhook_verify_token_hint: value(formData, "webhook_verify_token_hint"),
    enabled: formData.get("enabled") === "on",
  });

  if (!parsed.success) redirect("/settings/channels/whatsapp?error=invalid");

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { error } = await supabase.from("whatsapp_channel_settings").upsert(
    {
      ...parsed.data,
      organization_id: organization.id,
    },
    {
      onConflict: "organization_id,phone_number_id",
    },
  );

  if (error) redirect("/settings/channels/whatsapp?error=save");

  revalidatePath("/settings/channels/whatsapp");
  redirect("/settings/channels/whatsapp?saved=1");
}

export async function archiveLead(formData: FormData) {
  return archiveRecord(formData, "leads", "/leads");
}

export async function archiveContact(formData: FormData) {
  return archiveRecord(formData, "contacts", "/contacts");
}

export async function archiveConversation(formData: FormData) {
  return archiveRecord(formData, "conversations", "/inbox");
}

export async function archiveMessage(formData: FormData) {
  return archiveRecord(formData, "messages", "/inbox");
}

async function archiveRecord(
  formData: FormData,
  table: "leads" | "contacts" | "conversations" | "messages",
  defaultReturnTo: string,
) {
  const parsed = archiveSchema.safeParse({
    id: value(formData, "id"),
    return_to: value(formData, "return_to") || defaultReturnTo,
  });
  if (!parsed.success)
    redirect(addQueryParam(defaultReturnTo, "error", "invalid"));

  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const { data, error } = await supabase
    .from(table)
    .update({ archived_at: new Date().toISOString() })
    .eq("id", parsed.data.id)
    .eq("organization_id", organization.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (error)
    redirect(
      addQueryParam(parsed.data.return_to, "error", actionErrorCode(error)),
    );
  if (!data)
    redirect(addQueryParam(parsed.data.return_to, "error", "not-found"));

  await audit(`archive_${table}`, table, parsed.data.id, organization.id);
  revalidatePath(defaultReturnTo);
  redirect(addQueryParam(parsed.data.return_to, "success", "archived"));
}

async function sendWhatsAppMessage({
  body,
  conversation,
  messageId,
  organizationId,
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
    .select("id, phone_number_id, enabled, connection_method")
    .eq("organization_id", organizationId)
    .eq("enabled", true)
    .limit(1)
    .maybeSingle<{
      id: string;
      phone_number_id: string;
      enabled: boolean;
      connection_method: string;
    }>();
  const accessToken = setting
    ? await getWhatsAppAccessToken({
        organizationId,
        channelSettingId: setting.id,
        connectionMethod: setting.connection_method,
      })
    : null;

  if (!recipient || !setting || !accessToken) {
    await supabase
      .from("messages")
      .update({
        status: "failed",
        metadata: {
          error: "WhatsApp is not configured or recipient phone is missing.",
        },
      })
      .eq("id", messageId)
      .eq("organization_id", organizationId);
    return;
  }

  const service = new WhatsAppCloudService({
    accessToken,
    phoneNumberId: setting.phone_number_id,
    graphApiVersion: env.WHATSAPP_GRAPH_API_VERSION,
    appSecret: env.WHATSAPP_APP_SECRET,
  });

  try {
    const response = await service.sendText({ to: recipient, body });
    const externalMessageId = response.messages?.[0]?.id;

    await supabase
      .from("messages")
      .update({
        status: "sent",
        external_message_id: externalMessageId,
        metadata: { whatsapp_response: response },
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
      payload: response,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown WhatsApp error";
    await supabase
      .from("messages")
      .update({
        status: "failed",
        metadata: { error: errorMessage },
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
      error_message: errorMessage,
    });
  }
}

async function audit(
  action: string,
  entityTable: string,
  entityId: string | undefined,
  organizationId: string,
  metadata: Record<string, unknown> = {},
) {
  const { supabase, user } = await requireUser();
  await supabase.from("audit_logs").insert({
    organization_id: organizationId,
    actor_user_id: user.id,
    action,
    entity_table: entityTable,
    entity_id: entityId,
    metadata,
  });
}
