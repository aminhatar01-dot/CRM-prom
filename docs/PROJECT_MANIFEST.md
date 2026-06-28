# PROJECT MANIFEST — CRM PRO AI

Versión: 1.0 (actualizada en FASE 28)
Rama activa: `feature/phase-26-ai-credits`

Este documento es la fuente de verdad del producto. Todo lo que se implemente debe ser coherente con lo aquí descrito.

---

## 1. Visión del producto

CRM PRO AI es un SaaS de CRM conversacional con IA para equipos de ventas y atención al cliente en LatAm.

El sistema permite que cada organización cliente conecte su WhatsApp Business, cree asistentes IA configurables, gestione conversaciones, automatice flujos y conecte sus cuentas externas — todo de forma aislada, segura y multi-tenant.

**No es un CRM genérico.** Es un sistema conversacional donde WhatsApp es el canal principal y la IA es el copiloto del equipo humano.

---

## 2. Principios del sistema

### 2.1 Multi-tenancy estricto

Cada organización es un tenant completamente aislado:
- Todos los datos tienen `organization_id` y RLS estricto.
- No existe ningún dato compartido entre organizaciones (excepto el catálogo de providers del Integration Hub).
- Un usuario no puede ver datos de otra organización bajo ninguna circunstancia.
- Cada organización conecta **sus propias cuentas** (WhatsApp, integraciones, etc.).

### 2.2 La IA como copiloto, no como piloto

- Los asistentes IA **sugieren** respuestas; los humanos **deciden** enviarlas (modo `human`).
- En modo `ai`, el asistente puede responder automáticamente, pero el equipo puede tomar control en cualquier momento.
- La IA **nunca inventa** información sobre el negocio del cliente. Usa la Base de Conocimiento como fuente de verdad.
- Si la Base de Conocimiento no tiene información suficiente, el asistente lo declara explícitamente.

### 2.3 Configurabilidad sin asumir rubros

El sistema no asume nada sobre el negocio del cliente:
- Los asistentes son configurables: nombre, instrucciones, tono, capacidades.
- Las Smart Tags y Variables Inteligentes son definidas por cada organización.
- Los catálogos (productos, precios, stock) provienen de la Base de Conocimiento de cada organización.
- **Nunca** hardcodear lógica de negocio de un rubro específico.

### 2.4 Datos del cliente son del cliente

- Conversaciones, contactos, leads, conocimiento, asistentes y configuraciones pertenecen a la organización.
- Las credenciales de integraciones nunca son visibles al frontend (solo `service_role`).
- Los tokens de WhatsApp están cifrados en base de datos.

---

## 3. Módulos del sistema

### 3.1 CRM Base
- **Leads** — embudo de ventas con pipeline Kanban (6 estados).
- **Contactos** — personas con historial de interacciones.
- **Conversaciones** — vinculadas a contactos/leads, con canal (WhatsApp, WebChat), estado y responsable.
- **Mensajes** — historial con soporte de texto, imagen, audio, documento, ubicación.

### 3.2 Canales
- **WhatsApp Cloud API** — webhook oficial, verificación HMAC, envío/recepción multi-media.
- **Meta Embedded Signup** — conexión de WABA desde UI sin salir de la plataforma.
- **WebChat** — widget embebible con script público.

### 3.3 IA y Asistentes
- **AIOrchestrator** — motor central de IA con OpenAI Responses API.
- **Asistentes configurables** — nombre, instrucciones, modelo, capacidades, modo (human/ai/draft).
- **Router inteligente** — selecciona automáticamente el asistente más adecuado por conversación.
- **Modo demo** — funciona sin `OPENAI_API_KEY` para desarrollo/testing.

### 3.4 Base de Conocimiento (RAG)
- Documentos por organización indexados con `text-embedding-3-small`.
- Búsqueda semántica con `pgvector` — tenant-safe.
- El asistente cita sus fuentes y avisa cuando la evidencia es insuficiente.
- Importación de documentos: manual (CRUD), con soporte preparado para PDF/DOCX/TXT.

