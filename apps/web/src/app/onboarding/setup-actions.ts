"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { agentConfigSchema, buildAgentRuntime } from "@crm-pro-ai/ai/agent-config";
import { assistantTemplates, getAssistantTemplate } from "@crm-pro-ai/ai/assistant-templates";
import { onboardingUseCases, recommendAssistantTemplates } from "@crm-pro-ai/ai/onboarding-templates";
import { routeAssistant } from "@crm-pro-ai/ai/assistant-router";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
import { indexKnowledgeDocument, searchKnowledge } from "@/lib/knowledge/service";

const businessSchema = z.object({ business_name: z.string().trim().min(2).max(160), industry: z.string().trim().min(2).max(120), business_description: z.string().trim().min(10).max(2000), country: z.string().trim().min(2).max(100), currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/), business_hours: z.string().trim().max(1000), crm_goal: z.string().trim().min(5).max(1000) });
const styleSchema = z.object({ tone: z.enum(["professional", "friendly", "direct", "warm"]), formality: z.enum(["very_informal", "close", "professional", "very_formal"]), emoji_usage: z.enum(["never", "low", "normal", "frequent"]), response_length: z.enum(["very_short", "normal", "detailed"]), personality: z.string().trim().min(2).max(300), rules: z.string().trim().max(2000), human_topics: z.string().trim().max(2000) });
function value(data: FormData, key: string) { const item = data.get(key); return typeof item === "string" ? item : ""; }
function checked(data: FormData, key: string) { return data.get(key) === "on"; }

async function context() { const { supabase, user } = await requireUser(); const organization = await getActiveOrganization(supabase, user); return { supabase, user, organization }; }
async function progress(supabase: Awaited<ReturnType<typeof context>>["supabase"], organizationId: string, step: number, updates: Record<string, unknown>) {
  const { data, error } = await supabase.from("organization_onboarding").update({ current_step: step, ...updates }).eq("organization_id", organizationId).select("organization_id").maybeSingle();
  if (error) throw error;
  if (!data) {
    const { data: organization } = await supabase.from("organizations").select("name").eq("id", organizationId).single<{ name: string }>();
    const { error: insertError } = await supabase.from("organization_onboarding").insert({ organization_id: organizationId, business_name: organization?.name ?? "Mi empresa", current_step: step, ...updates });
    if (insertError) throw insertError;
  }
}

export async function saveBusinessProfile(formData: FormData) {
  const parsed = businessSchema.safeParse(Object.fromEntries(["business_name","industry","business_description","country","currency","business_hours","crm_goal"].map((key) => [key, value(formData, key)])));
  if (!parsed.success) redirect("/onboarding?step=1&error=invalid");
  const { supabase, organization } = await context();
  await progress(supabase, organization.id, 2, parsed.data);
  await supabase.from("organizations").update({ name: parsed.data.business_name }).eq("id", organization.id);
  redirect("/onboarding?step=2");
}

export async function saveUseCases(formData: FormData) {
  const useCases = onboardingUseCases.filter((item) => checked(formData, `use_case_${item}`));
  if (!useCases.length) redirect("/onboarding?step=2&error=select-one");
  const { supabase, organization } = await context();
  await progress(supabase, organization.id, 3, { use_cases: useCases, selected_templates: recommendAssistantTemplates(useCases) });
  redirect("/onboarding?step=3");
}

