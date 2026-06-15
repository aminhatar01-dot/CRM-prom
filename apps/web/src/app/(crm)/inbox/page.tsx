import Link from "next/link";
import { Bot, Search, SendHorizontal, Sparkles, Tags } from "lucide-react";
import {
  conversationAiStatuses,
  conversationChannels,
  conversationStatuses
} from "@crm-pro-ai/database/crm";
import { Button } from "@crm-pro-ai/ui/button";
import { Input } from "@crm-pro-ai/ui/input";
import { createMessage, updateConversation } from "@/app/actions/crm";
import { suggestConversationReply } from "@/app/actions/ai";
import { analyzeConversationSmartTags, assignSmartTag } from "@/app/actions/smart-tags";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization, getAssignableMembers } from "@/lib/organization";
import { RealtimeRefresh } from "./_components/realtime-refresh";

type ConversationRow = {
  id: string;
  channel: string;
  status: string;
  ai_status: string;
  ai_paused: boolean;
  owner_id: string | null;
  last_message_at: string | null;
  created_at: string;
  leads: {
    first_name: string;
    last_name: string | null;
    phone: string | null;
    status: string;
  } | null;
  contacts: {
    first_name: string;
    last_name: string | null;
    phone: string | null;
  } | null;
  messages: { body: string; created_at: string }[] | null;
};

type MessageRow = {
  id: string;
  body: string;
  direction: string;
  channel: string;
  status: string;
  created_at: string;
};

