# Architecture Decision Records — CRM PRO AI

Registro de decisiones de arquitectura tomadas durante el desarrollo.
Cada decisión incluye: **contexto**, **decisión**, **consecuencias** y **fase** en que se tomó.

---

## ADR-001: Vercel + Supabase + Next.js Monorepo

**Fase:** 1  
**Contexto:** Necesitábamos un stack que permitiera iterar rápido en un producto SaaS multi-tenant con IA, sin gestionar servidores.  
**Decisión:** Vercel para el frontend (Next.js 15 App Router) + Supabase para la BD (PostgreSQL + Auth + Realtime + pgvector). Monorepo con npm workspaces.  
**Consecuencias:**
- Build rápido y deploy automático en Vercel.
- Row Level Security en Supabase como capa de aislamiento multi-tenant.
- pgvector disponible nativamente para embeddings RAG.
- Las funciones de servidor (Server Actions) se ejecutan en el edge/serverless de Vercel.
- No hay servidor propio — toda la lógica de negocio vive en Server Actions y API Routes.

---

## ADR-002: RLS multi-tenant en Supabase como capa de seguridad principal

**Fase:** 1  
**Contexto:** En un SaaS multi-tenant, el mayor riesgo es que un tenant vea datos de otro.  
**Decisión:** RLS habilitado en todas las tablas. Las policies usan funciones helper `is_org_member(org_id)` e `is_org_admin(org_id)`. El `organization_id` está en todas las filas de datos de tenant.  
**Consecuencias:**
- Imposible filtrar erróneamente — la BD bloquea el acceso a nivel de fila.
- Cada query debe pasar el JWT del usuario para que RLS pueda evaluarlo.
- Las operaciones server-side que bypasean RLS usan `service_role` (createAdminClient).
- El `service_role` nunca se expone al frontend.

---

## ADR-003: WhatsApp Cloud API directa (no via BSP)

**Fase:** 3  
**Contexto:** Las Business Service Providers (BSP) como Twilio o 360Dialog agregan latencia y costo.  
**Decisión:** Integración directa con Meta WhatsApp Cloud API (Graph API v20+). El webhook oficial recibe eventos directamente.  
**Consecuencias:**
- Menor latencia en recepción de mensajes.
- Control total sobre el flujo de datos.
- Requiere gestionar tokens propios de cada WABA.
- Meta Embedded Signup (FASE 17) automatiza la conexión de WABA sin intervención manual.

---

## ADR-004: Meta Embedded Signup preparado, no dependiente

**Fase:** 17  
**Contexto:** Embedded Signup es el flujo oficial de Meta para conectar WhatsApp desde UI.  
**Decisión:** Implementar Embedded Signup como opción adicional. El sistema funciona sin él usando tokens manuales.  
**Consecuencias:**
- Los clientes pueden conectar WhatsApp sin salir de la plataforma.
- Tokens cifrados con `WHATSAPP_TOKEN_ENCRYPTION_KEY`.
- Si Embedded Signup no está configurado, el flujo manual sigue disponible.

---

## ADR-005: IA server-side con OpenAI Responses API

**Fase:** 16  
**Contexto:** Necesitábamos control total sobre el contexto enviado a la IA, sin filtrar datos entre tenants.  
**Decisión:** Toda la IA corre en Server Actions. El cliente nunca envía el payload completo a OpenAI — el servidor construye el contexto (CRM data + conocimiento + herramientas).  
**Consecuencias:**
- La API key de OpenAI nunca llega al navegador.
- El contexto puede incluir datos privados del CRM sin riesgo.
- El modo demo funciona sin API key real.
- Los logs de IA (modelo, tokens, error) se persisten server-side.

---

## ADR-006: RAG por organización con pgvector

**Fase:** 19  
**Contexto:** Cada organización tiene su propia Base de Conocimiento. Los embeddings no pueden mezclarse entre tenants.  
**Decisión:** `organization_id` en todas las filas de `knowledge_chunks`. La búsqueda semántica filtra por `organization_id` antes de buscar por similaridad coseno.  
**Consecuencias:**
- Tenant-safe por diseño (no solo por aplicación).
- pgvector permite búsqueda eficiente con índice HNSW.
- El modelo `text-embedding-3-small` ofrece buen balance costo/calidad.
- Los documentos se indexan asincrónicamente para no bloquear la UI.

---

## ADR-007: Asistentes multi-rubro configurables

**Fase:** 20  
**Contexto:** El sistema sirve a rubros muy diferentes (e-commerce, servicios, turismo, salud, etc.). No podemos asumir el negocio del cliente.  
**Decisión:** Los asistentes son entidades configurables por la organización: nombre, instrucciones del sistema, modelo, capacidades habilitadas (cotizaciones, tags, variables), modo (human/ai/draft).  
**Consecuencias:**
- El sistema es neutral al rubro.
- El prompt de sistema del asistente es definido por el usuario.
- Las capacidades (herramientas de IA) se habilitan/deshabilitan por asistente.
- El router inteligente selecciona el asistente adecuado automáticamente.

