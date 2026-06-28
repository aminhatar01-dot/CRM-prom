import type { SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

export type SetupStatus = {
  percentage: number;
  businessConfigured: boolean;
  assistantsCount: number;
  autoReplyAssistants: number;
  knowledgeCount: number;
  catalogReady: boolean;
  whatsapp: { connected: boolean; tokenStatus: string; webhookActive: boolean; phone: string | null };
  activeAutomations: number;
  testCompleted: boolean;
  tasks: string[];
  recommendations: string[];
};

export async function loadSetupStatus(supabase: SupabaseClient, organizationId: string): Promise<SetupStatus> {
  const [onboardingResult, assistantsResult, documentsResult, importsResult, whatsappResult, automationResult] = await Promise.all([
    supabase.from("organization_onboarding").select("industry,business_description,country,currency,crm_goal,test_completed").eq("organization_id", organizationId).maybeSingle<OnboardingStatusRow>(),
    supabase.from("ai_assistants").select("id,auto_reply_enabled").eq("organization_id", organizationId).eq("active", true).is("archived_at", null),
    supabase.from("knowledge_documents").select("id,title,category,content").eq("organization_id", organizationId).eq("active", true).eq("indexing_status", "indexed").is("archived_at", null),
    supabase.from("knowledge_imports").select("id,status,name").eq("organization_id", organizationId).eq("status", "indexed").is("archived_at", null),
    supabase.from("whatsapp_channel_settings").select("enabled,token_status,display_phone_number,connected_at").eq("organization_id", organizationId).eq("enabled", true).limit(1).maybeSingle<WhatsAppStatusRow>(),
    supabase.from("automation_rules").select("id").eq("organization_id", organizationId).eq("status", "active").eq("enabled", true)
  ]);
  const onboarding = onboardingResult.data;
  const assistants = assistantsResult.data ?? [];
  const documents = documentsResult.data ?? [];
  const imports = importsResult.data ?? [];
  const whatsapp = whatsappResult.data;
  const businessConfigured = Boolean(onboarding?.industry && onboarding.business_description && onboarding.country && onboarding.crm_goal);
  const knowledgeCount = documents.length + imports.length;
  const catalogReady = documents.some((document) => /catalog|precio|producto/i.test(`${document.title} ${document.category} ${document.content}`)) || imports.some((source) => /catalog|precio|producto/i.test(source.name));
  const checks = [businessConfigured, assistants.length > 0, knowledgeCount > 0, Boolean(whatsapp), (automationResult.data?.length ?? 0) > 0, onboarding?.test_completed === true];
  const tasks = [!businessConfigured ? "Completar el perfil del negocio." : null, assistants.length === 0 ? "Crear al menos un asistente." : null, knowledgeCount === 0 ? "Cargar Base de Conocimiento." : null, !whatsapp ? "Conectar o verificar WhatsApp." : null, onboarding?.test_completed !== true ? "Realizar una prueba guiada." : null].filter((item): item is string => Boolean(item));
  const recommendations = [!catalogReady ? "No hay un catalogo indexado para precios o cotizaciones." : null, assistants.length > 0 && !assistants.some((assistant) => assistant.auto_reply_enabled) ? "Todos los asistentes estan en modo seguro sin auto respuesta." : null, whatsapp ? "WhatsApp conectado correctamente." : null].filter((item): item is string => Boolean(item));
  return {
    percentage: Math.round((checks.filter(Boolean).length / checks.length) * 100), businessConfigured,
    assistantsCount: assistants.length, autoReplyAssistants: assistants.filter((assistant) => assistant.auto_reply_enabled).length,
    knowledgeCount, catalogReady,
    whatsapp: { connected: Boolean(whatsapp), tokenStatus: whatsapp?.token_status ?? "not_configured", webhookActive: Boolean(getServerEnv().WHATSAPP_VERIFY_TOKEN), phone: whatsapp?.display_phone_number ?? null },
    activeAutomations: automationResult.data?.length ?? 0, testCompleted: onboarding?.test_completed === true, tasks, recommendations
  };
}

type OnboardingStatusRow = { industry: string; business_description: string; country: string; currency: string; crm_goal: string; test_completed: boolean };
type WhatsAppStatusRow = { enabled: boolean; token_status: string; display_phone_number: string | null; connected_at: string | null };
