import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_ASSISTANT_ID = "62fadc8a-37c8-4bc5-8811-22876f6b70fc";
const AUTO_RULE_NAME = "Auto respuesta IA WhatsApp";
const DRAFT_RULE_NAME = "Borrador IA para WhatsApp";

function loadEnvFile(path) {
  try {
    const result = {};
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
      if (!match) continue;
      result[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
    }
    return result;
  } catch {
    return {};
  }
}

const fileEnv = {
  ...loadEnvFile(".env.local"),
  ...loadEnvFile("apps/web/.env.local")
};
const env = { ...fileEnv, ...process.env };
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const assistantId = env.PHASE20_ASSISTANT_ID || DEFAULT_ASSISTANT_ID;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const { data: assistant, error: assistantError } = await supabase
  .from("ai_assistants")
  .select("id, organization_id, name")
  .eq("id", assistantId)
  .is("archived_at", null)
  .single();

if (assistantError || !assistant) {
  throw new Error(`Assistant not found: ${assistantError?.message ?? assistantId}`);
}

const improvedPrompt = [
  "Actua como asesor comercial inmobiliario de Amin Valentin para WhatsApp.",
  "Responde de forma natural, concreta y humana, usando el historial de conversacion y la Base de Conocimiento.",
  "No inventes propiedades, precios, disponibilidad, horarios ni condiciones.",
  "Si la Base de Conocimiento no tiene un dato, pedi exactamente el dato faltante o indica que lo valida un asesor.",
  "Evita repetir el mismo saludo o la misma estructura en mensajes consecutivos.",
  "Hace una sola pregunta de avance comercial cuando ayude a calificar: compra/alquiler, zona, presupuesto, fecha o tipo de propiedad.",
  "Manten respuestas breves para WhatsApp."
].join("\n");

const { error: updateAssistantError } = await supabase
  .from("ai_assistants")
  .update({
    auto_reply_enabled: true,
    channel_id: "whatsapp",
    tone: "warm",
    prompt: improvedPrompt,
    objective: "Responder consultas inmobiliarias con contexto real, calificar la oportunidad y avanzar al siguiente paso comercial.",
    rules: [
      "Usar datos reales de CRM y Base de Conocimiento.",
      "No inventar datos de propiedades.",
      "Variar la redaccion y evitar respuestas repetitivas.",
      "Escalar a humano si hay reclamos, pagos, temas legales o falta informacion sensible."
    ],
    fallback_message: "Gracias por escribir. Lo reviso con el equipo y te respondemos con informacion precisa."
  })
  .eq("id", assistant.id)
  .eq("organization_id", assistant.organization_id);

if (updateAssistantError) throw updateAssistantError;

const { data: draftRule } = await supabase
  .from("automation_rules")
  .select("id")
  .eq("organization_id", assistant.organization_id)
  .eq("name", DRAFT_RULE_NAME)
  .maybeSingle();

if (draftRule?.id) {
  const { error } = await supabase
    .from("automation_rules")
    .update({
      conditions: { channel: "whatsapp", ai_status: "human", ai_paused: false },
      auto_send: false,
      status: "active",
      enabled: true
    })
    .eq("id", draftRule.id)
    .eq("organization_id", assistant.organization_id);
  if (error) throw error;
}

const autoRulePayload = {
  organization_id: assistant.organization_id,
  name: AUTO_RULE_NAME,
  description: "Autoenvia respuestas IA solo en conversaciones marcadas como IA automatica.",
  trigger_type: "message_received",
  status: "active",
  enabled: true,
  auto_send: true,
  auto_reply_limit: 5,
  auto_reply_window_minutes: 30,
  trigger_config: {},
  conditions: { channel: "whatsapp", ai_status: "active", ai_paused: false }
};

let { data: autoRule, error: autoRuleLookupError } = await supabase
  .from("automation_rules")
  .select("id")
  .eq("organization_id", assistant.organization_id)
  .eq("name", AUTO_RULE_NAME)
  .maybeSingle();

if (autoRuleLookupError) throw autoRuleLookupError;

if (autoRule?.id) {
  const { error } = await supabase
    .from("automation_rules")
    .update(autoRulePayload)
    .eq("id", autoRule.id)
    .eq("organization_id", assistant.organization_id);
  if (error) throw error;
} else {
  const { data, error } = await supabase
    .from("automation_rules")
    .insert(autoRulePayload)
    .select("id")
    .single();
  if (error) throw error;
  autoRule = data;
}

const { error: deleteActionsError } = await supabase
  .from("automation_actions")
  .delete()
  .eq("organization_id", assistant.organization_id)
  .eq("rule_id", autoRule.id);

if (deleteActionsError) throw deleteActionsError;

const { error: insertActionError } = await supabase
  .from("automation_actions")
  .insert({
    organization_id: assistant.organization_id,
    rule_id: autoRule.id,
    action_type: "generate_ai_draft",
    enabled: true,
    position: 1,
    config: {
      assistant_id: assistant.id,
      instruction: "Responde con el contexto CRM, historial y Base de Conocimiento. Se especifico, natural y no inventes informacion."
    }
  });

if (insertActionError) throw insertActionError;

console.log(JSON.stringify({
  ok: true,
  organization_id: assistant.organization_id,
  assistant_id: assistant.id,
  assistant_auto_reply_enabled: true,
  auto_rule_id: autoRule.id,
  draft_rule_id: draftRule?.id ?? null
}, null, 2));
