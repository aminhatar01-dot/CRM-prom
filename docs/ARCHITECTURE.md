# Arquitectura

CRM PRO AI es un SaaS multi tenant en monorepo.

## Capas

- `apps/web`: Next.js 15 App Router, Supabase SSR, Server Actions y UI Tailwind.
- `packages/ui`: componentes shadcn/ui locales.
- `packages/database`: schemas Zod y contratos de validacion.
- `packages/types`: tipos compartidos.
- `packages/ai`, `packages/integrations`, `packages/automation`: contratos para fases siguientes.
- `supabase`: migraciones, RLS, Realtime y seeds.

## Seguridad multi tenant

Todas las entidades operativas incluyen `organization_id`. Las consultas de UI tambien filtran por organizacion, pero la garantia real esta en RLS:

- `is_org_member(organization_id)` para lectura/escritura operativa.
- `is_org_admin(organization_id)` para configuracion sensible.
- No se usa service role key en frontend.

## FASE 2

La fase 2 agrega el nucleo conversacional:

- CRM Core: leads y contactos.
- Inbox: conversaciones y mensajes.
- Realtime: refresco de UI ante cambios en `conversations`, `messages` y `leads`.
- Server Actions: validan con Zod y escriben usando la sesion del usuario.

WhatsApp real e IA real quedan preparados, pero no implementados en esta fase.

## FASE 3

La fase 3 conecta WhatsApp Cloud API:

- `GET /api/webhooks/whatsapp`: verificacion Meta.
- `POST /api/webhooks/whatsapp`: recepcion de mensajes/statuses.
- `WhatsAppCloudService`: cliente server-side para Graph API.
- `whatsapp_channel_settings`: configuracion por organizacion.
- `whatsapp_events`: bitacora de payloads recibidos, enviados y errores.

Los webhooks usan service role exclusivamente en servidor porque no hay sesion de usuario en llamadas de Meta.

## FASE 4

La fase 4 agrega asistentes IA:

- CRUD en `/assistants`.
- `AIOrchestrator` en `packages/ai`.
- `ai_logs` para sugerencias y errores.
- `ai_assistant_tests` para pruebas manuales.
- Sugerencias en Inbox sin envio automatico.

OpenAI se llama desde servidor. Si no hay `OPENAI_API_KEY`, el sistema usa modo demo.

## FASE 5

Smart Tags amplian la tabla `tags` y agregan:

- `conversation_smart_tags`
- `smart_tag_classification_logs`
- `SmartTagClassifier`
- Acciones server-side para CRUD, asignacion y clasificacion.

La clasificacion automatica queda preparada, pero se ejecuta manualmente desde Inbox en esta fase.

## FASE 6

Variables Inteligentes agregan:

- `variables`
- `lead_variables`
- `conversation_variables`
- `variable_extraction_logs`
- `VariableExtractor`

La extraccion automatica queda preparada pero desactivada. La UI ejecuta extracciones manuales desde Inbox y la ficha de lead.

## FASE 7

Automatizaciones agregan:

- `automation_runs`
- `tasks`
- `internal_notifications`
- runner seguro en `apps/web/src/lib/automation`
- endpoint cron `POST /api/cron/automations`
- UI en `/automations`

Las reglas nacen en `draft`, el cron exige `CRON_SECRET` y `send_message` permanece mockeado para evitar envios automaticos reales.

## FASE 8

WebChat agrega:

- `webchat_widgets`
- `webchat_widget_id` en conversaciones
- script publico `/widget/crm-pro-ai-widget.js`
- endpoints `/api/webchat/start`, `/api/webchat/message` y `/api/webchat/history`
- settings en `/settings/channels/webchat`

Los endpoints publicos usan service role solo server-side, validan `public_token`, dominio permitido y rate limit basico. Las conversaciones y mensajes se guardan en las mismas tablas CRM para aparecer en Inbox.

## FASE 9

Integraciones agregan:

- `integrations`
- `integration_tools`
- `integration_tool_runs`
- `google_sheets_connections`
- `integration_secrets`
- `ToolExecutor`
- `CustomConnectExecutor`
- `GoogleSheetsConnector`

El AIOrchestrator recibe herramientas activas como contexto disponible, pero no las ejecuta automaticamente. Las ejecuciones quedan restringidas a pruebas manuales desde `/integrations`.

## FASE 10

Hardening de produccion agrega:

- `GET /api/health`
- Settings > System Status
- validacion centralizada de env vars
- scripts `db:push`, `db:seed` y `validate`
- permisos de navegacion por rol
- contrato automatizado de RLS en tests

El objetivo de esta fase es preparar el MVP para Vercel/Supabase sin activar envios automaticos reales ni ejecucion autonoma de tools.