---

## ADR-008: Router inteligente de asistentes

**Fase:** 22  
**Contexto:** Una organización puede tener múltiples asistentes especializados (ventas, soporte, técnico, etc.).  
**Decisión:** El AIOrchestrator evalúa el contexto de la conversación y selecciona el asistente más adecuado usando una llamada LLM rápida de clasificación.  
**Consecuencias:**
- Una conversación puede cambiar de asistente a medida que el contexto evoluciona.
- El equipo puede forzar un asistente específico desde la UI.
- El routing consume créditos adicionales (pequeño overhead).

---

## ADR-009: Cotizaciones como capacidad conversacional del asistente

**Fase:** 23  
**Contexto:** Los clientes querían que el asistente pudiera generar cotizaciones en el chat.  
**Decisión:** Las cotizaciones son una capacidad habilitada en el asistente, no un módulo separado. El asistente usa herramientas para construir la cotización a partir del conocimiento de la org.  
**Consecuencias:**
- No asume un catálogo de precios fijo — usa la Base de Conocimiento.
- Las cotizaciones se generan conversacionalmente.
- El asistente puede pedir más datos antes de cotizar.

---

## ADR-010: Créditos IA por organización (no por usuario)

**Fase:** 26  
**Contexto:** Necesitábamos monetizar el consumo de IA sin facturación automática compleja.  
**Decisión:** Cada organización tiene una billetera de créditos. 1 crédito = 1000 tokens. Los créditos se cargan manualmente o por plan. Se debitan automáticamente al usar la IA en modo OpenAI.  
**Consecuencias:**
- Modelo simple y predecible para el cliente.
- Los costos internos (precio real de OpenAI) nunca se exponen al frontend.
- Las orgs con `is_admin_exempt = true` no se les debitan créditos (útil para cuentas internas).
- En modo demo/policy: 0 créditos debitados.
- La deducción es atómica con `SELECT FOR UPDATE` para evitar race conditions.

---

## ADR-011: Integration Hub como base para OAuth (no como implementación final)

**Fase:** 27  
**Contexto:** Los clientes necesitan conectar cuentas de Google, Instagram, MercadoLibre, etc. OAuth es complejo y cada proveedor es diferente.  
**Decisión:** FASE 27 construye la arquitectura base (tablas, provider registry, executor, UI). Los OAuth flows reales se implementan en FASE 29. Los `executeTool()` en FASE 27 devuelven `HubNotImplementedError`.  
**Consecuencias:**
- La arquitectura de seguridad (sin SELECT en credentials para authenticated) está desde el inicio.
- El provider registry es extensible sin migraciones (código).
- La UI de conexiones y el flujo de conexión funcionan, pero los tokens no se obtienen hasta FASE 29.
- Permite que la arquitectura sea auditada antes de implementar OAuth real.

---

## ADR-012: Job Queue y DLQ en PostgreSQL (no en Redis o SQS)

**Fase:** 28  
**Contexto:** Necesitábamos procesamiento asíncrono confiable sin agregar infraestructura adicional.  
**Decisión:** Job queue implementada en PostgreSQL con `SELECT FOR UPDATE SKIP LOCKED` para atomic claim. DLQ como estado en la misma tabla. Workers vía cron de Vercel.  
**Consecuencias:**
- Sin dependencia de Redis, SQS u otro sistema externo.
- ACID guarantees — los jobs no se pierden.
- `SKIP LOCKED` permite múltiples workers en paralelo sin conflictos.
- El backoff exponencial (60s/300s/900s) se implementa en `scheduled_at`.
- Para volúmenes muy altos (>10k jobs/min), sería necesario migrar a un sistema dedicado.

---

## ADR-013: Event logs como tabla append-only

**Fase:** 28  
**Contexto:** Necesitábamos observabilidad sin complejidad de infraestructura.  
**Decisión:** `event_logs` tabla PostgreSQL append-only. No hay UPDATE ni DELETE policies para `authenticated`. Los secretos se redactan automáticamente antes de insertar.  
**Consecuencias:**
- Audit trail inmutable.
- Sin overhead de Datadog/Sentry durante la fase de crecimiento.
- Requiere política de archivado después de 90 días (pendiente).
- `correlation_id` permite trazar un flujo completo.

---

## ADR-014: No usar main para desarrollo directo

**Fase:** todos  
**Contexto:** `main` representa producción. Pushear directamente a main sin revisión es un riesgo.  
**Decisión:** Todo el desarrollo ocurre en ramas `feature/phase-NN-...`. Los merges a main se hacen via PR con revisión manual.  
**Consecuencias:**
- La rama `feature/phase-26-ai-credits` acumula múltiples fases (26, 27, 28) hasta el PR final.
- Permite rollback seguro si algo sale mal.
- Claude y Codex siempre trabajan en la rama de feature, nunca en main.