export async function createOnboardingAssistants(formData: FormData) {
  const keys = assistantTemplates.map((item) => item.key).filter((key) => checked(formData, `template_${key}`));
  if (!keys.length) redirect("/onboarding?step=3&error=select-one");
  const { supabase, user, organization } = await context();
  const { data: setup } = await supabase.from("organization_onboarding").select("industry,business_description,crm_goal,currency").eq("organization_id", organization.id).single<BusinessSetupRow>();
  const { data: existing } = await supabase.from("ai_assistants").select("name").eq("organization_id", organization.id).is("archived_at", null);
  const names = new Set((existing ?? []).map((item) => item.name));
  for (const key of keys) {
    const template = getAssistantTemplate(key); if (!template || names.has(template.name)) continue;
    const config = agentConfigSchema.parse({ agent_name: template.name, role: template.config.role ?? "asistente", industry: setup?.industry ?? "", business_description: setup?.business_description ?? "", sells: "", services: "", products: "", primary_goal: template.config.primary_goal ?? setup?.crm_goal ?? template.description, primary_intent: template.config.primary_intent ?? "general", topics: template.config.topics ?? [], excluded_topics: template.config.excluded_topics ?? [], knowledge_categories: [], routing_priority: template.config.routing_priority ?? 50, is_default: template.config.is_default ?? false, formality: "professional", response_length: "normal", emoji_usage: "low", commercial_pace: "consultative", communication_style: "friendly", always_ask: [], never_invent: ["precios", "stock", "condiciones"], human_topics: [], create_task_when: [], create_opportunity_when: [], create_appointment_when: [], pause_ai_when: [], auto_reply_when: [], draft_only_when: ["falte informacion"], knowledge_topics: [], ...template.config, default_currency: setup?.currency ?? "ARS" });
    const runtime = buildAgentRuntime(config, []);
    await supabase.from("ai_assistants").insert({ organization_id: organization.id, name: config.agent_name, description: template.description, prompt: runtime.prompt, objective: runtime.objective, tone: runtime.tone, rules: runtime.rules, fallback_message: "Gracias por escribir. Un asesor del equipo va a ayudarte.", active: true, enabled: true, channel_id: "whatsapp", auto_reply_enabled: false, agent_config: config, playbooks: [] });
  }
  await progress(supabase, organization.id, 4, { selected_templates: keys });
  await supabase.from("audit_logs").insert({ organization_id: organization.id, actor_user_id: user.id, action: "onboarding_create_assistants", entity_table: "ai_assistants", metadata: { templates: keys } });
  revalidatePath("/assistants"); redirect("/onboarding?step=4");
}

export async function saveResponseStyle(formData: FormData) {
  const parsed = styleSchema.safeParse(Object.fromEntries(["tone","formality","emoji_usage","response_length","personality","rules","human_topics"].map((key) => [key, value(formData, key)])));
  if (!parsed.success) redirect("/onboarding?step=4&error=invalid");
  const { supabase, organization } = await context();
  await progress(supabase, organization.id, 5, { response_style: parsed.data });
  const { data: assistants } = await supabase.from("ai_assistants").select("id,agent_config,playbooks").eq("organization_id", organization.id).eq("active", true).is("archived_at", null);
  for (const assistant of assistants ?? []) {
    const current = agentConfigSchema.safeParse(assistant.agent_config);
    if (!current.success) continue;
    const config = agentConfigSchema.parse({ ...current.data, formality: parsed.data.formality, emoji_usage: parsed.data.emoji_usage, response_length: parsed.data.response_length, personality: parsed.data.personality, never_invent: Array.from(new Set([...current.data.never_invent, ...parsed.data.rules.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)])), human_topics: Array.from(new Set([...current.data.human_topics, ...parsed.data.human_topics.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)])) });
    const runtime = buildAgentRuntime(config, Array.isArray(assistant.playbooks) ? assistant.playbooks : []);
    await supabase.from("ai_assistants").update({ agent_config: config, prompt: runtime.prompt, objective: runtime.objective, tone: runtime.tone, rules: runtime.rules }).eq("id", assistant.id).eq("organization_id", organization.id);
  }
  revalidatePath("/assistants");
  redirect("/onboarding?step=5");
}

export async function createInitialKnowledge(formData: FormData) {
  const title = value(formData, "title").trim(); const content = value(formData, "content").trim(); const category = value(formData, "category").trim() || "general";
  if (title.length < 2 || content.length < 20) redirect("/onboarding?step=5&error=invalid");
  const { supabase, user, organization } = await context();
  const { data, error } = await supabase.from("knowledge_documents").insert({ organization_id: organization.id, title, content, category, active: true, source_type: "manual", indexing_status: "pending", created_by: user.id }).select("id").single<{ id: string }>();
  if (error || !data) redirect("/onboarding?step=5&error=knowledge");
  try { await indexKnowledgeDocument(data.id, organization.id); } catch { redirect("/onboarding?step=5&error=knowledge-indexing"); }
  await progress(supabase, organization.id, 6, {}); revalidatePath("/knowledge"); redirect("/onboarding?step=6");
}

