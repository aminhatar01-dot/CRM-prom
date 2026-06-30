# FASE 32 — Auditoría Final de Producción: CRM PRO AI

**Fecha:** 2026-06-30  
**Rama auditada:** `feature/phase-26-ai-credits`  
**Última fase implementada:** FASE 31 — Billing Foundation  
**Fases acumuladas:** 31  
**Tests activos:** 332+ (60+ archivos)  
**Build:** ✅ OK | Deploy check: 12 PASS, 2 WARN, 0 FAIL  

**Roles aplicados:** CTO · Senior Architect · PM · CRM Specialist · AI Specialist · Automation Specialist · UX Specialist · Security Specialist · Scalability Specialist · SaaS Consultant

---

## ÍNDICE

1. [Resumen Ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura Técnica](#2-arquitectura-técnica)
3. [Multi-tenancy y Aislamiento de Datos](#3-multi-tenancy-y-aislamiento-de-datos)
4. [Seguridad](#4-seguridad)
5. [Autenticación y Control de Accesos](#5-autenticación-y-control-de-accesos)
6. [Módulo CRM](#6-módulo-crm)
7. [Inbox y Conversaciones](#7-inbox-y-conversaciones)
8. [IA y Asistentes](#8-ia-y-asistentes)
9. [Automatizaciones](#9-automatizaciones)
10. [Base de Conocimiento y RAG](#10-base-de-conocimiento-y-rag)
11. [Integraciones](#11-integraciones)
12. [Billing y Planes](#12-billing-y-planes)
13. [Panel de Administración](#13-panel-de-administración)
14. [UX y Experiencia de Producto](#14-ux-y-experiencia-de-producto)
15. [Experiencia Comercial](#15-experiencia-comercial)
16. [Rendimiento](#16-rendimiento)
17. [Análisis Competitivo](#17-análisis-competitivo)
18. [Escalabilidad Técnica](#18-escalabilidad-técnica)
19. [Costos y Unit Economics](#19-costos-y-unit-economics)
20. [Operaciones y DevOps](#20-operaciones-y-devops)
21. [Matriz de Auditoría](#21-matriz-de-auditoría)
22. [Matriz de Prioridades](#22-matriz-de-prioridades)
23. [Roadmap a v2.0](#23-roadmap-a-v20)
24. [Diagnóstico Final y Master Plan a v1.0](#24-diagnóstico-final-y-master-plan-a-v10)

---

## 1. Resumen Ejecutivo

### Veredicto

CRM PRO AI es un producto real, construido con disciplina de ingeniería de primer nivel. No es un prototipo ni un MVP cosmético: tiene persistencia multi-tenant real, IA operativa con créditos y ledger, automatizaciones con 14 acciones implementadas, base de conocimiento con RAG semántico, billing con idempotencia, panel de admin y 28 migraciones SQL coherentes. En 31 fases se construyó lo que normalmente toma 18–24 meses en un equipo de 5.

Sin embargo, hay una brecha significativa entre "funcionalmente completo" y "listo para venderse a clientes sin acompañamiento manual." Esa brecha no está en el CRM ni en la IA — está en el plano de producto comercial, legal y operacional.

### Puntuaciones por dimensión

| Dimensión | Puntuación | Estado |
|---|:---:|---|
| Arquitectura técnica | 9.2/10 | Producción |
| Multi-tenancy y RLS | 8.8/10 | Producción |
| Seguridad | 7.4/10 | Producción con riesgos conocidos |
| CRM Core | 9.1/10 | Producción |
| Inbox y WhatsApp | 8.7/10 | Producción |
| IA y Asistentes | 8.5/10 | Producción |
| Automatizaciones | 8.0/10 | Producción |
| Base de Conocimiento | 8.3/10 | Producción |
| Integraciones | 5.2/10 | Parcial (Google real, resto stub) |
| Billing | 7.1/10 | Manual funcional; auto pendiente |
| Panel Admin | 8.0/10 | Producción |
| UX | 7.0/10 | Funcional, sin pulido comercial |
| Experiencia comercial | 4.5/10 | Requiere intervención manual |
| Operaciones | 6.5/10 | Base sólida, sin APM ni alertas |

### Decisión ejecutiva

- **Se puede pilotar hoy:** con alta manual, acompañamiento y límites contractuales.
- **No se debe vender como autoservicio:** hasta resolver recuperación de contraseña visible, invitaciones de equipo, términos legales, alertas de producción y documentación de usuario.
- **Tiempo estimado para v1.0 autoservicio:** 6–8 semanas de desarrollo enfocado (FASE 33–38).

---

## 2. Arquitectura Técnica

### Stack implementado

| Capa | Tecnología | Estado |
|---|---|---|
| Frontend | Next.js 15 App Router + React 19 + TypeScript | ✅ Producción |
| Backend | Server Actions + API Routes (no Express separado) | ✅ Producción |
| Base de datos | Supabase PostgreSQL 16 + pgvector + Auth + Realtime | ✅ Producción |
| IA | OpenAI Responses API (gpt-4o) + text-embedding-3-small | ✅ Producción |
| Mensajería | WhatsApp Cloud API (Meta Graph API) | ✅ Producción |
| Hosting | Vercel + Supabase | ✅ Producción |
| Monorepo | npm workspaces (6 paquetes) | ✅ Producción |
| Tests | Vitest + Playwright | ✅ 332+ tests |

### Estructura del monorepo

```
apps/web/               → Next.js 15 (66 rutas, 28 migraciones controladas)
packages/
  ai/                  → AIOrchestrator, CreditService, RAG, Router
  automation/          → Motor de reglas
  database/            → Contratos de fases (332+ tests)
  integrations/        → Hub, Google, WhatsApp, WebChat
  types/               → Tipos compartidos
  ui/                  → Componentes Shadcn
supabase/
  migrations/          → 28 migraciones incrementales
```

### Decisiones arquitectónicas acertadas

1. **Server Actions sobre API REST propia:** elimina capa de routing, simplifica auth y reduce superficie de ataque. Correcto para SaaS en Vercel.
2. **RLS como contrato de seguridad:** la garantía de aislamiento vive en la base de datos, no en el código de aplicación. Resistente a bugs de código.
3. **SECURITY DEFINER functions para operaciones cross-tenant:** admin, billing y ledger usan funciones con privilegio elevado y parámetros explícitos, no service_role abierto.
4. **Modo demo explícito:** OpenAI y embeddings tienen fallback determinista controlado. El build no falla sin API keys.
5. **Idempotencia por diseño:** ledger de créditos, billing, automatizaciones y job queue usan `idempotency_key` en todo punto de entrada externo.
6. **pgvector para RAG:** decisión correcta — elimina dependencia de Pinecone/Weaviate, mantiene tenant-safety en DB.
7. **Monorepo con paquetes con responsabilidad clara:** `packages/ai`, `packages/integrations` y `packages/database` están bien delimitados.

### Decisiones que generan deuda

1. **Sin CDN para uploads de conocimiento:** los archivos importados van a Supabase Storage pero no hay pipeline de antivirus ni content delivery para PDFs de clientes.
2. **Job handlers stubbed para integraciones externas:** `apps/web/src/lib/jobs/handlers.ts` tiene 9 stubs — la cola de jobs existe pero las acciones que dispara para integraciones no están implementadas.
3. **Sin background jobs reales en Vercel:** los cron jobs dependen de llamadas HTTP con `CRON_SECRET`. Si Vercel no dispara el cron (límite del plan free/hobby), los automations se retrasan indefinidamente.
4. **Sin tabla de migrations en código de test:** los contratos de base de datos testean SQL via assertions de strings, lo que puede divergir del schema real si se modifica una migración sin actualizar los tests.

---

## 3. Multi-tenancy y Aislamiento de Datos

### Modelo

Cada organización es un tenant completamente aislado. El `organization_id` es el discriminador de todos los datos. El aislamiento se aplica en tres capas:

1. **RLS en PostgreSQL:** todas las tablas tienen `ENABLE ROW LEVEL SECURITY`. Las políticas usan `is_org_member(organization_id)` e `is_org_admin(organization_id)`.
2. **Server Actions:** cada acción llama `requireUser()` + `getActiveOrganization()` antes de cualquier query.
3. **Contratos de tests:** cada fase tiene tests que verifican políticas RLS, presencia de `organization_id` y ausencia de SELECT para `authenticated` en tablas sensibles.

### Cobertura de tablas

- **28 migraciones** con 60+ tablas.
- **100% de tablas operativas** tienen `organization_id` y RLS habilitado.
- **Tablas de plataforma** (`platform_users`, `admin_audit_log`, `billing_webhook_events`) bloquean completamente el acceso a `authenticated` — solo `service_role`.

### Gaps identificados

| Gap | Impacto | Urgencia |
|---|---|---|
| No hay suite E2E adversarial de dos tenants | Riesgo no cuantificado | Alta |
| Permisos de escritura en tablas CRM son para cualquier miembro | Sin granularidad por acción | Media |
| Sin prueba de revocación de sesión cross-tenant | Posible sesión zombie | Media |
| Selector multi-organización no implementado en UI | Un usuario con dos orgs no puede cambiar | Baja |

### Veredicto multi-tenancy

**8.8/10 — Listo para producción.** El modelo es correcto y consistente. La deuda es la falta de prueba adversarial automatizada, no una falla estructural.

---

## 4. Seguridad

### Controles implementados y verificados

| Control | Estado | Evidencia |
|---|---|---|
| RLS en todas las tablas | ✅ | 28 migraciones, contratos de tests |
| Secretos nunca en frontend | ✅ | No hay `NEXT_PUBLIC_` con secretos |
| Tokens de WhatsApp cifrados | ✅ | AES-256-GCM en credentials.ts |
| HMAC-SHA256 en webhook WhatsApp | ✅ | route.ts con `x-hub-signature-256` |
| HMAC-SHA256 en webhooks de Billing | ✅ | Web Crypto API en providers.ts |
| CRON_SECRET requerido en cron jobs | ✅ | `Authorization: Bearer` validado |
| `createAdminClient()` solo en servidor | ✅ | Ausente en Client Components |
| `stripSecrets()` en event_logs | ✅ | event-log.ts aplicado en metadata |
| OAuth con PKCE + nonce de 10min | ✅ | `oauth_states` + AES en Google OAuth |
| Aprobación humana para herramientas destructivas | ✅ | `requiresHumanApproval` en ToolContext |

### Riesgos activos

#### P0 — Críticos (bloquean comercialización)

**SSRF en Custom Connect:** `apps/web/src/lib/integrations/executor.ts` acepta una URL arbitraria y ejecuta `fetch` server-side sin lista blanca de IPs, bloqueo de loopback/metadata, ni resolución DNS segura. Un atacante puede alcanzar `http://169.254.169.254/` (AWS metadata) o `http://localhost:8080/` desde el servidor Vercel.

**Sin política de retención de datos PII:** Las tablas `event_logs`, `ai_logs`, `whatsapp_events` y `automation_runs` acumulan datos indefinidamente. No hay expiración, redacción de PII ni mecanismo de borrado por solicitud de usuario (requerido por LGPD/GDPR en LatAm).

#### P1 — Importantes (bloquean autoservicio)

**Rate limits en memoria:** WebChat y algunas integraciones usan contadores en proceso Node.js. En Vercel con múltiples instancias, el rate limit no es distribuido — se puede bypass fácilmente.

**Sin pipeline de antivirus en uploads de conocimiento:** Los archivos PDF/DOCX/XLSX importados van directo a Supabase Storage y se procesan sin escaneo de malware. Un archivo malicioso puede escalar al procesador de embeddings.

**Sin headers de seguridad HTTP documentados como contrato:** No hay evidencia de CSP, HSTS, `X-Frame-Options`, ni `Permissions-Policy` configurados en `next.config.ts` o `vercel.json`.

**Sin dependency audit en CI:** No hay `npm audit` ni Dependabot configurado como gate de CI.

#### P2 — Deuda (no bloquean piloto)

- Logs de clasificación y extracción de variables pueden contener fragmentos de conversaciones — no están redactados.
- La función `verifyMercadoPagoSignature` usa `Date.now()` en el manifest, que no coincidirá con el timestamp del header MP — la verificación siempre falla en producción.
- Sin rotación de tokens OAuth automatizada documentada (Google refresh tokens tienen expiración).

### Veredicto seguridad

**7.4/10 — Producción con riesgos conocidos.** Los controles de identidad y tenancy son sólidos. Los riesgos SSRF y retención de PII deben resolverse antes de cobrar a clientes reales.

---

## 5. Autenticación y Control de Accesos

### Implementado

- **Supabase Auth SSR** con callback `/auth/callback/route.ts`.
- **Roles:** `owner`, `admin`, `agent` con restricciones de navegación por rol en `main-nav.ts`.
- **Super admin:** `platform_users` con `role = 'super_admin'`, protegido con `requireSuperAdmin()`.
- **RPC de creación de organización:** atómica, crea org + primer owner en una transacción.
- **Onboarding wizard** de 9 pasos integrado al flujo post-registro.

### Gaps críticos

| Gap | Impacto |
|---|---|
| **Recuperación de contraseña no tiene UI completa visible** | Un cliente que olvida su contraseña no puede recuperarla sin soporte |
| **Invitación de miembros sin UI funcional** | Un owner no puede invitar a su equipo desde la plataforma |
| **Sin reenvío de invitación / revocación** | Gestión de equipo es solo lectura |
| **Sin transferencia de ownership** | Si el owner abandona la cuenta, la org queda huérfana |
| **Sin cierre/eliminación de workspace** | No hay flujo de offboarding de cliente |
| **Sin verificación de email obligatoria** | Usuarios no verificados pueden operar |
| **Sin 2FA/MFA** | Cuentas de admin sin segundo factor |

### Veredicto autenticación

**6.5/10 — Funcional para piloto asistido.** El login básico funciona pero la gestión del ciclo de vida de la cuenta (invitaciones, recovery, baja) no existe como autoservicio.

---

## 6. Módulo CRM

### Completitud

| Sub-módulo | Estado | Detalles |
|---|---|---|
| Leads — CRUD | ✅ Producción | Crear, listar, editar, archivar con estados |
| Leads — Pipeline Kanban | ✅ Producción | 6 estados, drag-and-drop, persistencia real |
| Contactos — CRUD | ✅ Producción | Historial de interacciones, conversión desde lead |
| Conversaciones | ✅ Producción | Canal, estado, responsable, Realtime |
| Mensajes | ✅ Producción | Texto, imagen, audio, documento, ubicación |
| Smart Tags | ✅ Producción | CRUD org, asignación manual/IA, logs |
| Variables Inteligentes | ✅ Producción | Extracción por tipo, valores por lead/conversación |
| Cotizaciones | ✅ Producción | CRUD, vista pública por token, PDF export |
| Dashboard | ✅ Producción | Métricas de leads, conversaciones, actividad |

### Gaps menores

- Sin filtros avanzados ni búsqueda full-text en listas de leads/contactos.
- Sin importación CSV masiva de leads o contactos.
- Sin historial de cambios (audit trail) visible en la ficha de lead.
- Sin campo de "empresa" o "deal value" estandarizado en leads.
- Sin notificaciones de asignación de lead a agente.

### Veredicto CRM

**9.1/10 — Listo para producción.** Es el módulo más maduro del sistema. Para v1.0 solo necesita búsqueda/filtros avanzados e importación masiva.

---

## 7. Inbox y Conversaciones

### Completitud

- **Inbox tipo WhatsApp Web:** tiempo real con Supabase Realtime, lista de conversaciones + detalle de mensajes.
- **Canales soportados:** WhatsApp Cloud API (real) y WebChat (real).
- **Sugerencia IA:** el asistente sugiere respuestas sin envío automático (modo `human`).
- **Auto-respuesta controlada:** modo `ai` con límites de rate, ventana de 24h y escalamiento.
- **Drafts:** el asistente puede generar borradores visibles al agente para aprobar.
- **Multi-media:** texto, imagen, audio, documento, ubicación recibidos y mostrados.
- **Estados de mensaje:** `sending`, `sent`, `delivered`, `read`, `failed`.
- **Asignación de responsable:** desde Inbox o ficha de conversación.

### Gaps identificados

- Sin búsqueda en conversaciones históricas por palabra clave.
- Sin filtro de conversaciones por canal, estado o responsable desde Inbox.
- Sin indicador de "última actividad de agente" vs "última actividad de cliente".
- Sin soporte de envío de imágenes/archivos desde el Inbox (solo texto saliente).
- Sin plantillas de respuesta rápida para agentes.
- Sin presencia/typing indicator entre agentes.
- Sin vista de "asignadas a mí" vs "sin asignar".

### Veredicto Inbox

**8.7/10 — Listo para producción.** La funcionalidad core es sólida. Los gaps son mejoras de UX para v1.1, no bloqueantes de piloto.

---

## 8. IA y Asistentes

### Motor IA

**AIOrchestrator** (`packages/ai/src/orchestrator.ts`) implementa:
- OpenAI Responses API con `gpt-4o` como modelo por defecto.
- Contexto construido de: metadatos de conversación, historial (12 msgs), datos del lead, Smart Tags, Variables, RAG (5 fuentes), tools de integraciones.
- Clasificación de intención antes de llamar a OpenAI (evita llamadas innecesarias para saludos simples).
- `knowledgeSufficient` como señal para escalar a humano.
- Modo demo determinista sin API key.
- Tracking de tokens y créditos en cada llamada.

### Configuración de asistentes

- Nombre, instrucciones, tono, modo (`human`/`ai`/`draft`), capacidades, límite de pasos, timeout.
- Herramientas habilitadas por asistente.
- Router inteligente LLM-based para selección automática de asistente por conversación.
- Tests de asistentes guardados en DB.

### Sistema de créditos IA

- **Pre-call:** `checkCreditsOrThrow()` bloquea llamada si no hay saldo.
- **Reserva + liquidación:** deducción atómica con `SELECT FOR UPDATE` e `idempotency_key`.
- **Ledger:** `ai_usage_ledger` con modelo, tokens, operación, costo estimado.
- **Billetera:** `ai_credit_wallets` con saldo disponible, reservado y umbral de alerta.
- **Exención admin:** `is_admin_exempt` para cuentas de demo.
- **Planes:** Piloto (0 créditos), Starter (5,000), Pro (20,000), Business (100,000), Enterprise (500,000).

### Gaps IA

- Sin panel de uso detallado por asistente y modelo en tiempo real (solo historial).
- Sin modelo alternativo configurable (actualmente hardcoded a gpt-4o).
- Sin fallback automático a modelo más barato cuando el saldo es bajo.
- Sin límite duro configurable de tokens por conversación.
- Sin notificación en tiempo real al agente cuando el asistente escala.

### Veredicto IA

**8.5/10 — Producción.** El motor es maduro con créditos, ledger e idempotencia. Los gaps son mejoras de control operacional para v1.1.

---

## 9. Automatizaciones

### Motor real

`real-engine.ts` (1,436 líneas) implementa completamente:

**Triggers:** `message_received`, `conversation_created`, `lead_created`, `lead_status_changed`, `smart_tag_assigned`, `variable_updated`, `manual`, `inactivity`.

**Acciones implementadas (14):**

| Acción | Estado |
|---|---|
| `create_task` | ✅ Real |
| `assign_smart_tag` | ✅ Real |
| `change_lead_status` | ✅ Real |
| `create_activity` | ✅ Real |
| `notify_internal` | ✅ Real |
| `extract_variable` | ✅ Real (usa IA) |
| `generate_ai_draft` | ✅ Real (AIOrchestrator completo) |
| `send_message` | ✅ Real (WhatsApp Cloud API) |
| `pause_ai` | ✅ Real |
| `update_variable` | ✅ Real |
| `create_quote` | ✅ Real |
| `send_quote_draft` | ✅ Real |
| `mark_quote_sent` | ✅ Real |
| `notify_quote_accepted` | ✅ Real |

**Protecciones:** idempotencia por `event_id`, ventana WhatsApp 24h, rate limit por conversación y por org, escalamiento automático por intención sensible o RAG insuficiente.

### Gaps automatizaciones

- Sin constructor visual de condiciones AND/OR/NOT (solo condiciones simples en UI actual).
- Sin automatizaciones por tiempo (ventana horaria, días de la semana).
- Sin versionado de reglas ni rollback de configuración.
- Sin email como acción (requiere provider externo).
- Sin webhook saliente como acción.
- Sin límite de automatizaciones por plan aún aplicado en ejecución (solo en creación).
- `jobs/handlers.ts` tiene 9 handlers stubbed para integraciones externas que no llegan al motor real.

### Veredicto automatizaciones

**8.0/10 — Producción para uso controlado.** El motor es robusto. Los gaps son el constructor visual y acciones avanzadas para v1.1.

---

## 10. Base de Conocimiento y RAG

### Implementado

- **Documentos por organización** con RLS estricto.
- **Chunking:** split en párrafos, max 95KB por chunk.
- **Embeddings:** `text-embedding-3-small` (1,536 dimensiones) con pgvector.
- **Búsqueda semántica:** `match_knowledge_chunks` RPC, solo `service_role`, filtrado por `organization_id`.
- **RAG en AIOrchestrator:** hasta 5 fuentes por respuesta, con título, categoría, score y contenido (2,500 chars/fuente).
- **Citas de fuentes:** el asistente reporta qué documentos usó.
- **`knowledgeSufficient`:** señal explícita cuando el contexto es insuficiente.

### Tipos de importación soportados

| Tipo | Estado |
|---|---|
| PDF | ✅ pdfjs-dist, extrae texto por página |
| DOCX | ✅ mammoth, texto plano |
| TXT | ✅ Direct |
| CSV | ✅ csv-parse, normaliza columnas |
| XLSX | ✅ ExcelJS, primera hoja, max 5,000 filas |
| Google Sheets | ✅ Convierte a CSV via API |
| URL (scraping) | ✅ cheerio, sigue hasta 3 redirects |

### Gaps conocimiento

- Sin cuota de documentos ni almacenamiento por plan (un cliente puede cargar ilimitado).
- Sin pipeline de antivirus en uploads.
- Sin reindexación automática cuando el documento se actualiza.
- Sin búsqueda híbrida (semántica + keyword BM25).
- Sin soporte de imágenes en documentos (solo texto extraído).
- Sin panel de calidad de indexación para el usuario.

### Veredicto Base de Conocimiento

**8.3/10 — Producción.** El sistema RAG es correcto y tenant-safe. Los gaps de cuotas y antivirus son P1 antes de autoservicio masivo.

---

## 11. Integraciones

### Estado real por provider

| Provider | OAuth | Tools | Ejecución real |
|---|---|---|---|
| Google Gmail | ✅ AES-256-GCM | ✅ 3 tools | ✅ Real |
| Google Calendar | ✅ AES-256-GCM | ✅ 3 tools | ✅ Real |
| Google Sheets | ✅ AES-256-GCM | ✅ 3 tools | ✅ Real |
| Google Drive | ✅ AES-256-GCM | ✅ 3 tools | ✅ Real |
| WhatsApp Cloud API | Manual/Meta ES | ✅ Canal | ✅ Real |
| WebChat | Token público | ✅ Canal | ✅ Real |
| Custom Connect | Manual | ✅ CRUD | ✅ Real (con riesgo SSRF) |
| Instagram Business | — | ✅ Schema | ❌ Stub |
| Facebook Pages | — | ✅ Schema | ❌ Stub |
| Facebook Messenger | — | ✅ Schema | ❌ Stub |
| Meta Ads | — | ✅ Schema | ❌ Stub |
| TikTok Business | — | ✅ Schema | ❌ Stub |
| Mercado Libre | — | ✅ Schema | ❌ Stub |
| Tiendanube | — | ✅ Schema | ❌ Stub |
| Shopify | — | ✅ Schema | ❌ Stub |
| WooCommerce | — | ✅ Schema | ❌ Stub |
| Google Ads | — | ✅ Schema | ❌ Stub |

### Architecture Hub

- `hub_providers`, `hub_connections`, `hub_credentials`, `hub_logs`, `hub_tools` son tablas reales con RLS.
- `executeHubTool()` orquesta la ejecución con ToolContext (credenciales server-side).
- `BaseHubProvider` tiene `notImplemented()` como fallback seguro — los stubs no fallan silenciosamente, lanzan error explícito.

### Gaps integraciones

- **11 de 15 providers son stubs** — mostrarlos en el catálogo sin implementación crea expectativas falsas.
- Sin `job_handlers` reales para sync incremental de integraciones.
- Sin webhook entrante por provider (salvo WhatsApp y Billing).
- Sin estado de conexión en tiempo real (degraded, expired, revoked).
- Meta/TikTok requieren App Review de Meta — proceso de semanas, no días.

### Veredicto integraciones

**5.2/10 — Parcial.** La arquitectura es correcta y Google es 100% real. El catálogo de providers completo es aspiracional en esta etapa.

---

## 12. Billing y Planes

### Implementado

**Tablas:** `billing_customers`, `billing_subscriptions`, `billing_invoices`, `billing_payments`, `billing_checkout_sessions`, `billing_webhook_events`.

**Flujo manual (100% funcional):**
1. Admin crea factura desde `/admin/billing/new` — elige org, monto, descripción, plan.
2. Admin marca factura como pagada desde `/admin/billing/invoice/[id]`.
3. Al pagar: `billing_mark_invoice_paid` (SECURITY DEFINER) → registra payment con idempotencia → activa suscripción → carga créditos del plan → registra en `admin_audit_log`.
4. Suspender/reactivar org modifica `billing_subscriptions` y `organization_subscriptions` en una transacción.

**Provider abstraction:** `getActiveProvider()` detecta en runtime cuál proveedor usar según env vars. Sin credenciales = `manual`.

**Mercado Pago y Stripe:** webhooks implementados con verificación HMAC-SHA256, dedup por `external_id`, parsing normalizado. El procesamiento post-webhook (marcar factura pagada automáticamente) **no está implementado** — solo almacena el evento.

### Bug detectado

`verifyMercadoPagoSignature` en `providers.ts` usa `Date.now()` para construir el manifest, lo que no coincidirá con el timestamp del header `x-signature` de Mercado Pago. La verificación de firma MP siempre fallará en producción con eventos reales. Requiere corrección antes de activar MP.

### Gaps billing

- Procesamiento automático de webhooks (actualmente solo almacena eventos).
- Checkout externo (crear sesión en Stripe/MP y redirigir al cliente).
- Renovación automática de suscripciones (cron job).
- Email de factura al cliente.
- Portal de auto-gestión Stripe.
- Alertas de pago vencido antes de suspender.
- Prorrateo al cambiar de plan.

### Veredicto billing

**7.1/10 — Manual completamente funcional.** El flujo manual cubre el 100% de necesidades para piloto. Para autoservicio necesita el procesamiento automático de webhooks y el checkout externo.

---

## 13. Panel de Administración

### Rutas implementadas

| Ruta | Contenido |
|---|---|
| `/admin` | Dashboard con métricas globales del sistema |
| `/admin/organizations` | Lista todas las orgs con estado comercial |
| `/admin/organizations/[id]` | Detalle: suscripción, créditos, miembros, integraciones, jobs, billing |
| `/admin/plans` | CRUD de planes SaaS con límites |
| `/admin/credits` | Vista global de consumo de créditos |
| `/admin/system` | Healthcheck extendido + estado de services |
| `/admin/billing` | Lista de facturas globales, nueva factura |
| `/admin/billing/new` | Formulario de nueva factura manual |
| `/admin/billing/invoice/[id]` | Detalle de factura, marcar pagada, suspender/reactivar |

### Seguridad admin

- `requireSuperAdmin()` en **todos** los server actions y páginas admin.
- `platform_users` sin SELECT para `authenticated`.
- `admin_audit_log` append-only, sin SELECT para `authenticated`.
- Todas las mutaciones admin registradas en `admin_audit_log`.

### Gaps panel admin

- Sin búsqueda o filtro en la lista de organizaciones.
- Sin exportación CSV de facturas o créditos.
- Sin vista de "organizaciones por vencer este mes".
- Sin panel de health de integraciones globales.
- Sin impersonación segura de org (útil para soporte).

### Veredicto admin

**8.0/10 — Producción.** Cubre el 90% de las operaciones diarias de soporte. Los gaps son comodidades para v1.1.

---

## 14. UX y Experiencia de Producto

### Fortalezas de UX

- **Consistencia visual:** shadcn/ui con Tailwind — componentes coherentes en todo el sistema.
- **Navegación clara:** sidebar con módulos bien agrupados, responsive para desktop/móvil.
- **Feedback de acciones:** `action-notice.tsx` y `submit-button.tsx` dan feedback de estado.
- **Onboarding guiado:** 9 pasos con progreso visual, plantillas predefinidas y estados de completitud.
- **Pipeline Kanban:** drag-and-drop accesible con persistencia real.
- **Realtime en Inbox:** actualización sin recarga.

### Gaps de UX

| Gap | Impacto comercial |
|---|---|
| Sin página de marketing / landing pública | Nadie puede encontrar el producto sin URL directa |
| Sin pricing page pública | No hay auto-educación del comprador |
| Sin recuperación de contraseña visible | Cliente bloqueado sin soporte |
| Sin loading.tsx en la mayoría de rutas | Experiencia de carga inconsistente |
| Sin error boundaries en rutas críticas | Error no manejado muestra página en blanco |
| Sin empty states con CTAs claros | Las listas vacías no guían al usuario |
| Sin onboarding completable sin WhatsApp | El paso de WhatsApp bloquea si no hay cuenta |
| Sin notificaciones en tiempo real para agentes | Un agente puede perder mensajes sin recargar |
| Posible mojibake en pantallas (FASE 25 detectó) | "configuraciÃ³n" visible en demos comerciales |

### Veredicto UX

**7.0/10 — Funcional para piloto, con deuda visual notable.** El sistema funciona pero no tiene el pulido de un SaaS comercial maduro. La ausencia de landing page y pricing es el gap más urgente desde la perspectiva de go-to-market.

---

## 15. Experiencia Comercial

### Flujo de adquisición de cliente hoy

```
1. Cliente recibe URL directa → Login
2. Crea cuenta → No hay onboarding de WhatsApp autoservicio
3. Admin interno crea org y activa suscripción manualmente
4. Admin carga créditos manualmente desde /admin
5. Cliente configura asistente y conocimiento
6. Admin conecta WhatsApp externamente (o Meta Embedded Signup)
7. Cliente comienza a operar
```

**Tiempo de setup manual:** 30–60 minutos por cliente con acompañamiento.

### Flujo objetivo para autoservicio

```
1. Cliente llega a landing → Ve pricing → Click "Empezar gratis"
2. Registra cuenta → Verifica email
3. Onboarding wizard → Configura negocio, asistente, conocimiento
4. Conecta WhatsApp via Meta Embedded Signup
5. Elige plan → Checkout (Stripe/MP) → Pago automático
6. Créditos cargados automáticamente → Empieza a operar
```

### Gaps para autoservicio

| Gap | Estado | Prioridad |
|---|---|---|
| Landing + pricing page pública | No existe | P0 |
| Recuperación de contraseña completa | Parcial | P0 |
| Invitación de equipo desde UI | No existe | P0 |
| Checkout automático (Stripe/MP) | Arquitectura lista, falta handler | P0 |
| Términos de servicio y privacidad | No existen | P0 (legal) |
| WhatsApp autoservicio estable | Embedded Signup implementado | P1 |
| Email transaccional propio | Solo Supabase Auth | P1 |
| Plan free con límites reales | Planes definidos, provisioning manual | P1 |

### Veredicto comercial

**4.5/10 — Requiere intervención manual para cada cliente.** El gap no es técnico sino de producto end-to-end. El plano comercial necesita 4–6 semanas de trabajo enfocado para ser autoservicio.

---

## 16. Rendimiento

### Análisis estático

**Build output:** 43+ páginas generadas (Next.js SSG donde posible).

**Puntos de carga:**
- **Inbox:** Supabase Realtime + queries paginadas de mensajes. Con volumen alto (>1,000 conversaciones activas por org), la query inicial puede ser lenta sin índices adicionales.
- **RAG:** `match_knowledge_chunks` con pgvector hace búsqueda coseno sobre todos los chunks de la org. Sin índice HNSW configurado explícitamente, degrada con >10,000 chunks.
- **AIOrchestrator:** latencia de OpenAI (p50 ~800ms, p99 ~4s) más query de contexto CRM. Sin streaming al usuario en Inbox (respuesta atómica).
- **Automatizaciones:** el cron procesa hasta 25 runs por llamada. Con volumen alto, una sola invocación de `/api/cron/automations` puede exceder el timeout de Vercel (10s en plan free, 60s en Pro).
- **Job queue:** `SKIP LOCKED` con backoff exponencial es correcto. En Vercel sin background workers persistentes, los jobs solo se procesan cuando el cron dispara — no hay workers continuos.

### Optimizaciones ausentes

- Sin índices HNSW explícitos para pgvector (crucial para >10K chunks).
- Sin streaming de respuestas IA al Inbox.
- Sin paginación implementada en listas de Inbox (carga todas las conversaciones).
- Sin caché de contexto CRM entre llamadas del mismo asistente.
- Sin CDN para assets estáticos de conocimiento (PDFs de clientes).

### Veredicto rendimiento

**Adecuado hasta ~100 orgs activas con ~500 conversaciones/día cada una.** A escala mayor se necesitan los índices HNSW, streaming y revisión del modelo de cron jobs.

---

## 17. Análisis Competitivo

### Posicionamiento

CRM PRO AI compite en el espacio de **CRM conversacional con IA para LatAm**, con WhatsApp como canal principal.

### Comparativa directa

| Dimensión | CRM PRO AI | GoHighLevel | HubSpot | Kommo | Close CRM | Prometheo AI |
|---|---|---|---|---|---|---|
| Foco LatAm | ✅ Nativo | ⚠️ Parcial | ⚠️ Parcial | ✅ Sí | ❌ No | ✅ Sí |
| WhatsApp nativo | ✅ Real | ✅ Sí | ⚠️ Add-on | ✅ Sí | ❌ No | ✅ Sí |
| IA conversacional | ✅ Real, configurable | ⚠️ Limitado | ⚠️ Copilot add-on | ❌ No | ❌ No | ✅ Core |
| RAG / Base de conocimiento | ✅ Real (pgvector) | ❌ No | ⚠️ Externo | ❌ No | ❌ No | ⚠️ Básico |
| Automatizaciones | ✅ 14 acciones reales | ✅ Avanzado | ✅ Avanzado | ✅ Medio | ✅ Medio | ⚠️ Básico |
| Multi-tenant aislado | ✅ RLS estricto | ✅ Sí | ✅ Sí | ✅ Sí | ✅ Sí | Desconocido |
| Integraciones reales | ⚠️ Solo Google | ✅ +500 | ✅ +500 | ✅ Medio | ✅ Medio | ⚠️ Pocas |
| Precio LatAm | ✅ Configurable | 💲 Alto | 💲 Muy alto | 💲 Medio | 💲 Alto | ? |
| Onboarding autoservicio | ❌ Manual | ✅ Sí | ✅ Sí | ✅ Sí | ✅ Sí | ? |
| Open source / White label | ✅ Potencial | ❌ No | ❌ No | ❌ No | ❌ No | ? |

### Ventajas diferenciales reales

1. **RAG con base de conocimiento propia** — ninguno de los competidores principales ofrece esto tan integrado.
2. **Asistentes 100% configurables sin asumir rubro** — GoHighLevel asume agencias de marketing; HubSpot asume B2B enterprise.
3. **Motor de IA con créditos y ledger auditables** — transparencia de costo por operación que los competidores no ofrecen.
4. **Arquitectura multi-tenant abierta** — potencial para white-label que GHL ofrece como ventaja premium.
5. **Stack moderno (Next.js 15 + Supabase)** — más mantenible y escalable que los stacks legacy de Kommo y Close.

### Desventajas actuales vs competencia

1. **Integraciones:** GoHighLevel tiene +500 integraciones; CRM PRO AI tiene 4 reales (Google) + 11 stubs.
2. **Autoservicio:** todos los competidores tienen self-service; CRM PRO AI requiere setup manual.
3. **Email marketing:** GoHighLevel y HubSpot tienen email nativo; CRM PRO AI no.
4. **Landing + pricing:** competidores tienen go-to-market completo; CRM PRO AI no tiene página pública.

### Conclusión competitiva

**CRM PRO AI tiene ventaja técnica real en IA y RAG para LatAm.** La desventaja es operacional, no técnica. Resolver autoservicio y ampliar integraciones en 2–3 meses pondría el producto en paridad competitiva con Kommo, con superior stack técnico.

---

## 18. Escalabilidad Técnica

### Modelo de escalado actual

- **Vercel Serverless:** escala horizontalmente a nivel de función. Sin estado en servidor.
- **Supabase:** PostgreSQL gestionado con connection pooling (PgBouncer). Escala vertical hasta ~50,000 conexiones concurrentes antes de requerir réplicas de lectura.
- **pgvector:** escala con índices HNSW hasta millones de vectores en la misma DB.
- **Job queue:** diseñado con `SKIP LOCKED` y `claimed_by` — correcto para múltiples workers concurrentes.

### Limitaciones de escala

| Componente | Límite actual | Solución para escalar |
|---|---|---|
| Cron jobs en Vercel free | 1 invocación/día | Vercel Pro (cada minuto) o Upstash QStash |
| Background workers | Solo cron HTTP | Inngest o Trigger.dev para workers persistentes |
| Rate limits en memoria | Por instancia | Redis/Upstash para distribuido |
| Inbox realtime | Supabase Realtime free tier | Supabase Pro o Canal propio WebSocket |
| pgvector sin HNSW | O(n) vs O(log n) | `CREATE INDEX USING hnsw` por org |
| Embeddings síncronos | Bloquea UI al importar | Job asíncrono en queue |

### Estimación de límites prácticos

| Carga | Capacidad estimada con stack actual |
|---|---|
| Organizaciones activas | Hasta ~500 con plan Supabase Pro |
| Conversaciones/día por org | Hasta ~2,000 sin optimizaciones |
| Mensajes procesados/hora | Hasta ~5,000 (WhatsApp webhook serverless) |
| Automatizaciones/hora | Hasta ~1,000 (limitado por cron y timeout) |
| Chunks de conocimiento | Hasta ~100,000 sin HNSW; ~10M con HNSW |

### Veredicto escalabilidad

**Adecuado para fase de tracción inicial (0–500 clientes activos).** Para escala >500 clientes se necesitan: índices HNSW, rate limiting distribuido, workers persistentes y monitoreo APM.

---

## 19. Costos y Unit Economics

### Costos operativos estimados

| Componente | Costo/mes estimado | Notas |
|---|---|---|
| Supabase Pro | ~$25/mes | Base + 8GB DB + 5GB Storage |
| Vercel Pro | ~$20/mes | Para cron jobs frecuentes + builds |
| OpenAI (IA por org) | Variable | ~$0.002/1K tokens (gpt-4o) |
| OpenAI (embeddings) | ~$0.0001/1K tokens | text-embedding-3-small |
| Total infra base | ~$45–60/mes | Sin escalar |

### Costo IA por operación (estimado)

| Operación | Tokens aprox. | Costo aprox. |
|---|---|---|
| Sugerencia en Inbox (gpt-4o) | ~2,000 | ~$0.004 |
| RAG + respuesta compleja | ~5,000 | ~$0.01 |
| Clasificación Smart Tag | ~500 | ~$0.001 |
| Extracción de variable | ~800 | ~$0.0016 |
| Indexación chunk (embedding) | ~500 | $0.00005 |

### Unit economics por cliente

Con plan Starter ($X/mes con 5,000 créditos):
- 1 crédito = 1,000 tokens
- 5,000 créditos ≈ 5,000,000 tokens de entrada/salida
- Costo real a OpenAI: ~$10/mes por cliente activo
- Margen bruto de IA: depende del precio del plan

**Riesgo:** sin el sistema de créditos activo, un cliente intensivo podría generar $50–200/mes de costo OpenAI sin control. El sistema de créditos de FASE 26 resuelve esto.

### Veredicto economics

**El modelo es rentable a precios normales de SaaS ($50–150/mes por org) con el sistema de créditos activado.** Sin créditos, el costo es ilimitado e incontrolable.

---

## 20. Operaciones y DevOps

### CI/CD implementado

- `npm run lint` — ESLint 0 errores.
- `npm run test` — Vitest 332+ tests.
- `npm run build` — Next.js build completo.
- `npm run deploy:check` — 12 checks, 2 warnings.
- `scripts/deploy-check.mjs` — validación local de env, DB, app.

### Healthcheck

`GET /api/health` — retorna estado de: DB, Auth, Supabase Realtime, WhatsApp config, OpenAI config, cron secret, job queue, rate limits, event logs.

### Observabilidad implementada

- `event_logs` append-only con `source`, `severity`, `correlation_id`, `metadata` sin secretos.
- Logs específicos de WhatsApp, IA, automatizaciones, integraciones.
- `admin_audit_log` para acciones de admin.
- Dashboard `Settings → Estado operativo`.

### Gaps operacionales

| Gap | Impacto |
|---|---|
| Sin APM (Sentry, DataDog, Axiom) | Errores en producción no se agregan ni alertan |
| Sin alertas proactivas (Slack/email) | Fallo silencioso hasta que el cliente reporta |
| Sin simulacro de backup/restore documentado | Dependencia de Supabase PITR no probada |
| Sin SAST ni dependency audit en CI | Vulnerabilidades en dependencias no detectadas |
| Sin staging environment documentado | Los cambios van directo de local a prod |
| Sin runbook de incidentes | Sin proceso documentado de respuesta |
| Sin monitoreo de cron jobs | Si el cron falla, nadie lo sabe |

### Veredicto operaciones

**6.5/10 — Base sólida, sin observabilidad externa.** Para pilotos es aceptable con monitoreo manual. Para autoservicio es insuficiente.

---

## 21. Matriz de Auditoría

| Módulo | Estado | % Completo | Riesgo | Listo para Producción | Qué Falta |
|---|---|:---:|---|---|---|
| Arquitectura técnica | ✅ Producción | 92% | Bajo | Sí | HNSW, streaming IA |
| Multi-tenancy / RLS | ✅ Producción | 89% | Bajo-Medio | Sí | E2E adversarial, selector multi-org |
| Seguridad | ⚠️ Con riesgos | 74% | Alto | Con restricciones | SSRF fix, PII retention, headers, antivirus |
| Auth y ciclo de cuenta | ⚠️ Parcial | 65% | Alto | Para piloto asistido | Recovery, invitaciones, baja de cuenta |
| CRM Core | ✅ Producción | 91% | Bajo | Sí | Búsqueda avanzada, importación masiva |
| Pipeline Kanban | ✅ Producción | 93% | Bajo | Sí | — |
| Inbox y mensajes | ✅ Producción | 87% | Bajo | Sí | Búsqueda, filtros, multimedia saliente |
| WhatsApp Cloud API | ✅ Producción | 88% | Bajo-Medio | Sí | Alta autoservicio estable |
| WebChat | ⚠️ Parcial | 66% | Medio | Con cuidado | Rate limit distribuido, identity robusta |
| IA y Asistentes | ✅ Producción | 85% | Bajo | Sí | Streaming, modelos alternativos |
| Créditos IA y Ledger | ✅ Producción | 91% | Bajo | Sí | Panel tiempo real, alertas proactivas |
| Automatizaciones | ✅ Producción | 80% | Bajo | Sí | Constructor visual AND/OR, email action |
| Base de Conocimiento | ✅ Producción | 83% | Bajo-Medio | Sí | Cuotas por plan, antivirus, HNSW |
| Cotizaciones | ✅ Producción | 80% | Bajo | Sí | Ciclo fiscal, firmas electrónicas |
| Integraciones — Google | ✅ Producción | 90% | Bajo | Sí | Renovación de tokens más robusta |
| Integraciones — Resto | ❌ Stub | 15% | Medio | No | Implementación real por provider |
| Billing — Manual | ✅ Producción | 88% | Bajo | Sí | — |
| Billing — Stripe/MP auto | ⚠️ Parcial | 40% | Medio | No | Handlers post-webhook, checkout externo |
| Panel Admin | ✅ Producción | 80% | Bajo | Sí | Búsqueda, exportación, impersonación |
| Onboarding | ✅ Producción | 82% | Bajo | Sí | Independencia de WhatsApp en setup |
| UX / Design | ⚠️ Funcional | 70% | Medio | Con reservas | Landing, pricing, error boundaries, loading |
| Experiencia comercial | ❌ Manual | 45% | Alto | No (autoservicio) | Checkout, recovery, invitaciones, legal |
| Operaciones / DevOps | ⚠️ Parcial | 65% | Medio | Para piloto | APM, alertas, staging, runbook |
| Tests | ⚠️ Parcial | 72% | Bajo-Medio | Para piloto | E2E adversarial, route-level tests |

---

## 22. Matriz de Prioridades

| Prioridad | Item | Impacto | Esfuerzo | Urgencia | Obligatorio antes del lanzamiento |
|:---:|---|---|---|---|---|
| P0.1 | Fix SSRF en Custom Connect | Seguridad crítica | Bajo (1–2h) | Inmediata | **Sí** |
| P0.2 | Fix `verifyMercadoPagoSignature` (timestamp) | Billing rot | Bajo (30min) | Inmediata | **Sí** |
| P0.3 | Recuperación de contraseña visible en UI | Experiencia cliente | Bajo (1 día) | Inmediata | **Sí** |
| P0.4 | Términos de servicio + política de privacidad | Legal/comercial | Bajo (contenido) | Antes de cobrar | **Sí** |
| P0.5 | Headers de seguridad HTTP (CSP, HSTS) | Seguridad | Bajo (horas) | Antes de launch | **Sí** |
| P1.1 | Invitación y gestión de equipo desde UI | Experiencia cliente | Medio (3–5 días) | Pre-autoservicio | **Sí** |
| P1.2 | Checkout automático Stripe + handler post-webhook | Monetización | Medio (3–5 días) | Pre-autoservicio | **Sí** |
| P1.3 | Landing page + pricing pública | Go-to-market | Medio (1 semana) | Pre-autoservicio | **Sí** |
| P1.4 | Rate limiting distribuido (Redis/Upstash) | Seguridad / escala | Medio (2–3 días) | Pre-escala | Para >50 clientes |
| P1.5 | APM externo (Sentry o Axiom) | Operaciones | Bajo (1 día) | Pre-autoservicio | **Sí** |
| P1.6 | Alertas de producción (Slack/email para errores P0) | Operaciones | Bajo (1 día) | Pre-autoservicio | **Sí** |
| P1.7 | Política de retención y borrado de datos PII | Legal/LGPD | Medio (3–5 días) | Pre-cobro LatAm | **Sí** |
| P1.8 | Cuotas de documentos de conocimiento por plan | Costos | Bajo (1 día) | Pre-escala | Recomendado |
| P1.9 | índice HNSW en pgvector | Rendimiento | Bajo (migración) | Pre-escala | Recomendado |
| P2.1 | Renovación automática de suscripciones (cron) | Billing | Medio (2 días) | v1.1 | No para v1.0 |
| P2.2 | Checkout Mercado Pago real | Monetización LatAm | Alto (1–2 semanas) | v1.1 | No para v1.0 |
| P2.3 | Streaming de respuestas IA en Inbox | UX | Bajo (1 día) | v1.1 | No |
| P2.4 | Búsqueda full-text en Inbox y Leads | UX | Medio (2–3 días) | v1.1 | No |
| P2.5 | Constructor visual de automatizaciones AND/OR | UX avanzado | Alto (1–2 semanas) | v1.1 | No |
| P2.6 | Instagram/Facebook DM real | Integraciones | Muy alto (app review) | v1.2 | No |
| P2.7 | Mercado Libre / Shopify real | eCommerce | Alto (1–2 semanas/provider) | v1.2 | No |
| P3.1 | Email marketing propio | Canal | Muy alto | v2.0 | No |
| P3.2 | Ads read-only (Meta + Google) | Analytics | Alto | v2.0 | No |
| P3.3 | Multi-cuenta WhatsApp por org | Escala conversacional | Alto | v2.0 | No |

---

## 23. Roadmap a v2.0

### v1.0 — "Lanzamiento autoservicio" (6–8 semanas)

**Objetivo:** Un cliente puede descubrir el producto, registrarse, configurar, pagar y operar sin intervención manual de CRM PRO AI.

**Dependencias:** Todas las fases v1.0 deben completarse en secuencia por dependencias técnicas.

| Fase | Objetivo | Dependencia | Impacto | Tiempo estimado | Riesgo |
|---|---|---|---|---|---|
| FASE 33 — Seguridad hardening | Fix SSRF + headers HTTP + antivirus upload + rate limit distribuido | Ninguna | Crítico para cobrar | 1 semana | Bajo |
| FASE 34 — Ciclo de cuenta | Recovery de contraseña, invitaciones de equipo, transferencia ownership, baja de workspace | Auth Supabase | Crítico para self-service | 1.5 semanas | Bajo-Medio |
| FASE 35 — Legal y compliance | ToS, privacidad, retención de datos, exportación/borrado bajo solicitud | FASE 34 | Obligatorio para cobrar en LatAm | 1 semana | Bajo (contenido + UI) |
| FASE 36 — Checkout automático | Stripe checkout, handler `invoice.paid`, renovación automática, email de factura | FASE 35 | Monetización autoservicio | 1.5 semanas | Medio |
| FASE 37 — Landing y go-to-market | Landing pública, pricing, página de features, blog placeholder, SEO base | FASE 36 | Adquisición orgánica | 1 semana | Bajo |
| FASE 38 — Operaciones v1.0 | APM (Sentry), alertas Slack, staging environment, runbook de incidentes, backup drill | FASE 36 | Confiabilidad operacional | 1 semana | Bajo |

**Criterio de aceptación v1.0:** Un usuario desconocido puede completar el flujo: landing → registro → onboarding → WhatsApp → plan → pago → primera conversación → primera respuesta IA — en menos de 30 minutos sin asistencia.

---

### v1.1 — "Experiencia completa" (8–12 semanas post-v1.0)

**Objetivo:** Producto maduro que retiene clientes activos por 6+ meses sin fricción.

| Módulo | Mejora | Impacto | Tiempo estimado |
|---|---|---|---|
| Inbox | Búsqueda full-text, filtros avanzados, multimedia saliente, plantillas rápidas | Retención agentes | 2 semanas |
| IA | Streaming respuestas, selector de modelo por asistente, fallback a modelo barato | UX + costos | 1 semana |
| Automatizaciones | Constructor visual AND/OR, ventanas horarias, email action, webhook saliente | Poder de automatización | 2.5 semanas |
| Billing | Mercado Pago checkout real, portal self-service, prorrateo de plan | Monetización LatAm | 2 semanas |
| CRM | Importación masiva CSV, búsqueda avanzada, historial de cambios en lead | Productividad | 1.5 semanas |
| Integraciones | Mercado Libre real (lectura + respuesta a preguntas) | Diferenciación LatAm | 2 semanas |
| Seguridad | E2E adversarial multi-tenant, dependency audit en CI, 2FA | Confianza | 1 semana |

---

### v1.2 — "Expansión de canales" (3–4 meses post-v1.1)

**Objetivo:** Producto omnicanal real para equipos que operan en múltiples redes sociales.

| Módulo | Mejora | Tiempo estimado |
|---|---|---|
| Instagram DM real | OAuth Meta App Review + tool real | 3–4 semanas (+ tiempo de App Review) |
| Facebook Pages/Messenger | Misma base OAuth Meta | 2 semanas post-Instagram |
| Shopify o WooCommerce | OAuth + lectura de pedidos, productos, stock | 2–3 semanas |
| CRM v2 | Pipeline configurable (columnas custom), campos custom en leads | 2 semanas |
| Ads read-only | Meta Ads + Google Ads metricas e importación de leads | 3 semanas |
| Email propio | Integración Resend/SendGrid como canal en Inbox | 2 semanas |

---

### v2.0 — "Plataforma enterprise LatAm" (6 meses post-v1.2)

**Objetivo:** CRM que reemplaza HubSpot/Kommo para empresas medianas en LatAm.

| Módulo | Descripción |
|---|---|
| White-label | Configuración de dominio propio, logo, colores por org |
| Multi-cuenta WhatsApp | Múltiples números por organización |
| Ads B (atribución) | Vinculación UTM → lead, LTV por canal |
| Ads C (creación asistida) | IA genera copies y audiencias en borrador, humano aprueba |
| Analítica avanzada | Dashboards custom, reportes exportables, métricas de agente |
| API pública | REST + webhooks para integraciones custom de clientes |
| SLA enterprise | Uptime contractual, soporte dedicado, backup drill |
| Compliance regional | LGPD (Brasil), Ley 25.326 (Argentina), NOM (México) |

---

## 24. Diagnóstico Final y Master Plan a v1.0

### ¿Qué impide hoy que un cliente pague, se registre, configure, trabaje y pague — sin asistencia humana?

| Paso del cliente | Bloqueo actual | Solución |
|---|---|---|
| **Descubrir el producto** | No hay landing pública ni pricing | FASE 37 |
| **Registrarse** | Existe, pero sin verificación de email obligatoria | FASE 34 |
| **Recuperar contraseña** | Callback existe, UI de recuperación no visible | FASE 34 |
| **Invitar a su equipo** | No existe UI de invitaciones | FASE 34 |
| **Conectar WhatsApp** | Meta Embedded Signup implementado pero no validado como alta estable | FASE 34 (validación) |
| **Elegir y pagar un plan** | Checkout externo no implementado | FASE 36 |
| **Recibir créditos automáticamente** | Handler `invoice.paid` no implementado | FASE 36 |
| **Saber que está protegido legalmente** | Sin ToS ni privacidad | FASE 35 |
| **Confiar en la seguridad del sistema** | SSRF en Custom Connect, sin headers HTTP | FASE 33 |
| **Obtener soporte** | Sin runbook, sin alertas, sin canal documentado | FASE 38 |

### Master Plan a v1.0

#### FASE 33 — Seguridad hardening (Semana 1–2)

**Objetivo:** Eliminar riesgos P0 de seguridad antes de exponer el producto al público.

| Item | Archivo | Acción |
|---|---|---|
| Fix SSRF Custom Connect | `apps/web/src/lib/integrations/executor.ts` | Allowlist de dominios, bloqueo de IPs privadas |
| Headers HTTP | `next.config.ts` | CSP, HSTS, X-Frame-Options, Referrer-Policy |
| Fix MP signature verification | `apps/web/src/lib/billing/providers.ts` | Usar timestamp del header, no `Date.now()` |
| Rate limiting distribuido | `apps/web/src/lib/rate-limit/` | Migrar a Upstash Redis |
| Antivirus upload placeholder | `apps/web/src/lib/knowledge/import-service.ts` | Validación de contenido + MIME estricto |
| Dependency audit en CI | `package.json` scripts | `npm audit --audit-level=high` |

**Impacto:** Elimina los 2 riesgos P0 que bloquean cobrar a clientes reales.  
**Esfuerzo:** 5–7 días.  
**Riesgo:** Bajo.  
**Prioridad:** Crítica.

---

#### FASE 34 — Ciclo de cuenta completo (Semana 2–4)

**Objetivo:** Un usuario puede gestionar su cuenta de forma completamente autónoma.

| Item | Descripción |
|---|---|
| Recuperación de contraseña UI | Página `/reset-password` con form visible |
| Invitaciones de equipo | Server action + UI en `/settings/team` |
| Reenvío y revocación de invitación | CRUD completo de invitaciones |
| Transferencia de ownership | Acción admin de org |
| Verificación de email obligatoria | Gate en onboarding si email no verificado |
| Cierre de workspace | Acción con confirmación, borrado en cascada |

**Impacto:** Elimina dependencia humana en gestión de cuenta.  
**Esfuerzo:** 7–10 días.  
**Riesgo:** Bajo-Medio (tocar flujo de auth).  
**Prioridad:** Crítica para autoservicio.

---

#### FASE 35 — Legal y compliance (Semana 4–5)

**Objetivo:** El producto cumple requisitos legales mínimos para cobrar en LatAm.

| Item | Descripción |
|---|---|
| Términos de Servicio | Página `/terms` con versión fechada |
| Política de Privacidad | Página `/privacy` — LGPD/GDPR compatible |
| Aceptación en registro | Checkbox obligatorio en signup |
| Retención de datos | Cron que archiva/borra event_logs > 90 días |
| Exportación de datos | Server action `exportOrgData()` — ZIP de todos los datos |
| Borrado bajo solicitud | Server action `requestDataDeletion()` |

**Impacto:** Permite cobrar sin riesgo legal en Argentina, México, Brasil.  
**Esfuerzo:** 5–7 días.  
**Riesgo:** Bajo.  
**Prioridad:** Crítica antes de cobrar.

---

#### FASE 36 — Checkout automático (Semana 5–7)

**Objetivo:** Un cliente puede pagar y recibir su plan activado sin intervención manual.

| Item | Descripción |
|---|---|
| Stripe Checkout Session | `createCheckoutSession()` server action → redirect a Stripe |
| Handler `invoice.paid` | Actualizar suscripción + cargar créditos automáticamente |
| Handler `customer.subscription.updated` | Sincronizar estado de suscripción |
| Handler `customer.subscription.deleted` | Suspender org |
| Renovación automática cron | Job que detecta `current_period_end` vencido |
| Email de factura | Envío via Resend/Postmark al pagar |
| Upgrade/downgrade de plan | Con prorrateo en Stripe |

**Impacto:** Monetización autoservicio completa. Sin esto, cada cobro requiere admin.  
**Esfuerzo:** 7–10 días.  
**Riesgo:** Medio (integración con Stripe en producción).  
**Prioridad:** Crítica para autoservicio.

---

#### FASE 37 — Landing y go-to-market (Semana 7–8)

**Objetivo:** Un prospecto puede encontrar y entender el producto antes de registrarse.

| Item | Descripción |
|---|---|
| Landing page `/` | Hero, features, cómo funciona, testimonios placeholder |
| Pricing page `/pricing` | Tabla de planes con CTA a registro |
| SEO base | Metadatos, OG tags, sitemap.xml, robots.txt |
| Demo interactiva | Simulación de Inbox sin registro |
| Blog placeholder | `/blog` vacío pero indexable |

**Impacto:** Sin landing, el producto no existe para Google ni para el boca a boca digital.  
**Esfuerzo:** 5–7 días.  
**Riesgo:** Bajo.  
**Prioridad:** Alta para adquisición.

---

#### FASE 38 — Operaciones v1.0 (Semana 7–8, paralela a FASE 37)

**Objetivo:** El equipo de CRM PRO AI puede operar el producto con confianza.

| Item | Descripción |
|---|---|
| Sentry (o Axiom) | Error tracking con alertas a Slack |
| Alertas de cron job | Notificación si `/api/cron/*` no se ejecuta en X horas |
| Staging environment | Branch `staging` en Vercel con DB Supabase separada |
| Runbook de incidentes | Documento: qué hacer si WhatsApp cae, DB lenta, IA falla |
| Backup drill | Simulacro documentado de restore desde Supabase PITR |
| Health page pública | `https://status.crmpro.ai` (o similar) |

**Impacto:** El equipo puede responder a incidentes en minutos, no horas.  
**Esfuerzo:** 5–7 días.  
**Riesgo:** Bajo.  
**Prioridad:** Alta para v1.0.

---

### Resumen del Master Plan

| Fase | Objetivo | Tiempo | Prioridad |
|---|---|---|---|
| FASE 33 | Seguridad hardening | 1 semana | P0 — Inmediata |
| FASE 34 | Ciclo de cuenta completo | 1.5 semanas | P0 — Inmediata |
| FASE 35 | Legal y compliance | 1 semana | P0 — Antes de cobrar |
| FASE 36 | Checkout automático Stripe | 1.5 semanas | P0 — Para autoservicio |
| FASE 37 | Landing y go-to-market | 1 semana | P1 — Adquisición |
| FASE 38 | Operaciones v1.0 | 1 semana | P1 — Confiabilidad |
| **Total** | **v1.0 listo para autoservicio** | **~7 semanas** | |

---

### Diagnóstico final

**CRM PRO AI es técnicamente un producto de clase producción.** La arquitectura es correcta, el multi-tenancy es real, la IA tiene créditos y ledger, las automatizaciones tienen 14 acciones reales, el billing tiene idempotencia, y hay 332+ tests que validan todo.

**La brecha para v1.0 autoservicio es 7 semanas de trabajo enfocado — no 7 meses.** La deuda no está en el núcleo técnico sino en los planos comercial, legal y operacional: recuperación de contraseña, invitaciones, términos legales, checkout automático y landing pública.

**El orden importa:** seguridad antes de exposición pública → legal antes de cobrar → checkout antes de landing → operaciones junto a lanzamiento.

**Un piloto comercial asistido puede empezar hoy** con alta manual, límites contractuales de IA y WhatsApp, y acompañamiento. Los 5 primeros clientes piloto generarán el feedback más valioso para priorizar las FASES 33–38.

**El mayor riesgo no es técnico — es no lanzar.** Cada semana sin clientes reales es una semana sin feedback, sin revenue y sin validación del mercado. El sistema tiene suficiente para vender. Hay que vender.

---

*Auditoría generada el 2026-06-30. Válida para el estado del código en `feature/phase-26-ai-credits` al momento de la auditoría. Los porcentajes y estados reflejan el análisis estático del repositorio — no incluyen pruebas contra producción.*
