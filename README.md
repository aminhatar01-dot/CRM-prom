# CRM PRO AI

SaaS CRM multi tenant construido con Next.js 15, Supabase y OpenAI.

## FASE 19

- Base de conocimiento por organizacion en `/knowledge`.
- Documentos manuales con CRUD, archivo y reindexacion.
- Chunks y embeddings server-side con `text-embedding-3-small`.
- Busqueda semantica tenant-safe mediante `pgvector`.
- Contexto RAG, fuentes internas y aviso de evidencia insuficiente en IA.
- Preparacion de esquema para PDF, DOCX y TXT.

## FASE 1

- Monorepo con `apps/web` y paquetes compartidos.
- Supabase Auth con SSR.
- Organizaciones y membresias multi tenant.
- Dashboard inicial protegido.
- Migraciones SQL con RLS para la base del CRM.

## FASE 2

- Leads: listado, creacion, edicion, detalle, estado, responsable, busqueda y filtros.
- Contactos: CRUD base, detalle y conversion desde lead.
- Conversaciones: asociadas a lead/contacto, canal, estado, responsable y estado IA.
- Mensajes: historial por conversacion y envio manual.
- Inbox base tipo WhatsApp Web con filtros y Supabase Realtime.
- Seeds demo para CRM conversacional.

## FASE 3

- Webhook oficial de WhatsApp Cloud API.
- Recepcion de mensajes texto, imagen, audio, documento y ubicacion.
- Envio manual de texto desde Inbox para conversaciones WhatsApp.
- Persistencia de eventos, payloads y errores.
- Settings > Channels > WhatsApp.
- Validacion de firma HMAC opcional con `WHATSAPP_APP_SECRET`.

## FASE 4

- CRUD de asistentes IA.
- AIOrchestrator con contexto de CRM.
- OpenAI Responses API con modo demo sin `OPENAI_API_KEY`.
- Pruebas guardadas de asistentes.
- Boton de sugerencia IA en Inbox sin envio automatico.

## FASE 5

- CRUD de Smart Tags.
- Asignacion manual a leads y conversaciones.
- Clasificacion demo desde Inbox.
- Logs y auditoria de clasificacion.
- Auto pause de IA cuando el tag lo requiere.

## FASE 6

- CRUD de Variables Inteligentes.
- Extraccion demo desde Inbox y ficha de lead.
- Valores por lead y conversacion.
- Logs de extraccion con confidence y source message.
- Validacion por tipo y upsert sin duplicados.

## FASE 7

- CRUD de automatizaciones y historial de ejecuciones.
- Scheduler inicial en `POST /api/cron/automations` protegido por `CRON_SECRET`.
- Tareas y notificaciones internas por organizacion.
- Seguimientos manuales desde Inbox y ficha de lead.
- Runner seguro con `send_message` mockeado y reglas desactivadas por defecto.

## FASE 8

- WebChat embebible con script publico `/widget/crm-pro-ai-widget.js`.
- Configuracion en Settings > Channels > WebChat.
- Endpoints publicos seguros para iniciar conversacion, enviar mensaje y consultar historial.
- Creacion/actualizacion de leads/contactos desde WebChat.
- Conversaciones `webchat` visibles en Inbox con respuesta manual e IA sugerida.

## FASE 9

- Integraciones externas con Custom Connect y Google Sheets MVP.
- ToolExecutor con ejecucion manual/test y logs.
- AIOrchestrator lista herramientas disponibles sin ejecutarlas automaticamente.
- RLS e integridad multi tenant para integraciones y runs.

## FASE 10

- Hardening de produccion, healthcheck y System Status.
- Validacion centralizada de env vars.
- Scripts `db:push`, `db:seed` y `validate`.
- Checklist y documentacion de deploy Vercel/Supabase.

## FASE 11

