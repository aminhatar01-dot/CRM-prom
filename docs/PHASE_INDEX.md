# Índice de Fases — CRM PRO AI

Estado al: 2026-06-29
Rama activa: `feature/phase-26-ai-credits`
Tests: 332+ passing (60+ archivos)

---

## Fases completadas

### FASE 1 — Monorepo base y Auth
**Implementado:** Monorepo npm workspaces (apps/web + packages), Supabase Auth SSR, organizaciones multi-tenant, membresías, dashboard protegido, migraciones base con RLS.  
**Archivos clave:** `supabase/migrations/20240101000001_initial_schema.sql`, `apps/web/src/lib/auth.ts`

---

### FASE 2 — CRM base: Leads, Contactos, Conversaciones, Inbox
**Implementado:** Leads (CRUD, estados, responsable, búsqueda), Contactos (CRUD, conversión desde lead), Conversaciones (canal, estado, IA status), Mensajes (historial, envío manual), Inbox tipo WhatsApp Web con Realtime.  
**Archivos clave:** `apps/web/src/app/(crm)/inbox/`, `apps/web/src/app/(crm)/leads/`, `apps/web/src/app/(crm)/contacts/`

---

### FASE 3 — WhatsApp Cloud API
**Implementado:** Webhook oficial de WhatsApp Cloud API, recepción de mensajes (texto, imagen, audio, documento, ubicación), envío manual desde Inbox, persistencia de eventos, validación HMAC, Settings > Channels > WhatsApp.  
**Archivos clave:** `apps/web/src/app/api/webhooks/whatsapp/route.ts`, `packages/integrations/src/whatsapp-cloud-service.ts`

---

### FASE 4 — Asistentes IA base
**Implementado:** CRUD de asistentes, AIOrchestrator con contexto CRM, OpenAI Responses API con modo demo, pruebas guardadas, sugerencia IA en Inbox (sin envío automático).  
**Archivos clave:** `packages/ai/src/orchestrator.ts`, `apps/web/src/app/(crm)/assistants/`

---

### FASE 5 — Smart Tags
**Implementado:** CRUD de Smart Tags por org, asignación manual a leads/conversaciones, clasificación demo desde Inbox, logs de clasificación, auto-pause de IA.  
**Archivos clave:** `apps/web/src/app/(crm)/smart-tags/`

---

### FASE 6 — Variables Inteligentes
**Implementado:** CRUD de Variables, extracción demo desde Inbox y ficha de lead, valores por lead/conversación, logs con confidence y source, validación por tipo.  
**Archivos clave:** `apps/web/src/app/(crm)/variables/`

---

### FASE 7 — Automatizaciones base
**Implementado:** CRUD de automatizaciones, historial de ejecuciones, scheduler cron (`POST /api/cron/automations`), tareas y notificaciones internas, seguimientos manuales.  
**Archivos clave:** `apps/web/src/lib/automation/runner.ts`, `apps/web/src/app/api/cron/automations/route.ts`

---

### FASE 8 — WebChat embebible
**Implementado:** Widget embebible `/widget/crm-pro-ai-widget.js`, Settings > Channels > WebChat, endpoints públicos seguros, creación de leads/contactos desde WebChat, conversaciones webchat en Inbox.  
**Archivos clave:** `apps/web/src/app/api/webchat/`, `apps/web/src/app/widget/`

---

### FASE 9 — Integraciones Custom Connect
**Implementado:** Integraciones externas con Custom Connect, Google Sheets MVP, ToolExecutor con logs, AIOrchestrator lista herramientas disponibles.  
**Archivos clave:** `apps/web/src/lib/integrations/`, `docs/CUSTOM_CONNECT.md`, `docs/GOOGLE_SHEETS.md`

---

### FASE 10 — Hardening de producción y healthcheck
**Implementado:** Healthcheck `GET /api/health`, validación centralizada de env vars, scripts `db:push`, `db:seed`, `validate`, documentación de deploy.  
**Archivos clave:** `apps/web/src/lib/system/health.ts`, `apps/web/src/app/api/health/route.ts`, `docs/DEPLOY_CHECKLIST.md`

---

### FASE 11 — Deploy Assistant
**Implementado:** Deploy Assistant guiado, checks locales de entorno, scripts `predeploy`, `deploy:check`, `env:check`, `db:check`, `app:check`, checklist interactivo.  
**Archivos clave:** `scripts/deploy-check.mjs`, `docs/DEPLOY_ASSISTANT.md`

---

### FASE 12 — QA End-to-End
**Implementado:** Tests con Playwright y Vitest, smoke de auth y módulos, flujo completo desde lead hasta Inbox con IA/tags/variables/automatizaciones.  
**Archivos clave:** `apps/web/tests/`, `docs/QA_E2E_PLAN.md`

---

### FASE 13 — Triggers multi-tenant y archivado
**Implementado:** Triggers por tabla para `updated_at`, archivado no-destructivo, pruebas PostgreSQL reales de RLS.  
**Archivos clave:** `supabase/migrations/..._phase_13_*.sql`, `docs/PHASE_13_CRITICAL_FIXES.md`

