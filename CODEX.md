# CODEX.md — Instrucciones para Codex (OpenAI)

Este archivo es el punto de entrada para Codex cuando trabaja en CRM PRO AI.
**Leer en orden: este archivo → PROJECT_MANIFEST.md → PHASE_INDEX.md → docs de la última fase.**

---

## 1. Contexto del proyecto

CRM PRO AI es un SaaS multi-tenant de CRM conversacional con IA.
Stack: Next.js 15 (App Router), Supabase (PostgreSQL + Auth + Realtime + pgvector), TypeScript, OpenAI.

Repositorio: monorepo con `apps/web`, `packages/ai`, `packages/database`, `packages/integrations`, `packages/types`, `packages/ui`.

Documentación principal:
- [`docs/PROJECT_MANIFEST.md`](docs/PROJECT_MANIFEST.md) — visión y reglas del producto
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — estructura técnica
- [`docs/ARCHITECTURE_DECISIONS.md`](docs/ARCHITECTURE_DECISIONS.md) — decisiones de arquitectura
- [`docs/PHASE_INDEX.md`](docs/PHASE_INDEX.md) — índice de fases completadas

---

## 2. Rol de Codex en este proyecto

Codex puede actuar en dos modos:

### Modo A: Implementador de fases

Cuando se le pide implementar una fase nueva:
1. Leer `docs/PHASE_INDEX.md` para saber qué existe.
2. Leer la documentación de las últimas 2 fases.
3. Implementar siguiendo los patrones existentes.
4. Nunca romper funcionalidades previas.
5. Correr todas las validaciones antes de commitear.

### Modo B: Auditor de cambios de Claude

Cuando se le pide revisar lo que implementó Claude:
1. Leer el diff o los archivos modificados.
2. Verificar cada punto del checklist de auditoría (sección 4).
3. Reportar: ✅ correcto / ⚠️ revisar / ❌ problema crítico.
4. No sobreescribir cambios sin entender el contexto completo.

---

## 3. Reglas Git — igual que CLAUDE.md

```
NUNCA trabajar en main.
NUNCA hacer push a main.
NUNCA hacer merge a main sin PR.
```

Flujo:
```bash
git branch --show-current   # debe ser feature/phase-NN-...
git status                  # arbol limpio
git pull                    # sincronizar
# implementar
npm run lint && npm run test && npm run build && npm run deploy:check
git add <archivos especificos>
git commit -m "feat: ..."
git push origin feature/phase-26-ai-credits
```

**NUNCA:** `npx supabase db reset` en remoto. Solo `npm run db:push`.

---

## 4. Checklist de auditoría (Modo B)

Cuando Codex audita código nuevo de Claude:

### Seguridad
- [ ] ¿Todas las tablas nuevas tienen RLS habilitado?
- [ ] ¿Las policies usan `is_org_member` o `is_org_admin`?
- [ ] ¿Las credenciales/tokens no tienen SELECT para `authenticated`?
- [ ] ¿`createAdminClient()` solo se usa en Server Actions y API routes?
- [ ] ¿Ningún secreto aparece en logs, metadata o comentarios?
- [ ] ¿`stripSecrets()` se usa antes de insertar en `event_logs`?

### Multi-tenancy
- [ ] ¿Todas las queries filtran por `organization_id`?
- [ ] ¿Los Server Actions obtienen `organization_id` desde `getActiveOrganization()`?
- [ ] ¿Los cross-tenant guards están presentes en hub executor y otras operaciones críticas?

### Funcionalidades previas
- [ ] ¿El build sigue pasando sin errores?
- [ ] ¿Los 332+ tests siguen verdes?
- [ ] ¿El lint pasa con 0 warnings?
- [ ] ¿El healthcheck responde correctamente?
- [ ] ¿El webhook de WhatsApp sigue intacto?

### Calidad de código
- [ ] ¿No hay `any` sin justificación?
- [ ] ¿No hay `console.log` en producción?
- [ ] ¿No hay comentarios que expliquen "qué" hace el código?
- [ ] ¿No hay abstracciones prematuras?
- [ ] ¿Los nombres de funciones y variables son descriptivos?

### Migraciones
- [ ] ¿La migración tiene nombre con timestamp correcto?
- [ ] ¿La migración es incremental (no usa DROP TABLE de tablas existentes)?
- [ ] ¿Las funciones son `security definer` cuando acceden a datos de otro tenant?
- [ ] ¿El `search_path` está fijo en `public` en todas las funciones SECURITY DEFINER?

---

## 5. Cómo continuar una fase

### Contexto mínimo a leer antes de empezar
```
1. docs/PHASE_INDEX.md           → qué existe, qué falta
2. docs/PROJECT_MANIFEST.md      → reglas del producto
3. docs/ARCHITECTURE_DECISIONS.md → por qué las cosas son como son
4. docs/<PHASE_ULTIMA>.md        → contexto de la última fase
5. CLAUDE.md                     → reglas de trabajo
```

### Orden de implementación en cada fase
```
1. Migración SQL (supabase/migrations/)
2. Tipos y librerías (packages/ y apps/web/src/lib/)
3. Server Actions (apps/web/src/app/actions/)
4. Componentes UI (apps/web/src/app/(crm)/)
5. API routes si aplica (apps/web/src/app/api/)
6. Tests de contrato (packages/database/src/phaseNN-contract.test.ts)
7. Documentación (docs/PHASE_NN_*.md)
```

---

## 6. Cómo validar regresiones

```bash
# Tests de unidad e integración
npm run test

# Lint
npm run lint

# Build completo
npm run build

# Checklist de deploy
npm run deploy:check

# Smoke tests (si Playwright está configurado)
npm run qa:smoke
```

Si algún test que antes pasaba ahora falla → revisar qué cambió y corregirlo antes de continuar.

---

## 7. Cómo actuar cuando Claude implementó algo incorrecto

1. Identificar el problema específico (security, multi-tenant, regresión, etc.).
2. Leer el código original para entender la intención.
3. Hacer el fix mínimo necesario — no refactorizar todo.
4. Correr validaciones.
5. Commitear: `fix: correct <descripción del problema>`.
6. Documentar la decisión si es arquitecturalmente relevante en `docs/ARCHITECTURE_DECISIONS.md`.

---

## 8. Fases próximas (roadmap)

- **FASE 29**: OAuth framework real por proveedor (Google, Meta, MercadoLibre). Token exchange, callbacks, refresh cron.
- **FASE 30**: Billing automático conectado al ledger de créditos IA.
- **FASE 31**: WebSocket real-time para Integration Hub (live sync).
- **v1.0**: Pulido final, pruebas de carga, documentación de usuario.

Ver [`docs/ROADMAP.md`](docs/ROADMAP.md) para el roadmap completo.
