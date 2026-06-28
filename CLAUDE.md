# CLAUDE.md — Instrucciones para Claude Code

Este archivo es leído automáticamente por Claude Code al comenzar cualquier sesión en este repositorio.
**Léelo completo antes de tocar cualquier archivo.**

---

## 1. Qué es este proyecto

CRM PRO AI es un SaaS multi-tenant de CRM conversacional con IA, construido sobre Next.js 15 + Supabase + OpenAI.

**Lee primero:** [`docs/PROJECT_MANIFEST.md`](docs/PROJECT_MANIFEST.md) — visión, reglas y límites del producto.
**Lee después:** [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — estructura del monorepo.
**Lee la fase actual:** ver [`docs/PHASE_INDEX.md`](docs/PHASE_INDEX.md) — qué está implementado.

---

## 2. Reglas Git — OBLIGATORIAS

```
NUNCA trabajar en main.
NUNCA hacer push a main.
NUNCA hacer merge a main sin PR aprobado.
```

Flujo correcto:

```bash
git branch --show-current          # confirmar que NO eres main
git status                         # arbol limpio antes de empezar
git pull                           # sincronizar con origin
# trabajar en feature/phase-NN-...
git add <archivos especificos>
git commit -m "feat: ..."
git push origin feature/phase-NN-...
```

**Rama de trabajo activa:** `feature/phase-26-ai-credits`

---

## 3. Base de datos — reglas críticas

```
NUNCA ejecutar: npx supabase db reset (remoto)
NUNCA ejecutar: supabase db reset --linked
SIEMPRE usar:   npm run db:push    (aplica migraciones incrementales)
```

Cada fase nueva crea **una sola migración nueva** con nombre:
`supabase/migrations/YYYYMMDDHHMMSS_phase_NN_descripcion.sql`

Las migraciones son **irreversibles en producción**. Pensar bien antes de crear columnas o eliminarlas.

---

## 4. Seguridad — reglas no negociables

- **RLS habilitado** en TODAS las tablas nuevas.
- Usar `is_org_member(organization_id)` y `is_org_admin(organization_id)` en las policies.
- Las credenciales externas (tokens, API keys) van en tablas con **sin SELECT para `authenticated`** — solo `service_role`.
- Los secretos (`OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, tokens) **jamás** en frontend, logs, metadata ni comentarios.
- Usar `createAdminClient()` únicamente en Server Actions y API routes — **nunca en Client Components**.
- La función `stripSecrets()` de `event-log.ts` debe usarse en todo metadata que va a `event_logs`.

---

## 5. Multi-tenancy — invariante central

**Cada query a Supabase debe filtrar por `organization_id`.**

```typescript
// CORRECTO
supabase.from("contacts").select("*").eq("organization_id", org.id)

// INCORRECTO — filtra datos de todas las organizaciones
supabase.from("contacts").select("*")
```

El `organization_id` se obtiene siempre de:
```typescript
const { supabase, user } = await requireUser();
const organization = await getActiveOrganization(supabase, user);
// organization.id es el tenant actual
```

---

## 6. Qué NO romper

Antes de commitear, verificar que estas funcionalidades siguen operativas:

| Módulo | Archivo crítico |
|---|---|
| WhatsApp webhook | `apps/web/src/app/api/webhooks/whatsapp/route.ts` |
| Inbox / mensajes | `apps/web/src/app/(crm)/inbox/` |
| IA / Asistentes | `packages/ai/src/orchestrator.ts` |
| RAG / Conocimiento | `apps/web/src/lib/knowledge/` |
| Créditos IA | `apps/web/src/lib/ai/credits.ts` |
| Automatizaciones | `apps/web/src/lib/automation/` |
| Integration Hub | `apps/web/src/lib/integrations/hub.ts` |
| Job Queue | `apps/web/src/lib/jobs/` |
| Healthcheck | `apps/web/src/app/api/health/route.ts` |

---

## 7. Validaciones obligatorias antes de cada commit

```bash
npm run lint        # 0 errores, 0 warnings
npm run test        # todos los tests verdes
npm run build       # build exitoso
npm run deploy:check  # 0 failed
```

Si alguna validación falla → corregir antes de commitear. **Nunca `--no-verify`.**

---

## 8. Estructura del monorepo

```
apps/web/               → Next.js 15 (App Router)
  src/
    app/
      (crm)/            → Rutas protegidas del CRM
      api/              → API routes (webhooks, cron, health)
      actions/          → Server Actions
    lib/
      ai/               → AIOrchestrator, créditos
      automation/       → Motor de automatizaciones
      jobs/             → Job Queue (FASE 28)
      knowledge/        → RAG
      integrations/     → Hub (FASE 27) + WhatsApp + otros
      observability/    → Event logs (FASE 28)
      rate-limit/       → Rate limiting distribuido (FASE 28)
      system/           → Healthcheck
packages/
  ai/                   → Tipos IA, credit-service
  database/             → Tests de contrato por fase
  integrations/         → Hub providers, registry, executor
  types/                → Tipos compartidos
  ui/                   → Componentes Shadcn
supabase/migrations/    → Una migración por fase
docs/                   → Documentación de cada fase
```

---

## 9. Cómo iniciar una fase nueva

1. Confirmar rama y hacer pull.
2. Leer `docs/PHASE_INDEX.md` para entender qué está implementado.
3. Leer docs de la última fase completada.
4. Crear la migración SQL con el número correcto.
5. Implementar en el orden: DB → lib → actions → UI → tests → docs.
6. Correr todas las validaciones.
7. Commitear con mensaje `feat: implement Phase NN ...`.
8. Push a `feature/phase-26-ai-credits`.

---

## 10. Cómo NO actuar

- No inventar datos, precios, stocks, políticas del negocio del cliente.
- No implementar funcionalidades fuera del scope de la fase solicitada.
- No crear abstracciones prematuras o refactors no pedidos.
- No agregar comentarios que expliquen "qué" hace el código (los nombres ya lo dicen).
- No usar `any` sin justificación explícita.
- No dejar `console.log` en producción.
- No hacer `db reset` remoto bajo ninguna circunstancia.
