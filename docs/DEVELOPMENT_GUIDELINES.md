# Guía de Desarrollo — CRM PRO AI

---

## 1. Flujo Git recomendado

### Ramas

| Rama | Propósito |
|---|---|
| `main` | Producción. Solo se actualiza via PR aprobado. |
| `feature/phase-NN-descripcion` | Desarrollo activo. Nunca se pushea directamente a main. |

**Rama activa:** `feature/phase-26-ai-credits` (contiene FASE 26 + 27 + 28)

### Workflow por fase

```bash
# 1. Confirmar que estás en la rama correcta
git branch --show-current
git status

# 2. Sincronizar
git pull origin feature/phase-26-ai-credits

# 3. Implementar la fase
# (DB → lib → actions → UI → tests → docs)

# 4. Validar todo antes de commitear
npm run lint
npm run test
npm run build
npm run deploy:check

# 5. Agregar archivos específicos (no usar git add -A)
git add supabase/migrations/20260628XXXXXX_phase_NN.sql
git add apps/web/src/lib/...
git add packages/database/src/phaseNN-contract.test.ts
git add docs/PHASE_NN_DESCRIPCION.md

# 6. Commit semántico
git commit -m "feat: implement Phase NN descripción"

# 7. Push solo a la rama de trabajo
git push origin feature/phase-26-ai-credits
```

### PR a main

Solo cuando una fase o conjunto de fases están completas y aprobadas. El PR debe:
- Pasar todos los checks de CI.
- Tener descripción clara de qué se implementó.
- Referenciar los docs de cada fase.

---

## 2. Validaciones obligatorias

Correr en este orden antes de cada commit:

```bash
npm run lint          # 0 errores, 0 warnings (--max-warnings=0)
npm run test          # todos los tests verdes
npm run build         # build exitoso
npm run deploy:check  # 12 PASS, 2 WARN esperados (env vars), 0 FAIL
```

Si falla alguna: **no commitear hasta corregir**.

---

## 3. Comandos frecuentes

```bash
# Desarrollo local
npm run dev                  # Next.js dev server en apps/web

# Base de datos
npm run db:push              # aplica migraciones pendientes (incremental)
npm run db:seed              # seeds iniciales
npm run db:check             # verifica conexión

# Validaciones
npm run lint                 # ESLint con max-warnings=0
npm run test                 # Vitest (contract + unit tests)
npm run build                # build de producción
npm run validate             # lint + test + build
npm run deploy:check         # checklist completo de deploy

# QA (requiere Playwright)
npm run qa:smoke             # smoke tests básicos
npm run qa:e2e               # E2E completo
npm run qa:functional        # flujo funcional CRM
npm run qa:pipeline          # flujo pipeline Kanban
npm run qa:ai:demo           # flujo IA en modo demo
```

---

## 4. Cómo aplicar migraciones

### Local (Supabase local o Docker)
```bash
npx supabase db push --local
```

### Producción / Staging
```bash
npm run db:push
# equivale a: npx supabase db push
```

### NUNCA hacer esto en producción
```bash
npx supabase db reset         # ❌ borra todos los datos
npx supabase db reset --linked  # ❌ destruye la BD en la nube
```

### Naming convention de migraciones
```
supabase/migrations/YYYYMMDDHHMMSS_phase_NN_descripcion.sql
```

Ejemplo: `20260628180000_phase_28_operational_reliability.sql`

Las migraciones son acumulativas y deben poder aplicarse en orden desde cero. **No modificar migraciones ya aplicadas en producción.**

---

## 5. Cómo no romper producción

### Antes de tocar código existente

1. Leer el archivo completo que vas a modificar.
2. Identificar todos los lugares que lo consumen.
3. Si es una función pública de un package, buscar todos los imports.
4. Hacer el cambio mínimo necesario.

### Cambios en la base de datos

- **Agregar columna:** siempre con `DEFAULT` o `nullable`. Nunca `NOT NULL` sin default en tabla con datos.
- **Renombrar columna:** usar `ADD COLUMN + migration + DROP COLUMN` en fases separadas.
- **Eliminar columna:** primero remover todos los usos en código, luego la columna.
- **Cambiar tipo:** requiere migración de datos explícita.

### Cambios en Server Actions

- Los Server Actions son el contrato entre UI y backend.
- Si cambiás la firma de un action, actualizar todos los formularios que lo usan.
- Los redirects en actions deben mantener los query params de error/success.

### Cambios en la IA

- El `AIOrchestrator` en `packages/ai/src/orchestrator.ts` es el motor central.
- Cualquier cambio aquí afecta todos los asistentes de todas las orgs.
- Los cambios en el prompt del sistema deben ser testeados en modo demo primero.

---

## 6. Cómo trabajar entre dos clones locales (Claude + Codex en paralelo)

Si Claude y Codex trabajan simultáneamente:

1. **Un solo estado en origin.** El origen es la fuente de verdad.
2. Antes de empezar: `git pull` siempre.
3. Si hay conflictos: resolver manualmente, correr validaciones, commitear el merge.
4. Nunca sobreescribir trabajo del otro sin leerlo primero.
5. Cada agente debe trabajar en áreas distintas del código para minimizar conflictos.
6. Usar `git status` y `git log --oneline -10` para entender el estado antes de empezar.

---

## 7. Cómo mantener sincronía entre Claude y Codex

El contexto de trabajo se encuentra en estos archivos (siempre actualizados):

| Archivo | Propósito |
|---|---|
| `CLAUDE.md` | Reglas operativas para Claude Code |
| `CODEX.md` | Reglas y checklist de auditoría para Codex |
| `docs/PROJECT_MANIFEST.md` | Visión y reglas del producto |
| `docs/PHASE_INDEX.md` | Qué está implementado, qué falta |
| `docs/ARCHITECTURE_DECISIONS.md` | Por qué las cosas son como son |

**Regla:** si una decisión de arquitectura cambia, actualizar `ARCHITECTURE_DECISIONS.md` en el mismo commit que el cambio.

---

## 8. Patrones de código obligatorios

### Server Actions
```typescript
"use server";
import { requireUser } from "@/lib/auth";
import { getActiveOrganization } from "@/lib/organization";
// ...
const { supabase, user } = await requireUser();
const organization = await getActiveOrganization(supabase, user);
const capabilities = roleCapabilities(organization.role);
if (!capabilities.manageXxx) redirect("/dashboard");
```

### Queries a Supabase (siempre con org filter)
```typescript
// Siempre filtrar por organization_id
const { data } = await supabase
  .from("tabla")
  .select("*")
  .eq("organization_id", organization.id);
```

### Admin client (solo en Server Actions / API routes)
```typescript
import { createAdminClient } from "@/lib/supabase/admin";
const adminSupabase = createAdminClient(); // solo server-side
```

### Event logging (sin secretos)
```typescript
import { logEvent } from "@/lib/observability/event-log";
await logEvent(supabase, {
  eventType: "mi_evento",
  source: "integration",
  severity: "info",
  organizationId: org.id,
  metadata: { /* nunca incluir tokens, passwords, API keys */ },
});
```

### Enqueue job
```typescript
import { enqueueJob, JOB_TYPES } from "@/lib/jobs/queue";
await enqueueJob(adminSupabase, {
  jobType: JOB_TYPES.INTEGRATION_SYNC,
  organizationId: org.id,
  payload: { connectionId: "..." },
  idempotencyKey: `sync:${org.id}:${connectionId}:${date}`,
});
```