export default async function InboxPage({
  searchParams
}: {
  searchParams: Promise<{
    conversation?: string;
    q?: string;
    channel?: string;
    status?: string;
    owner?: string;
    ai_log?: string;
    tags?: string;
    paused?: string;
  }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const members = await getAssignableMembers(supabase, organization.id);

  let conversationsQuery = supabase
    .from("conversations")
    .select(
      "id, channel, status, ai_status, ai_paused, owner_id, last_message_at, created_at, leads(first_name, last_name, phone, status), contacts(first_name, last_name, phone), messages(body, created_at)",
    )
    .eq("organization_id", organization.id)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);

  if (params.channel && params.channel !== "all") conversationsQuery = conversationsQuery.eq("channel", params.channel);
  if (params.status && params.status !== "all") conversationsQuery = conversationsQuery.eq("status", params.status);
  if (params.owner && params.owner !== "all") conversationsQuery = conversationsQuery.eq("owner_id", params.owner);

  const { data } = await conversationsQuery.returns<ConversationRow[]>();
  const allConversations = data ?? [];
  const search = params.q?.trim().toLowerCase() ?? "";
  const conversations = search
    ? allConversations.filter((conversation) =>
        conversationName(conversation).toLowerCase().includes(search) ||
        (conversationPhone(conversation) ?? "").includes(search),
      )
    : allConversations;

  const selected = conversations.find((conversation) => conversation.id === params.conversation) ?? conversations[0];
  const { data: messages } = selected
    ? await supabase
        .from("messages")
        .select("id, body, direction, channel, status, created_at")
        .eq("organization_id", organization.id)
        .eq("conversation_id", selected.id)
        .order("created_at", { ascending: true })
        .returns<MessageRow[]>()
    : { data: [] };
  const { data: assistants } = await supabase
    .from("ai_assistants")
    .select("id, name")
    .eq("organization_id", organization.id)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .returns<{ id: string; name: string }[]>();
  const { data: smartTags } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("organization_id", organization.id)
    .eq("active", true)
    .order("name")
    .returns<{ id: string; name: string; color: string }[]>();
  const { data: selectedTags } = selected
    ? await supabase
        .from("conversation_smart_tags")
        .select("tags(id, name, color)")
        .eq("organization_id", organization.id)
        .eq("conversation_id", selected.id)
        .returns<Array<{ tags: { id: string; name: string; color: string } | null }>>()
    : { data: [] };
  const { data: aiSuggestion } = params.ai_log
    ? await supabase
        .from("ai_logs")
        .select("id, output, mode, model")
        .eq("id", params.ai_log)
        .eq("organization_id", organization.id)
        .maybeSingle<{ id: string; output: string | null; mode: string; model: string | null }>()
    : { data: null };

  return (
    <section className="h-[calc(100vh-4rem)]">
      <RealtimeRefresh organizationId={organization.id} />
      <div className="grid h-full lg:grid-cols-[380px_1fr]">
        <aside className="flex min-h-0 flex-col border-r bg-card">
          <div className="border-b p-4">
            <h1 className="text-xl font-semibold tracking-normal">Inbox</h1>
            <form className="mt-4 grid gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                <Input name="q" defaultValue={params.q ?? ""} className="pl-9" placeholder="Buscar conversaciones" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <FilterSelect name="channel" value={params.channel} allLabel="Canal" options={conversationChannels} />
                <FilterSelect name="status" value={params.status} allLabel="Estado" options={conversationStatuses} />
              </div>
              <select name="owner" defaultValue={params.owner ?? "all"} className="h-10 rounded-md border bg-background px-3 text-sm">
                <option value="all">Responsable</option>
                {members.map((member) => (
                  <option key={member.user_id} value={member.user_id}>
                    {member.role} - {member.user_id.slice(0, 8)}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="outline">Aplicar filtros</Button>
            </form>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {conversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/inbox?conversation=${conversation.id}`}
                className={`block border-b p-4 hover:bg-muted/70 ${selected?.id === conversation.id ? "bg-muted" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{conversationName(conversation)}</p>
                    <p className="text-xs text-muted-foreground">{conversationPhone(conversation) ?? "Sin telefono"}</p>
                  </div>
                  <span className="rounded-md bg-secondary px-2 py-1 text-xs">{conversation.channel}</span>
                </div>
                <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
                  {conversation.messages?.[0]?.body ?? "Sin mensajes"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-md border px-2 py-1">{conversation.status}</span>
                  <span className="rounded-md border px-2 py-1">{conversation.ai_status}</span>
                  {conversation.leads?.status ? <span className="rounded-md border px-2 py-1">{conversation.leads.status}</span> : null}
                </div>
              </Link>
            ))}
            {conversations.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No hay conversaciones.</p>
            ) : null}
          </div>
        </aside>
        <div className="flex min-h-0 flex-col bg-background">
          {selected ? (
            <>
              <header className="flex items-center justify-between border-b bg-card px-5 py-4">
                <div>
                  <h2 className="font-semibold">{conversationName(selected)}</h2>
                  <p className="text-xs text-muted-foreground">
                    {conversationPhone(selected) ?? "Sin telefono"} · {selected.status}
                  </p>
                </div>
                <form action={updateConversation} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={selected.id} />
                  <select name="status" defaultValue={selected.status} className="h-9 rounded-md border bg-background px-2 text-xs">
                    {conversationStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <select name="ai_status" defaultValue={selected.ai_status} className="h-9 rounded-md border bg-background px-2 text-xs">
                    {conversationAiStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                  <select name="owner_id" defaultValue={selected.owner_id ?? ""} className="h-9 rounded-md border bg-background px-2 text-xs">
                    <option value="">Sin responsable</option>
                    {members.map((member) => (
                      <option key={member.user_id} value={member.user_id}>{member.role}</option>
                    ))}
                  </select>
                  <Button type="submit" size="sm" variant="outline">Guardar</Button>
                </form>
              </header>
              <div className="border-b bg-card px-5 py-3">
                <form action={suggestConversationReply} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="conversation_id" value={selected.id} />
                  <select name="assistant_id" className="h-9 rounded-md border bg-background px-2 text-xs">
                    <option value="">Asistente activo</option>
                    {(assistants ?? []).map((assistant) => (
                      <option key={assistant.id} value={assistant.id}>
                        {assistant.name}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="sm" variant="outline">
                    <Sparkles className="size-4" />
                    Sugerir respuesta con IA
                  </Button>
                  {aiSuggestion?.output ? (
                    <span className="text-xs text-muted-foreground">
                      Sugerencia generada en modo {aiSuggestion.mode}
                    </span>
                  ) : null}
                </form>
                {aiSuggestion?.output ? (
                  <div className="mt-3 rounded-md border bg-muted/60 p-3 text-sm">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Borrador IA para revision humana</p>
                    <p>{aiSuggestion.output}</p>
                  </div>
                ) : null}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {(selectedTags ?? []).map((item) =>
                    item.tags ? (
                      <span key={item.tags.id} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
                        <span className="size-2 rounded-full" style={{ backgroundColor: item.tags.color }} />
                        {item.tags.name}
                      </span>
                    ) : null,
                  )}
                  {params.tags ? (
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                      {params.tags} tags detectados{params.paused === "1" ? " · IA pausada" : ""}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <form action={analyzeConversationSmartTags}>
                    <input type="hidden" name="conversation_id" value={selected.id} />
                    <Button type="submit" size="sm" variant="outline">
                      <Tags className="size-4" />
                      Analizar tags con IA
                    </Button>
                  </form>
                  <form action={assignSmartTag} className="flex items-center gap-2">
                    <input type="hidden" name="conversation_id" value={selected.id} />
                    <input type="hidden" name="return_to" value={`/inbox?conversation=${selected.id}`} />
                    <select name="tag_id" className="h-9 rounded-md border bg-background px-2 text-xs" required>
                      <option value="">Asignar tag</option>
                      {(smartTags ?? []).map((tag) => (
                        <option key={tag.id} value={tag.id}>
                          {tag.name}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" variant="outline">Asignar</Button>
                  </form>
                </div>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
                {(messages ?? []).map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[72%] rounded-lg border px-4 py-3 text-sm ${message.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                      <p>{message.body}</p>
                      <p className="mt-2 text-[11px] opacity-75">{message.status} · {message.channel}</p>
                    </div>
                  </div>
                ))}
                {messages?.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Todavia no hay mensajes en esta conversacion.
                  </div>
                ) : null}
              </div>
              <footer className="border-t bg-card p-4">
                <form action={createMessage} className="flex gap-2">
                  <input type="hidden" name="conversation_id" value={selected.id} />
                  <input type="hidden" name="direction" value="outbound" />
                  <input type="hidden" name="channel" value={selected.channel} />
                  <input type="hidden" name="status" value="sent" />
                  <Input name="body" placeholder="Escribir mensaje manual" autoComplete="off" />
                  <Button type="submit" size="icon" aria-label="Enviar mensaje">
                    <SendHorizontal className="size-4" />
                  </Button>
                </form>
              </footer>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
              <Bot className="size-8" />
              <p>Selecciona una conversacion.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FilterSelect({
  name,
  value,
  allLabel,
  options
}: {
  name: string;
  value?: string;
  allLabel: string;
  options: readonly string[];
}) {
  return (
    <select name={name} defaultValue={value ?? "all"} className="h-10 rounded-md border bg-background px-3 text-sm">
      <option value="all">{allLabel}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function conversationName(conversation: ConversationRow) {
  const person = conversation.contacts ?? conversation.leads;
  return [person?.first_name, person?.last_name].filter(Boolean).join(" ") || "Conversacion manual";
}

function conversationPhone(conversation: ConversationRow) {
  return conversation.contacts?.phone ?? conversation.leads?.phone;
}
