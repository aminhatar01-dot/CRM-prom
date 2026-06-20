import type { WebchatMessageInput, WebchatStartInput } from "@crm-pro-ai/integrations/webchat";
import { canUseWidgetFromOrigin } from "./security";

export type SupabaseWebchatClient = {
  from: (table: string) => WebchatQueryBuilder;
};

type WebchatQueryBuilder = {
  select: (columns?: string) => WebchatQueryBuilder;
  insert: (payload: unknown) => WebchatQueryBuilder;
  update: (payload: unknown) => WebchatQueryBuilder;
  eq: (column: string, value: unknown) => WebchatQueryBuilder;
  is: (column: string, value: unknown) => WebchatQueryBuilder;
  neq: (column: string, value: unknown) => WebchatQueryBuilder;
  or: (filter: string) => WebchatQueryBuilder;
  order: (column: string, options?: unknown) => WebchatQueryBuilder;
  limit: (count: number) => WebchatQueryBuilder;
  maybeSingle: <T = unknown>() => Promise<{ data: T | null; error: Error | null }>;
  single: <T = unknown>() => Promise<{ data: T | null; error: Error | null }>;
  returns: <T = unknown>() => Promise<{ data: T | null; error: Error | null }>;
};

export type WebchatWidgetRow = {
  id: string;
  organization_id: string;
  name: string;
  public_token: string;
  primary_color: string;
  initial_message: string;
  position: "bottom-right" | "bottom-left";
  active: boolean;
  allowed_domains: string[];
  assistant_id: string | null;
};

export type WebchatHistoryMessage = {
  id: string;
  body: string;
  direction: "inbound" | "outbound";
  status: string;
  created_at: string;
};

export async function loadWidgetForPublicRequest(
  supabase: SupabaseWebchatClient,
  token: string,
  origin: string | null,
) {
  const { data: widget } = await supabase
    .from("webchat_widgets")
    .select("id, organization_id, name, public_token, primary_color, initial_message, position, active, allowed_domains, assistant_id")
    .eq("public_token", token)
    .eq("active", true)
    .maybeSingle<WebchatWidgetRow>();

  if (!widget) return { ok: false as const, reason: "invalid_token" as const };

  if (!canUseWidgetFromOrigin({ origin, allowedDomains: widget.allowed_domains })) {
    return { ok: false as const, reason: "domain_not_allowed" as const };
  }

  return { ok: true as const, widget };
}

export async function startWebchatConversation({
  supabase,
  widget,
  input,
  origin
}: {
  supabase: SupabaseWebchatClient;
  widget: WebchatWidgetRow;
  input: WebchatStartInput;
  origin: string | null;
}) {
  const visitorId = input.visitor_id || crypto.randomUUID();
  const fullName = input.name || "Visitante WebChat";
  const [firstName, ...rest] = fullName.split(" ");
  const lastName = rest.join(" ") || null;
  const person = await upsertWebchatPerson({
    supabase,
    organizationId: widget.organization_id,
    firstName,
    lastName,
    email: input.email,
    phone: input.phone || null,
    origin
  });

  const { data: existingConversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("organization_id", widget.organization_id)
    .eq("channel", "webchat")
    .eq("webchat_widget_id", widget.id)
    .eq("external_contact_id", visitorId)
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
          organization_id: widget.organization_id,
          lead_id: person.leadId,
          contact_id: person.contactId,
          channel: "webchat",
          status: "abierta",
          ai_status: "human",
          external_contact_id: visitorId,
          webchat_widget_id: widget.id,
          metadata: {
            widget_token: widget.public_token,
            page_url: input.page_url,
            origin
          }
        })
        .select("id")
        .single<{ id: string }>()
    ).data?.id;

  if (!conversationId) throw new Error("Unable to create webchat conversation");

  const history = await loadWebchatHistory(supabase, widget, conversationId);
  if (history.length === 0 && widget.initial_message) {
    await supabase
      .from("messages")
      .insert({
        organization_id: widget.organization_id,
        conversation_id: conversationId,
        direction: "outbound",
        sender_type: "system",
        body: widget.initial_message,
        channel: "webchat",
        status: "sent",
        metadata: { source: "webchat_widget_initial_message" }
      })
      .select("id")
      .single<{ id: string }>();
  }

  return {
    conversation_id: conversationId,
    visitor_id: visitorId,
    widget: publicWidget(widget),
    messages: await loadWebchatHistory(supabase, widget, conversationId)
  };
}

