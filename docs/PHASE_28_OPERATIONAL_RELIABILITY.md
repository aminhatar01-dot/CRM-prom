# FASE 28 - Confiabilidad Operativa

Fecha: 2026-06-28
Rama: feature/phase-26-ai-credits

## 1. Objetivo

Preparar CRM PRO AI para producción real: procesamiento asíncrono confiable, reintentos con backoff, Dead Letter Queue, observabilidad unificada, healthcheck extendido y rate limiting distribuido.

## 2. Arquitectura de cola

```
┌───────────────────────────────────────────────────────────┐
│ Job Queue                                                  │
│                                                            │
│  enqueueJob()  ──► job_queue (status: pending)             │
│                                                            │
│  Cron /api/cron/jobs (cada minuto)                         │
│       │                                                    │
│       ▼                                                    │
│  processBatch()                                            │
│       │                                                    │
│       ▼                                                    │
│  claim_next_job() ──► status: running                      │
│       │         (SELECT FOR UPDATE SKIP LOCKED)            │
│       │                                                    │
│       ▼                                                    │
│  getJobHandler(job_type)                                   │
│       │                                                    │
│       ├── success ──► complete_job()                       │
│       │                                                    │
│       └── error  ──► fail_job()                            │
│                          │                                 │
│                          ├── attempts < max ──► pending    │
│                          │   (con backoff exponencial)     │
│                          │                                 │
│                          └── attempts >= max ──► dead_letter│
└────────────────────────────────────────────────────────────┘
```

## 3. Tablas nuevas

### `job_queue`

Cola multi-tenant para trabajos asíncronos.

| Campo | Descripción |
|---|---|
| organization_id | Tenant (nullable para jobs globales) |
| job_type | Tipo de trabajo (ver JOB_TYPES) |
| status | pending / running / completed / failed / dead_letter / cancelled |
| payload | JSON con datos del trabajo |
| attempts | Intentos realizados |
| max_attempts | Máximo (default: 3) |
| scheduled_at | Cuándo puede procesarse (futuro = programado) |
| locked_at / locked_by | Lock del worker activo |
| idempotency_key | Previene duplicados |
| priority | 1-10 (mayor = más urgente, default: 5) |
| correlation_id | Liga eventos relacionados |

### `event_logs`

Log unificado de observabilidad. Append-only.

| Campo | Valores |
|---|---|
| severity | info / warning / error / critical |
| source | whatsapp / ai / integration / automation / knowledge / quote / billing / job / system / webhook / auth |
| correlation_id | Para trazar un flujo completo |
| metadata | JSON libre — NUNCA incluir tokens o secretos |

### `rate_limit_buckets`

Contadores de rate limit distribuido por organización.

Solo accesible via `check_rate_limit()` con service_role.

## 4. Funciones de base de datos

| Función | Descripción |
|---|---|
| `enqueue_job(...)` | Encola un trabajo. Retorna UUID del job o null si ya existe (idempotencia) |
| `claim_next_job(worker_id, job_types[], timeout)` | Atomic SELECT + UPDATE con SKIP LOCKED |
| `complete_job(job_id, result)` | Marca como completado |
| `fail_job(job_id, error, delay_seconds)` | Incrementa intentos; mueve a dead_letter si agota max |
| `retry_dead_letter_job(job_id, org_id)` | Reinicia un job en dead_letter → pending |
| `check_rate_limit(org_id, bucket, limit, window_seconds)` | Atomic UPSERT counter. Retorna true/false |
| `log_event(...)` | Inserta en event_logs |

## 5. Tipos de trabajos (JOB_TYPES)

| Constante | job_type | Descripción |
|---|---|---|
| AUTOMATION_DISPATCH | automation_dispatch | Despachar automatización |
| INTEGRATION_SYNC | integration_sync | Sync de conexión de integración |
| REFRESH_INTEGRATION_TOKEN | refresh_integration_token | Renovar token OAuth |
| EXECUTE_INTEGRATION_TOOL | execute_integration_tool | Ejecutar tool de hub |
| WEBHOOK_PROCESS | webhook_process | Procesar evento de webhook |
| KNOWLEDGE_IMPORT | knowledge_import | Importar documento al RAG |
| QUOTE_GENERATE | quote_generate | Generar cotización async |
| NOTIFICATION_DELIVER | notification_deliver | Entregar notificación |
| SCHEDULED_TASK | scheduled_task | Tarea programada genérica |

## 6. Cómo agregar un nuevo job type

### Paso 1: Agregar la constante

```typescript
// apps/web/src/lib/jobs/queue.ts
export const JOB_TYPES = {
  // ... existentes
  MI_NUEVO_JOB: "mi_nuevo_job",
} as const;
```

### Paso 2: Registrar el handler

```typescript
// apps/web/src/lib/jobs/handlers.ts
registerJobHandler("mi_nuevo_job", async (job) => {
  const { param1, param2 } = job.payload as { param1: string; param2: string };
  // ... lógica del job
  return { success: true, result: { processed: true } };
});
```

### Paso 3: Encolar el job desde tu código

```typescript
import { enqueueJob, JOB_TYPES } from "@/lib/jobs/queue";

const jobId = await enqueueJob(adminSupabase, {
  jobType:        JOB_TYPES.MI_NUEVO_JOB,
  organizationId: org.id,
  payload:        { param1: "valor", param2: "otro" },
  idempotencyKey: `mi_nuevo_job:${org.id}:${uniqueId}`,
  priority:       5,
  correlationId:  traceId,
});
```

## 7. Dead Letter Queue (DLQ)