- Deploy Assistant guiado para Supabase, Vercel, GitHub y canales.
- Checks locales de entorno, migraciones, build, health route y secrets.
- Scripts `predeploy`, `deploy:check`, `env:check`, `db:check` y `app:check`.
- Checklist interactivo, escenarios de despliegue y rollback.

## FASE 12

- QA End-to-End integral con Playwright y Vitest.
- Smoke de auth, modulos protegidos, healthcheck, WhatsApp y WebChat.
- Flujo simulado completo desde lead hasta Inbox, IA, tags, variables, automatizaciones e integraciones.
- Sin llamadas a OpenAI, WhatsApp o Supabase remoto.

## FASE 13

- Triggers multi tenant especificos por tabla.
- CRUD con archivo no destructivo.
- Pruebas PostgreSQL reales de RLS e integridad.

## FASE 14

- Dashboard integrado al shell operativo.
- Navegacion funcional desktop y movil.
- Recuperacion end-to-end de los CRUD prioritarios.
- Automation manual e Integration probadas mediante UI.
- Playwright autenticado contra Supabase local real.

## FASE 15

- Pipeline Kanban de Leads con seis estados.
- Drag and drop accesible y persistencia real en Supabase.
- Filtros por responsable, origen y busqueda.
- E2E autenticado que verifica persistencia despues de recargar.

## FASE 16

- OpenAI Responses API server-side para asistentes.
- Structured Outputs para Smart Tags y Variables.
- Contexto CRM con tags, variables y herramientas.
- Logs con modelo, tokens, errores y confirmacion humana.
- Modo demo explicito y rate limit por organizacion.

## FASE 17

- Meta Embedded Signup v4 para conectar WhatsApp desde un boton.
- WABA ID, Phone Number ID y business token obtenidos automaticamente.
- Tokens cifrados y aislados por organizacion.
- Suscripcion automatica al webhook existente.
- Validacion y renovacion diaria de credenciales.

## Validacion

```bash
npm run lint
npm run build
npm run test
npm run validate
npm run deploy:check
npm run qa:smoke
npm run qa:e2e
npm run qa:functional
npm run qa:pipeline
npm run qa:ai:demo
```

Consulta [docs/PHASE_17_META_EMBEDDED_SIGNUP.md](docs/PHASE_17_META_EMBEDDED_SIGNUP.md), [docs/PHASE_16_REAL_AI.md](docs/PHASE_16_REAL_AI.md), [docs/PHASE_15_PIPELINE_KANBAN.md](docs/PHASE_15_PIPELINE_KANBAN.md), [docs/DEPLOY_ASSISTANT.md](docs/DEPLOY_ASSISTANT.md), [docs/DEPLOY_CHECKLIST.md](docs/DEPLOY_CHECKLIST.md), [docs/NEXT_STEPS_FOR_USER.md](docs/NEXT_STEPS_FOR_USER.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATABASE.md](docs/DATABASE.md), [docs/ROADMAP.md](docs/ROADMAP.md), [docs/DEPLOYMENT_VERCEL_SUPABASE.md](docs/DEPLOYMENT_VERCEL_SUPABASE.md), [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md), [docs/PHASE_10_VALIDATION.md](docs/PHASE_10_VALIDATION.md), [docs/AI_ORCHESTRATION.md](docs/AI_ORCHESTRATION.md), [docs/SMART_TAGS.md](docs/SMART_TAGS.md), [docs/VARIABLES.md](docs/VARIABLES.md), [docs/AUTOMATIONS.md](docs/AUTOMATIONS.md), [docs/WEBCHAT.md](docs/WEBCHAT.md), [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md), [docs/CUSTOM_CONNECT.md](docs/CUSTOM_CONNECT.md), [docs/GOOGLE_SHEETS.md](docs/GOOGLE_SHEETS.md), [docs/WHATSAPP_SETUP.md](docs/WHATSAPP_SETUP.md) y [docs/supabase-setup.md](docs/supabase-setup.md).
