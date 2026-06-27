import Link from "next/link";
import { Archive, Bell, BookOpen, Bot, Braces, Search, SendHorizontal, Sparkles, Tags } from "lucide-react";
import {
  conversationAiStatuses,
  conversationChannels,
  conversationStatuses
} from "@crm-pro-ai/database/crm";
import { Button } from "@crm-pro-ai/ui/button";
import { Input } from "@crm-pro-ai/ui/input";
import {
  archiveConversation,
  archiveMessage,
  createMessage,
  updateConversation,
  updateConversationAIControl,
  updateMessage
} from "@/app/actions/crm";
import { createManualFollowUp } from "@/app/actions/automations";
import { approveAutomationDraft, discardAutomationDraft, hideFailedAutomationDraft } from "@/app/actions/automations";
import { suggestConversationReply } from "@/app/actions/ai";
import { analyzeConversationSmartTags, assignSmartTag } from "@/app/actions/smart-tags";
import { extractConversationVariables } from "@/app/actions/variables";
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
    id: string;
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

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  due_at: string | null;
};

type NotificationRow = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
};

type AutomationDraftRow = {
  id: string;
  body: string;
  status: string;
  error_message: string | null;
  auto_send_requested: boolean;
  model: string | null;
  token_usage: Record<string, unknown> | null;
  created_at: string;
  automation_rules: { name: string } | null;
};