---

### FASE 14 — Dashboard y recuperación funcional
**Implementado:** Dashboard integrado al shell operativo, navegación desktop/móvil, recuperación de CRUDs, Playwright autenticado contra Supabase real.  
**Archivos clave:** `apps/web/src/app/(crm)/dashboard/`, `docs/PHASE_14_FUNCTIONAL_RECOVERY.md`

---

### FASE 15 — Pipeline Kanban
**Implementado:** Pipeline Kanban de Leads con 6 estados, drag-and-drop accesible, persistencia real, filtros, E2E autenticado.  
**Archivos clave:** `apps/web/src/app/(crm)/leads/pipeline/`, `docs/PHASE_15_PIPELINE_KANBAN.md`

---

### FASE 16 — IA real con OpenAI Responses API
**Implementado:** OpenAI Responses API server-side, Structured Outputs para Tags/Variables, contexto CRM completo, logs con modelo/tokens, modo demo explícito, rate limit por org.  
**Archivos clave:** `packages/ai/src/orchestrator.ts`, `docs/PHASE_16_REAL_AI.md`

---

### FASE 17 — Meta Embedded Signup
**Implementado:** Embedded Signup v4 para conectar WhatsApp desde botón, WABA ID/Phone Number ID automáticos, tokens cifrados, suscripción automática al webhook, renovación diaria.  
**Archivos clave:** `apps/web/src/app/(crm)/settings/channels/whatsapp/`, `docs/PHASE_17_META_EMBEDDED_SIGNUP.md`

---

### FASE 18 — Automatizaciones reales
**Implementado:** Motor de automatizaciones real con `dispatchAutomationEvent`, acciones reales (send_message vía WhatsApp, cambio de estado, asignación), evaluación de condiciones, idempotencia por `event_id`.  
**Archivos clave:** `apps/web/src/lib/automation/real-engine.ts`, `docs/PHASE_18_REAL_AUTOMATIONS.md`

---

### FASE 19 — Base de Conocimiento y RAG
**Implementado:** Documentos por organización, chunks con embeddings (`text-embedding-3-small`), búsqueda semántica con pgvector, contexto RAG en AIOrchestrator, fuentes y aviso de evidencia insuficiente.  
**Archivos clave:** `apps/web/src/lib/knowledge/`, `apps/web/src/app/(crm)/knowledge/`, `docs/PHASE_19_KNOWLEDGE_BASE_RAG.md`

---

### FASE 20 — Agente IA controlado
**Implementado:** Asistente en modo agente (ejecuta herramientas automáticamente), control de confianza, confirmación humana para acciones críticas, límite de pasos, logs de razonamiento.  
**Archivos clave:** `packages/ai/src/orchestrator.ts`, `docs/PHASE_20_CONTROLLED_AI_AGENT.md`

---

### FASE 21 — Configuración inteligente de asistentes
**Implementado:** Configuración avanzada por asistente: capacidades, modo (human/ai/draft), límite de pasos, timeout, herramientas habilitadas, router inteligente.  
**Archivos clave:** `apps/web/src/app/(crm)/assistants/[id]/`, `docs/PHASE_21_INTELLIGENT_AGENT_CONFIGURATION.md`

---

### FASE 22 — Importación de conocimiento y routing IA
**Implementado:** Importación de documentos por tipo (manual, URL), router inteligente de asistentes (LLM-based), selección automática de asistente por conversación.  
**Archivos clave:** `apps/web/src/lib/knowledge/import.ts`, `docs/PHASE_22_KNOWLEDGE_IMPORT_AND_AI_ROUTING.md`

---

### FASE 23 — Cotizaciones y capacidades del asistente
**Implementado:** Cotizaciones como capacidad conversacional del asistente, generación dinámica desde conocimiento, seguimiento de cotizaciones por lead, PDF export.  
**Archivos clave:** `apps/web/src/app/(crm)/quotes/`, `docs/PHASE_23_QUOTES_AND_ESTIMATES.md`, `docs/PHASE_23_1_ASSISTANT_QUOTE_CAPABILITIES.md`

---

### FASE 24 — Onboarding guiado de clientes
**Implementado:** Experiencia de onboarding de 9 pasos para nuevas organizaciones, wizard guiado, configuración inicial de canales, asistente y conocimiento.  
**Archivos clave:** `apps/web/src/app/(crm)/onboarding/`, `docs/PHASE_24_CLIENT_ONBOARDING.md`

---

### FASE 25 — Auditoría de producción
**Implementado:** Auditoría integral de producción, 12 checks de deploy, validación de secrets, RLS, WhatsApp, IA, documentación crítica.  
**Archivos clave:** `docs/PHASE_25_PRODUCTION_READINESS_AUDIT.md`

---