### 3.5 Smart Tags y Variables Inteligentes
- Tags: etiquetas configuradas por org, clasificación IA o manual, auto-pause de IA.
- Variables: extracción de datos estructurados de conversaciones (nombre, email, interés, etc.).

### 3.6 Cotizaciones
- Los asistentes pueden generar cotizaciones de forma conversacional.
- No se asume catálogo de precios — proviene del conocimiento de la org.

### 3.7 Automatizaciones
- Triggers: `conversation_created`, `message_received`, `lead_status_changed`, etc.
- Acciones: enviar mensaje, cambiar estado, asignar responsable, agregar tag, crear tarea.
- El motor es **idempotente**: cada dispatch tiene un `event_id` único.
- Las automatizaciones se ejecutan via cron (`POST /api/cron/automations`).

### 3.8 Créditos IA (FASE 26)
- Cada organización tiene una billetera de créditos IA.
- 1 crédito = 1000 tokens (redondeado hacia arriba).
- Se debitan automáticamente al usar la IA en modo OpenAI.
- En modo demo/policy: 0 créditos debitados.
- Planes: Piloto (0 créditos iniciales), Starter (5000), Pro (20000).
- Dashboard de uso en `Settings → Créditos`.

### 3.9 Integration Hub (FASE 27)
- 15 providers: Google (Calendar, Sheets, Drive, Gmail, Ads), Instagram, Facebook, Messenger, Meta Ads, TikTok, MercadoLibre, Tiendanube, Shopify, WooCommerce, Google Ads.
- Cada organización conecta **sus propias cuentas** de cada provider.
- Las credenciales (tokens, API keys) están en una tabla con sin SELECT para `authenticated`.
- Los tools de cada conexión se exponen a los asistentes IA.
- Phase 29 implementará OAuth real; Phase 27 tiene la arquitectura base.

### 3.10 Job Queue y Observabilidad (FASE 28)
- `job_queue` — cola multi-tenant con retry, backoff exponencial y DLQ.
- `event_logs` — log unificado append-only con severity, source, correlation_id y metadata sin secretos.
- `rate_limit_buckets` — rate limiting distribuido por organización.
- Dashboard en `Settings → Estado operativo`.

---

## 4. Reglas del producto que NO se pueden violar

| Regla | Razón |
|---|---|
| La IA no inventa precios, stock ni políticas | La fuente de verdad es el conocimiento de la org |
| Las credenciales no llegan al frontend | Seguridad crítica |
| Cada query filtra por `organization_id` | Multi-tenancy estricto |
| Los asistentes son configurables por la org | No asumimos el rubro del cliente |
| Las automatizaciones son idempotentes | Evitar mensajes duplicados |
| Los jobs tienen `idempotency_key` | Evitar procesamiento doble |
| El modo demo funciona sin API keys | Desarrollo y testing siempre disponibles |
| Los tokens de WhatsApp están cifrados | Cumplimiento y seguridad |

---

## 5. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript |
| Backend | Next.js Server Actions y API Routes |
| Base de datos | Supabase (PostgreSQL 16 + pgvector + Auth + Realtime) |
| IA | OpenAI Responses API (gpt-4o, gpt-5.x) |
| Embeddings | OpenAI text-embedding-3-small |
| Mensajería | WhatsApp Cloud API (Meta Graph API) |
| Hosting | Vercel (web) + Supabase (DB) |
| Monorepo | npm workspaces |
| Tests | Vitest (unit/contract) + Playwright (E2E) |

---

## 6. Estado actual

- **FASE 28 completada** en rama `feature/phase-26-ai-credits`.
- 332 tests pasando (60 archivos).
- Build y deploy:check: OK.
- **Pendiente de PR a main** cuando el equipo lo decida.

Próximas fases: FASE 29 (OAuth real), FASE 30 (Billing automático), v1.0 (pulido final).
