# CRM PRO AI

SaaS CRM multi tenant construido con Next.js 15, Supabase y OpenAI.

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

## Validacion

```bash
npm run lint
npm run build
npm run test
```

Consulta [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATABASE.md](docs/DATABASE.md), [docs/ROADMAP.md](docs/ROADMAP.md), [docs/AI_ORCHESTRATION.md](docs/AI_ORCHESTRATION.md), [docs/SMART_TAGS.md](docs/SMART_TAGS.md), [docs/VARIABLES.md](docs/VARIABLES.md), [docs/AUTOMATIONS.md](docs/AUTOMATIONS.md), [docs/PHASE_7_VALIDATION.md](docs/PHASE_7_VALIDATION.md), [docs/WHATSAPP_SETUP.md](docs/WHATSAPP_SETUP.md) y [docs/supabase-setup.md](docs/supabase-setup.md).