export async function saveAutomationPreferences(formData: FormData) {
  const preferences = { draft_mode: checked(formData,"draft_mode"), controlled_auto: checked(formData,"controlled_auto"), task_new_lead: checked(formData,"task_new_lead"), smart_tags: checked(formData,"smart_tags"), variables: checked(formData,"variables"), quotes: checked(formData,"quotes"), human_handoff: checked(formData,"human_handoff") };
  const { supabase, organization } = await context();
  const rules = [preferences.draft_mode || preferences.controlled_auto ? { name: "Onboarding - Respuesta IA", trigger_type: "message_received", auto_send: preferences.controlled_auto, actions: [{ type: "generate_ai_draft", enabled: true, config: { auto_route: true } }] } : null, preferences.task_new_lead ? { name: "Onboarding - Tarea nuevo lead", trigger_type: "lead_created", auto_send: false, actions: [{ type: "create_task", enabled: true, config: { title: "Contactar nuevo lead" } }] } : null, preferences.quotes ? { name: "Onboarding - Cotizacion conversacional", trigger_type: "message_received", auto_send: false, actions: [{ type: "create_quote", enabled: true, config: {} }] } : null].filter((rule): rule is NonNullable<typeof rule> => Boolean(rule));
  for (const rule of rules) {
    const { data: existing } = await supabase.from("automation_rules").select("id").eq("organization_id", organization.id).eq("name", rule.name).maybeSingle();
    if (existing) continue;
    const { data: created } = await supabase.from("automation_rules").insert({ organization_id: organization.id, name: rule.name, description: "Creada desde onboarding", trigger_type: rule.trigger_type, status: "active", enabled: true, auto_send: rule.auto_send, trigger_config: {}, conditions: {} }).select("id").single<{ id: string }>();
    if (created) await supabase.from("automation_actions").insert(rule.actions.map((action, index) => ({ organization_id: organization.id, rule_id: created.id, action_type: action.type, config: action.config, enabled: true, position: index + 1 })));
  }
  await progress(supabase, organization.id, 8, { automation_preferences: preferences }); revalidatePath("/automations"); redirect("/onboarding?step=8");
}

export async function simulateOnboardingMessage(formData: FormData) {
  const message = value(formData, "message").trim(); const channel = value(formData, "channel") || "whatsapp";
  if (!message) redirect("/onboarding?step=8&error=invalid");
  const { supabase, organization } = await context();
  const [{ data: assistants }, knowledge] = await Promise.all([supabase.from("ai_assistants").select("id,name,channel_id,agent_config,auto_reply_enabled").eq("organization_id", organization.id).eq("active", true).is("archived_at", null), searchKnowledge({ organizationId: organization.id, query: message, limit: 3 }).catch(() => [])]);
  const decision = routeAssistant({ candidates: (assistants ?? []).map((assistant) => ({ id: assistant.id, name: assistant.name, channelId: assistant.channel_id, role: configValue(assistant.agent_config,"role"), primaryIntent: configValue(assistant.agent_config,"primary_intent"), topics: configList(assistant.agent_config,"topics"), excludedTopics: configList(assistant.agent_config,"excluded_topics"), knowledgeCategories: configList(assistant.agent_config,"knowledge_categories"), priority: Number(configValue(assistant.agent_config,"routing_priority") || 50), isDefault: configBoolean(assistant.agent_config,"is_default"), capabilities: { canAnswerPrices: configBoolean(assistant.agent_config,"can_answer_prices"), canCreateQuotes: configBoolean(assistant.agent_config,"can_create_quotes"), canSendQuotes: configBoolean(assistant.agent_config,"can_send_quotes") } })), channel, message, relevantKnowledgeCategories: knowledge.map((source) => source.category) });
  const selected = assistants?.find((assistant) => assistant.id === decision?.assistantId);
  const result = { message, channel, assistant_id: decision?.assistantId ?? null, assistant_name: selected?.name ?? null, routing: decision, sources: knowledge.map((source) => ({ title: source.title, category: source.category, score: source.score })), outcome: selected?.auto_reply_enabled ? "Requiere ademas conversacion automatica y regla auto_send; en esta prueba queda como borrador." : "Borrador: auto respuesta desactivada en el asistente." };
  await progress(supabase, organization.id, 9, { test_completed: true, test_result: result }); redirect("/onboarding?step=9");
}

export async function advanceOnboarding(formData: FormData) { const step = Math.max(1, Math.min(9, Number(value(formData,"next_step")) || 1)); const { supabase, organization } = await context(); await progress(supabase, organization.id, step, {}); redirect(`/onboarding?step=${step}`); }
export async function finishOnboarding() { const { supabase, organization } = await context(); await progress(supabase, organization.id, 9, { completed_at: new Date().toISOString() }); revalidatePath("/dashboard"); redirect("/dashboard?setup=complete"); }

function configValue(config: unknown, key: string) { return config && typeof config === "object" && key in config ? String((config as Record<string, unknown>)[key] ?? "") : ""; }
function configList(config: unknown, key: string) { const item = config && typeof config === "object" ? (config as Record<string, unknown>)[key] : null; return Array.isArray(item) ? item.filter((value): value is string => typeof value === "string") : []; }
function configBoolean(config: unknown, key: string) { return Boolean(config && typeof config === "object" && (config as Record<string, unknown>)[key] === true); }
type BusinessSetupRow = { industry: string; business_description: string; crm_goal: string; currency: string };
