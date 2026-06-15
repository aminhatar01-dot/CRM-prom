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
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";

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
    .select("id, organization_id")
    .eq("id", parsed.data.conversation_id)
    .eq("organization_id", organization.id)
    .single();

  if (!conversation) redirect("/inbox?error=missing-conversation");

  const { error } = await supabase.from("messages").insert({
    ...parsed.data,
    organization_id: organization.id,
    sender_type: parsed.data.direction === "outbound" ? "user" : "contact",
    sender_user_id: parsed.data.direction === "outbound" ? user.id : null,
    metadata: {}
  });

  if (error) redirect(`/inbox?conversation=${conversation.id}&error=create-message`);

  revalidatePath("/inbox");
  redirect(`/inbox?conversation=${conversation.id}`);
}