Un job pasa a `dead_letter` cuando alcanza `max_attempts` fallos consecutivos.

### Monitoreo

`GET /settings/operations` muestra:
- Trabajos en DLQ con su error y fecha de fallo
- Botón "Reintentar" → llama a `retry_dead_letter_job()` (resetea attempts a 0)
- Botón "Cancelar" → marca como `cancelled`

### Reintentar via código

```typescript
import { retryDeadLetterJob } from "@/lib/jobs/queue";

const ok = await retryDeadLetterJob(adminSupabase, jobId, organizationId);
// ok = true si se reinició, false si no existe/no está en dead_letter
```

### Desde la UI

Ir a **Settings → Estado operativo**. Todos los jobs en DLQ aparecen con el botón "Reintentar".

## 8. Observabilidad

### Log de eventos

```typescript
import { logEvent } from "@/lib/observability/event-log";

await logEvent(supabase, {
  eventType:      "integration_sync_failed",
  source:         "integration",
  severity:       "error",
  message:        "Timeout al sincronizar conexión de Google Calendar",
  organizationId: org.id,
  entityType:     "integration_connections",
  entityId:       connectionId,
  correlationId:  traceId,
  metadata: {
    provider: "google_calendar",
    duration_ms: 30000,
    // NUNCA incluir tokens, passwords o claves
  },
});
```

### Claves que se redactan automáticamente

`password`, `token`, `access_token`, `refresh_token`, `api_key`, `secret`, `client_secret`, `webhook_secret`, `encrypted_value`, `key`, `credential`

Si tu metadata incluye alguna de estas claves, el valor se reemplaza por `[REDACTED]` antes de persistir.

## 9. Rate Limiting distribuido

```typescript
import { checkRateLimitOrThrow } from "@/lib/rate-limit/distributed";

// Lanza RateLimitExceededError si se excede el límite
await checkRateLimitOrThrow(adminSupabase, org.id, "ai_calls");

// O verificar sin lanzar
const allowed = await checkDistributedRateLimit(adminSupabase, org.id, "whatsapp_messages");
if (!allowed) return { error: "rate_limited" };
```

### Límites por defecto

| Bucket | Límite | Ventana |
|---|---|---|
| ai_calls | 100 | 60s |
| whatsapp_messages | 200 | 60s |
| automation_dispatch | 500 | 60s |
| integration_tools | 60 | 60s |
| knowledge_import | 10 | 1h |
| webhook_events | 1000 | 60s |
| api_requests | 300 | 60s |

## 10. Healthcheck extendido

`GET /api/health` responde con:

```json
{
  "status": "ok",
  "timestamp": "...",
  "env": { "ok": true, "missing": [], "issues": [] },
  "features": {
    "ai": "openai",
    "whatsappConfigured": true,
    "cronConfigured": true,
    "serviceRoleConfigured": true,
    "integrationHubProviders": 14,
    "lastMigration": "20260628180000_phase_28_operational_reliability"
  },
  "jobQueue": {
    "pending": 0,
    "running": 0,
    "dead_letter": 0
  },
  "credits": {
    "active": true
  }
}
```

El endpoint extendido con `jobQueue` y `credits` requiere Supabase admin client (sólo disponible server-side). El endpoint `/api/health` incluye estos campos cuando los datos están disponibles.

## 11. Cómo monitorear producción

1. **Dashboard**: `Settings → Estado operativo` — healthcheck general + DLQ + errores recientes.
2. **Job Queue**: verificar que `dead_letter = 0`. Si hay jobs en DLQ, revisar el `error_message` y reintentar.
3. **Event Logs**: `event_logs` table con severity `error` / `critical` — integrar alertas con Datadog/Sentry si corresponde.
4. **Rate Limits**: `rate_limit_buckets` table — si hay orgs que saturan buckets frecuentemente, revisar planes.
5. **Cron jobs**: `/api/cron/jobs` debe correr cada minuto. Verificar que `CRON_SECRET` esté configurado.

## 12. Archivos clave

| Archivo | Propósito |
|---|---|
| `supabase/migrations/20260628180000_phase_28_operational_reliability.sql` | 3 tablas + 7 funciones |
| `apps/web/src/lib/jobs/queue.ts` | enqueueJob, getJobQueueStats, retryDeadLetterJob, cancelJob |
| `apps/web/src/lib/jobs/handlers.ts` | Handler registry + 9 job type handlers |
| `apps/web/src/lib/jobs/processor.ts` | processBatch, processNextJob, backoff logic |
| `apps/web/src/lib/observability/event-log.ts` | logEvent, listEventLogs, stripSecrets |
| `apps/web/src/lib/rate-limit/distributed.ts` | checkDistributedRateLimit, checkRateLimitOrThrow |
| `apps/web/src/lib/system/health.ts` | getHealthStatus, getExtendedHealthStatus |
| `apps/web/src/app/api/cron/jobs/route.ts` | Cron endpoint para procesar jobs |
| `apps/web/src/app/actions/operations.ts` | Server actions para dashboard de ops |
| `apps/web/src/app/(crm)/settings/operations/page.tsx` | UI: DLQ + errores + healthcheck |
| `packages/database/src/phase28-contract.test.ts` | 50+ contract tests |

## 13. Próximas fases

- **FASE 29**: OAuth framework real por proveedor. Token refresh via job `refresh_integration_token`.
- **FASE 30**: Billing automático. Job `billing_cycle` en la cola.
- **Alertas**: Conectar `event_logs` severity=critical con Slack/email/PagerDuty.
- **Pruning policy**: Agregar cron para archivar `event_logs` > 90 días.