### FASE 26 — Créditos IA y ledger de consumo
**Implementado:** `ai_credit_wallets`, `ai_usage_ledger`, `credit_adjustments`, planes (Piloto/Starter/Pro), deducción atómica con `SELECT FOR UPDATE`, idempotencia via `idempotency_key`, integración con AIOrchestrator, UI `Settings → Créditos`.  
**Tests:** 35 contract tests  
**Archivos clave:** `supabase/migrations/20260628160000_phase_26_ai_credits.sql`, `packages/ai/src/credit-service.ts`, `apps/web/src/lib/ai/credits.ts`, `docs/PHASE_26_AI_CREDITS_AND_USAGE.md`

---

### FASE 27 — Integration Hub
**Implementado:** 5 tablas nuevas (providers, connections, credentials, logs, hub_tools), 15 providers con 44 tools, `HubProvider` interface, `BaseHubProvider` con stubs, `executeHubTool()` multi-tenant, UI Hub con catálogo y conexiones activas, detalle de conexión con logs.  
**Tests:** 41 contract tests  
**Archivos clave:** `supabase/migrations/20260628170000_phase_27_integration_hub.sql`, `packages/integrations/src/provider-registry.ts`, `packages/integrations/src/hub-executor.ts`, `docs/PHASE_27_INTEGRATION_HUB.md`  
**Implementado en FASE 29:** OAuth real, providers reales de Google, ToolContext para credenciales server-side.

---

### FASE 28 — Confiabilidad operativa
**Implementado:** `job_queue` con claim atómico SKIP LOCKED, retry con backoff exponencial, DLQ, `event_logs` append-only con stripSecrets, `rate_limit_buckets` distribuido, 9 job types, cron `/api/cron/jobs`, UI `Settings → Estado operativo`, healthcheck extendido.  
**Tests:** 52 contract tests  
**Archivos clave:** `supabase/migrations/20260628180000_phase_28_operational_reliability.sql`, `apps/web/src/lib/jobs/`, `apps/web/src/lib/observability/`, `apps/web/src/lib/rate-limit/`, `docs/PHASE_28_OPERATIONAL_RELIABILITY.md`

---

### FASE 29 — Google Workspace OAuth
**Implementado:** OAuth per-org para Gmail, Google Calendar, Google Sheets, Google Drive. AES-256-GCM para tokens. CSRF via `oauth_states` con nonce 10min. `ToolContext` para inyección de credenciales server-side. Aprobación humana para herramientas destructivas. Providers reales reemplazando stubs.  
**Tests:** 51 contract tests  
**Archivos clave:** `supabase/migrations/20260628190000_phase_29_google_oauth.sql`, `packages/integrations/src/google/`, `apps/web/src/lib/integrations/credentials.ts`, `apps/web/src/app/api/integrations/google/`, `docs/PHASE_29_GOOGLE_OAUTH.md`

---

### FASE 30 — Panel Admin, Planes y Créditos
**Implementado:** `platform_users` (super_admin), `admin_audit_log` append-only, 6 planes SaaS con slugs (free/demo/starter/pro/business/enterprise), `commercial_status` en subscriptions, SECURITY DEFINER functions para `admin_load_credits`/`admin_set_subscription`/`get_org_plan_limits`. UI `/admin` con 5 subrutas. Limit enforcement en `createAssistant` y `createAutomationRule`.  
**Tests:** 40 contract tests  
**Archivos clave:** `supabase/migrations/20260629000000_phase_30_admin_plans.sql`, `apps/web/src/lib/admin/`, `apps/web/src/app/actions/admin.ts`, `apps/web/src/app/admin/`, `docs/PHASE_30_ADMIN_PLANS_AND_CREDITS.md`

---

## Estado del proyecto

| Métrica | Valor |
|---|---|
| Fases completadas | 30 |
| Tests pasando | 332+ (60+ archivos) |
| Build | ✅ OK |
| Deploy check | 12 PASS, 2 WARN, 0 FAIL |
| Rama activa | `feature/phase-26-ai-credits` |
| Pendiente de PR | Sí (FASE 26–30) |

---

## Qué falta para v1.0

| Item | Fase estimada | Estado |
|---|---|---|
| OAuth real por provider (Google, Meta, MercadoLibre) | FASE 29 | ✅ Completado (Google) |
| `executeTool()` real en cada provider | FASE 29 | ✅ Completado (Google) |
| Refresh automático de tokens OAuth | FASE 29 | ✅ Completado |
| Panel admin interno | FASE 30 | ✅ Completado |
| Planes SaaS completos | FASE 30 | ✅ Completado |
| Billing automático (stripe/mercadopago) | FASE 31 | Pendiente |
| Alertas de producción (Slack/email para errores críticos) | FASE 31 | Pendiente |
| Meta/MercadoLibre OAuth | FASE 31 | Pendiente |
| Archivado de event_logs > 90 días | FASE 32 | Pendiente |
| Pruebas de carga | Pre-v1.0 | Pendiente |
| Documentación de usuario final | Pre-v1.0 | Pendiente |
| PR FASE 26–30 a main | Inmediato | Pendiente aprobación |