export async function appendWebchatMessage({
  supabase,
  widget,
  input
}: {
  supabase: SupabaseWebchatClient;
  widget: WebchatWidgetRow;
  input: WebchatMessageInput;
}) {
  const conversation = await loadWidgetConversation(supabase, widget, input.conversation_id);
  if (!conversation) throw new Error("Conversation not found");

  const { data } = await supabase
    .from("messages")
    .insert({
      organization_id: widget.organization_id,
      conversation_id: input.conversation_id,
      direction: "inbound",
      sender_type: "contact",
      body: input.body,
      channel: "webchat",
      status: "delivered",
      metadata: {
        visitor_id: input.visitor_id ?? null,
        webchat_widget_id: widget.id
      }
    })
    .select("id, body, direction, status, created_at")
    .single<WebchatHistoryMessage>();

  if (!data) throw new Error("Unable to save webchat message");
  return data;
}

export async function loadWebchatHistory(
  supabase: SupabaseWebchatClient,
  widget: WebchatWidgetRow,
  conversationId: string,
) {
  const conversation = await loadWidgetConversation(supabase, widget, conversationId);
  if (!conversation) return [];

  const { data } = await supabase
    .from("messages")
    .select("id, body, direction, status, created_at")
    .eq("organization_id", widget.organization_id)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .returns<WebchatHistoryMessage[]>();

  return data ?? [];
}

function publicWidget(widget: WebchatWidgetRow) {
  return {
    name: widget.name,
    primary_color: widget.primary_color,
    initial_message: widget.initial_message,
    position: widget.position
  };
}

async function upsertWebchatPerson({
  supabase,
  organizationId,
  firstName,
  lastName,
  email,
  phone,
  origin
}: {
  supabase: SupabaseWebchatClient;
  organizationId: string;
  firstName: string;
  lastName: string | null;
  email?: string | null;
  phone?: string | null;
  origin: string | null;
}) {
  const filter = [email ? `email.eq.${email}` : "", phone ? `phone.eq.${phone}` : ""].filter(Boolean).join(",");
  const { data: existingContact } = filter
    ? await supabase
        .from("contacts")
        .select("id")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .or(filter)
        .limit(1)
        .maybeSingle<{ id: string }>()
    : { data: null };

  if (existingContact?.id) {
    await supabase
      .from("contacts")
      .update({
        first_name: firstName,
        last_name: lastName,
        full_name: [firstName, lastName].filter(Boolean).join(" "),
        email: email ?? null,
        phone: phone ?? null
      })
      .eq("organization_id", organizationId)
      .eq("id", existingContact.id);
    return { leadId: null, contactId: existingContact.id };
  }

  const { data: existingLead } = filter
    ? await supabase
        .from("leads")
        .select("id")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .or(filter)
        .limit(1)
        .maybeSingle<{ id: string }>()
    : { data: null };

  if (existingLead?.id) {
    await supabase
      .from("leads")
      .update({
        first_name: firstName,
        last_name: lastName,
        email: email ?? null,
        phone: phone ?? null,
        source: "webchat"
      })
      .eq("organization_id", organizationId)
      .eq("id", existingLead.id);
    return { leadId: existingLead.id, contactId: null };
  }

  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const { data: lead } = await supabase
    .from("leads")
    .insert({
      organization_id: organizationId,
      title: fullName,
      first_name: firstName,
      last_name: lastName,
      email: email ?? null,
      phone: phone ?? null,
      source: "webchat",
      status: "nuevo",
      notes: origin ? `Creado desde WebChat en ${origin}` : "Creado desde WebChat"
    })
    .select("id")
    .single<{ id: string }>();

  if (!lead?.id) throw new Error("Unable to create webchat lead");
  return { leadId: lead.id, contactId: null };
}

async function loadWidgetConversation(
  supabase: SupabaseWebchatClient,
  widget: WebchatWidgetRow,
  conversationId: string,
) {
  const { data } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("organization_id", widget.organization_id)
    .eq("webchat_widget_id", widget.id)
    .is("archived_at", null)
    .maybeSingle<{ id: string }>();

  return data;
}