type AutomationRunRow = {
  id: string;
  status: string;
  trigger_type: string;
  error_message: string | null;
  created_at: string;
  automation_rules: { name: string } | null;
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
    variables?: string;
  }>;
}) {
  const params = await searchParams;
  const { supabase, user } = await requireUser();
  const organization = await getActiveOrganization(supabase, user);
  const members = await getAssignableMembers(supabase, organization.id);

  let conversationsQuery = supabase
    .from("conversations")
    .select(
      "id, channel, status, ai_status, ai_paused, owner_id, last_message_at, created_at, leads(id, first_name, last_name, phone, status), contacts(first_name, last_name, phone), messages(body, created_at)",
    )
    .eq("organization_id", organization.id)
    .is("archived_at", null)
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
        .is("archived_at", null)
        .order("created_at", { ascending: true })
        .returns<MessageRow[]>()
    : { data: [] };
  const { data: assistants } = await supabase
    .from("ai_assistants")
    .select("id, name")
    .eq("organization_id", organization.id)
    .eq("active", true)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .returns<{ id: string; name: string }[]>();
  const { data: smartTags } = await supabase
    .from("tags")
    .select("id, name, color")
    .eq("organization_id", organization.id)
    .eq("active", true)
    .is("archived_at", null)
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
  const { data: conversationVariables } = selected
    ? await supabase
        .from("conversation_variables")
        .select("value, confidence, extracted_at, variables(id, name, key, type)")
        .eq("organization_id", organization.id)
        .eq("conversation_id", selected.id)
        .returns<
          Array<{
            value: unknown;
            confidence: number | null;
            extracted_at: string;
            variables: { id: string; name: string; key: string; type: string } | null;
          }>
        >()
    : { data: [] };
  const { data: aiSuggestion } = params.ai_log
    ? await supabase
        .from("ai_logs")
        .select("id, output, mode, model, metadata")
        .eq("id", params.ai_log)
        .eq("organization_id", organization.id)
        .maybeSingle<{
          id: string;
          output: string | null;
          mode: string;
          model: string | null;
          metadata: Record<string, unknown> | null;
        }>()
    : { data: null };
  const { data: selectedTasks } = selected
    ? await supabase
        .from("tasks")
        .select("id, title, description, status, due_at")
        .eq("organization_id", organization.id)
        .eq("conversation_id", selected.id)
        .eq("status", "pending")
        .order("due_at", { ascending: true, nullsFirst: false })
        .returns<TaskRow[]>()
    : { data: [] };
  const { data: selectedNotifications } = selected
    ? await supabase
        .from("internal_notifications")
        .select("id, title, body, created_at")
        .eq("organization_id", organization.id)
        .eq("entity_table", "conversations")
        .eq("entity_id", selected.id)
        .order("created_at", { ascending: false })
        .limit(5)
        .returns<NotificationRow[]>()
    : { data: [] };
  const { data: automationDrafts } = selected
    ? await supabase
        .from("automation_drafts")
        .select("id, body, status, error_message, auto_send_requested, model, token_usage, created_at, automation_rules(name)")
        .eq("organization_id", organization.id)
        .eq("conversation_id", selected.id)
        .in("status", ["pending", "blocked", "failed"])
        .order("created_at", { ascending: false })
        .limit(5)
        .returns<AutomationDraftRow[]>()
    : { data: [] };
  const { data: automationRuns } = selected
    ? await supabase
        .from("automation_runs")
        .select("id, status, trigger_type, error_message, created_at, automation_rules(name)")
        .eq("organization_id", organization.id)
        .eq("conversation_id", selected.id)
        .order("created_at", { ascending: false })
        .limit(5)
        .returns<AutomationRunRow[]>()
    : { data: [] };

  return (
    <section className="h-[calc(100dvh-4rem)] min-h-[620px] overflow-hidden">
      <RealtimeRefresh organizationId={organization.id} />
      <div className="grid h-full min-h-0 lg:grid-cols-[380px_minmax(0,1fr)]">
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
        <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-background" data-testid="inbox-conversation-panel">
          {selected ? (
            <>
              <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-card px-5 py-4">
                <div>
                  <h2 className="font-semibold">{conversationName(selected)}</h2>
                  <p className={`mt-2 inline-flex rounded-md border px-2 py-1 text-xs ${aiModeClass(selected)}`}>
                    {aiModeLabel(selected)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {conversationPhone(selected) ?? "Sin telefono"} · {selected.status}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                <form action={updateConversation} className="flex flex-wrap items-center gap-2">
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
                <form action={archiveConversation}>
                  <input type="hidden" name="id" value={selected.id} />
                  <input type="hidden" name="return_to" value="/inbox" />
                  <Button type="submit" size="icon" variant="outline" aria-label="Archivar conversacion">
                    <Archive className="size-4" />
                  </Button>
                </form>
                </div>
              </header>
              <div className="max-h-[min(42dvh,360px)] shrink-0 overflow-y-auto border-b bg-card px-5 py-3" data-testid="inbox-automation-panel">
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
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border bg-background p-3 text-xs">
                  <span className="font-medium">Agente IA:</span>
                  <form action={updateConversationAIControl}>
                    <input type="hidden" name="id" value={selected.id} />
                    <input type="hidden" name="return_to" value={`/inbox?conversation=${selected.id}`} />
                    <input type="hidden" name="ai_status" value="human" />
                    <input type="hidden" name="ai_paused" value="false" />
                    <Button type="submit" size="sm" variant={selected.ai_status === "human" && !selected.ai_paused ? "default" : "outline"}>
                      Modo borrador
                    </Button>
                  </form>
                  <form action={updateConversationAIControl}>
                    <input type="hidden" name="id" value={selected.id} />
                    <input type="hidden" name="return_to" value={`/inbox?conversation=${selected.id}`} />
                    <input type="hidden" name="ai_status" value="active" />
                    <input type="hidden" name="ai_paused" value="false" />
                    <Button type="submit" size="sm" variant={selected.ai_status === "active" && !selected.ai_paused ? "default" : "outline"}>
                      IA automatica
                    </Button>
                  </form>
                  <form action={updateConversationAIControl}>
                    <input type="hidden" name="id" value={selected.id} />
                    <input type="hidden" name="return_to" value={`/inbox?conversation=${selected.id}`} />
                    <input type="hidden" name="ai_status" value="paused" />
                    <input type="hidden" name="ai_paused" value="true" />
                    <Button type="submit" size="sm" variant={selected.ai_paused ? "default" : "outline"}>
                      Pausar IA
                    </Button>
                  </form>
                  <span className="text-muted-foreground">
                    El autoenvio requiere asistente habilitado y automatizacion auto_send=true.
                  </span>
                </div>
                {aiSuggestion?.output ? (
                  <div className="mt-3 rounded-md border bg-muted/60 p-3 text-sm">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">Borrador IA para revision humana</p>
                    <p>{aiSuggestion.output}</p>
                    {knowledgeSources(aiSuggestion.metadata).length > 0 ? (
                      <div className="mt-3 border-t pt-3">
                        <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <BookOpen className="size-3" />
                          Fuentes internas usadas
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {knowledgeSources(aiSuggestion.metadata).map((source) => (
                            <Link
                              key={`${source.documentId}-${source.title}`}
                              href={`/knowledge/${source.documentId}`}
                              className="rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted"
                            >
                              {source.title} · {Math.round(source.score * 100)}%
                            </Link>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="mt-3 border-t pt-3 text-xs text-amber-700">
                        No se encontro informacion interna suficiente. Revisa el borrador antes de enviarlo.
                      </p>
                    )}
                  </div>
                ) : null}
                {(automationDrafts ?? []).map((draft) => (
                  <div key={draft.id} className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium text-emerald-800">
                          Borrador de {draft.automation_rules?.name ?? "automatizacion"} · {draft.status}
                        </p>
                        <p className="mt-1 text-emerald-950">{draft.body}</p>
                        {draft.error_message ? (
                          <p className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                            {draft.error_message}
                          </p>
                        ) : null}
                        {autoSendBlockReason(draft) ? (
                          <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            No se autoenvio: {autoSendBlockReason(draft)}
                          </p>
                        ) : null}
                      </div>
                      <span className="rounded-md border border-emerald-300 px-2 py-1 text-[11px] text-emerald-800">
                        {draft.auto_send_requested ? "Auto envio solicitado" : "Revision humana"}
                      </span>
                    </div>
                    {draft.status === "pending" ? (
                      <div className="mt-3 flex gap-2">
                        <form action={approveAutomationDraft}>
                          <input type="hidden" name="draft_id" value={draft.id} />
                          <input type="hidden" name="return_to" value={`/inbox?conversation=${selected.id}`} />
                          <Button type="submit" size="sm">Aprobar y enviar</Button>
                        </form>
                        <form action={discardAutomationDraft}>
                          <input type="hidden" name="draft_id" value={draft.id} />
                          <input type="hidden" name="return_to" value={`/inbox?conversation=${selected.id}`} />
                          <Button type="submit" size="sm" variant="outline">Descartar</Button>
                        </form>
                      </div>
                    ) : null}
                    {["failed", "blocked"].includes(draft.status) ? (
                      <div className="mt-3">
                        <form action={hideFailedAutomationDraft}>
                          <input type="hidden" name="draft_id" value={draft.id} />
                          <input type="hidden" name="return_to" value={`/inbox?conversation=${selected.id}`} />
                          <Button type="submit" size="sm" variant="outline">Ocultar fallido</Button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                ))}
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
                  {params.variables ? (
                    <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                      {params.variables} variables extraidas
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
                  <form action={extractConversationVariables}>
                    <input type="hidden" name="conversation_id" value={selected.id} />
                    <Button type="submit" size="sm" variant="outline">
                      <Braces className="size-4" />
                      Extraer variables con IA
                    </Button>
                  </form>
                </div>
                {(conversationVariables ?? []).length > 0 ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {(conversationVariables ?? []).map((item) =>
                      item.variables ? (
                        <div key={item.variables.id} className="rounded-md border bg-background px-3 py-2 text-xs">
                          <p className="font-medium">{item.variables.name}</p>
                          <p className="text-muted-foreground">{formatVariableValue(item.value)} · {item.confidence ?? 0}</p>
                        </div>
                      ) : null,
                    )}
                  </div>
                ) : null}
                {((selectedTasks ?? []).length > 0 || (selectedNotifications ?? []).length > 0) ? (
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {(selectedTasks ?? []).map((task) => (
                      <div key={task.id} className="rounded-md border bg-background px-3 py-2 text-xs">
                        <p className="font-medium">{task.title}</p>
                        <p className="text-muted-foreground">
                          {task.due_at ? new Date(task.due_at).toLocaleString("es-AR") : "Sin vencimiento"}
                        </p>
                      </div>
                    ))}
                    {(selectedNotifications ?? []).map((notification) => (
                      <div key={notification.id} className="rounded-md border bg-background px-3 py-2 text-xs">
                        <p className="flex items-center gap-1 font-medium">
                          <Bell className="size-3" />
                          {notification.title}
                        </p>
                        <p className="text-muted-foreground">{notification.body ?? "Notificacion interna"}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                {(automationRuns ?? []).length > 0 ? (
                  <details className="mt-3 rounded-md border bg-background p-3 text-xs">
                    <summary className="cursor-pointer font-medium">Historial de automatizaciones</summary>
                    <div className="mt-2 space-y-2">
                      {(automationRuns ?? []).map((run) => (
                        <div key={run.id} className="flex items-center justify-between gap-3 border-t pt-2">
                          <span>{run.automation_rules?.name ?? run.trigger_type}</span>
                          <span className={run.status === "failed" ? "text-destructive" : "text-muted-foreground"}>
                            {run.status}{run.error_message ? ` · ${run.error_message}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
                <form action={createManualFollowUp} className="mt-3 grid gap-2 rounded-md border bg-background p-3 md:grid-cols-[1fr_180px_auto]">
                  <input type="hidden" name="conversation_id" value={selected.id} />
                  <input type="hidden" name="lead_id" value={selected.leads?.id ?? ""} />
                  <input type="hidden" name="return_to" value={`/inbox?conversation=${selected.id}`} />
                  <Input name="title" placeholder="Crear seguimiento manual" required />
                  <Input name="due_at" type="datetime-local" />
                  <Button type="submit" size="sm" variant="outline">Crear tarea</Button>
                </form>
              </div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5" data-testid="inbox-messages-scroll">
                {(messages ?? []).map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[72%] rounded-lg border px-4 py-3 text-sm ${message.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-card"}`}>
                      <p>{message.body}</p>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <p className="text-[11px] opacity-75">{message.status} · {message.channel}</p>
                        <form action={archiveMessage}>
                          <input type="hidden" name="id" value={message.id} />
                          <input type="hidden" name="return_to" value={`/inbox?conversation=${selected.id}`} />
                          <button type="submit" className="text-[11px] underline opacity-70 hover:opacity-100">
                            Archivar
                          </button>
                        </form>
                      </div>
                      <details className="mt-2 text-[11px]">
                        <summary className="cursor-pointer opacity-70">Editar</summary>
                        <form action={updateMessage} className="mt-2 flex gap-2">
                          <input type="hidden" name="id" value={message.id} />
                          <input type="hidden" name="conversation_id" value={selected.id} />
                          <input
                            name="body"
                            defaultValue={message.body}
                            className="min-w-0 flex-1 rounded border bg-background px-2 py-1 text-foreground"
                            required
                          />
                          <button type="submit" className="underline">Guardar</button>
                        </form>
                      </details>
                    </div>
                  </div>
                ))}
                {messages?.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Todavia no hay mensajes en esta conversacion.
                  </div>
                ) : null}
              </div>
              <footer className="shrink-0 border-t bg-card p-4">
                <form action={createMessage} className="flex gap-2">
                  <input type="hidden" name="conversation_id" value={selected.id} />
                  <input type="hidden" name="direction" value="outbound" />
                  <input type="hidden" name="channel" value={selected.channel} />
                  <input type="hidden" name="status" value="sent" />
                  <Input
                    name="body"
                    placeholder="Escribir mensaje manual"
                    autoComplete="off"
                    className="min-w-0 flex-1"
                    data-testid="inbox-message-input"
                  />
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

function formatVariableValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function aiModeLabel(conversation: Pick<ConversationRow, "ai_status" | "ai_paused">) {
  if (conversation.ai_paused || conversation.ai_status === "paused") return "IA pausada";
  if (conversation.ai_status === "active") return "IA automatica";
  return "Modo humano / borrador";
}

function aiModeClass(conversation: Pick<ConversationRow, "ai_status" | "ai_paused">) {
  if (conversation.ai_paused || conversation.ai_status === "paused") return "border-amber-200 bg-amber-50 text-amber-800";
  if (conversation.ai_status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function autoSendBlockReason(draft: Pick<AutomationDraftRow, "auto_send_requested" | "status" | "token_usage">) {
  if (!draft.auto_send_requested && draft.status === "pending") return "la automatizacion esta en modo borrador";
  const decision = draft.token_usage?.auto_send_decision;
  if (!decision || typeof decision !== "object") return null;
  const reason = (decision as { reason?: unknown }).reason;
  if (typeof reason !== "string" || reason === "ready") return null;
  const labels: Record<string, string> = {
    draft_mode: "la regla no tiene auto_send activado",
    assistant_auto_reply_disabled: "el asistente no tiene respuestas automaticas habilitadas",
    conversation_paused: "la conversacion tiene la IA pausada",
    conversation_not_automatic: "la conversacion no esta en IA automatica",
    knowledge_insufficient: "falta contexto suficiente en la Base de Conocimiento",
    human_escalation_required: "requiere revision humana por posible tema sensible"
  };
  return labels[reason] ?? reason;
}

function knowledgeSources(metadata: Record<string, unknown> | null) {
  const sources = metadata?.knowledge_sources;
  if (!Array.isArray(sources)) return [];
  return sources.filter(
    (source): source is { documentId: string; title: string; score: number } =>
      typeof source === "object" &&
      source !== null &&
      typeof (source as Record<string, unknown>).documentId === "string" &&
      typeof (source as Record<string, unknown>).title === "string" &&
      typeof (source as Record<string, unknown>).score === "number",
  );
}
