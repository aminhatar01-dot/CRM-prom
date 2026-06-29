# FASE 30 — Panel Admin, Planes y Créditos

## Objetivo

Panel interno (`/admin`) para que los `super_admin` de la plataforma gestionen organizaciones, planes SaaS, suscripciones y créditos IA. Implementa límites por plan que bloquean la creación de asistentes/automatizaciones cuando se excede la cuota.

---

## Qué se implementó

### Base de datos (`20260629000000_phase_30_admin_plans.sql`)

| Tabla / Función | Propósito |
|---|---|
| `platform_users` | Rol de plataforma (super_admin/support). NO SELECT para `authenticated` — solo service_role |
| `is_super_admin()` | SECURITY DEFINER — verifica si el usuario es super_admin |
| `admin_audit_log` | Log append-only de acciones admin. NO SELECT para `authenticated` |
| `log_admin_action()` | SECURITY DEFINER — inserta en audit log con auth.uid() |
| `admin_load_credits()` | SECURITY DEFINER — acredita créditos + registra en credit_adjustments |
| `admin_set_subscription()` | SECURITY DEFINER — asigna plan+status por slug |
| `get_org_plan_limits()` | SECURITY DEFINER — retorna límites del plan activo de la org |

**Columnas nuevas en `plans`:**
- `slug` (unique, NOT NULL) — identificador estable para código
- `max_automations`, `max_integrations`, `max_storage_mb` — límites adicionales
- `price_usd_monthly` — precio en USD para la UI
- `is_public` — si aparece en la página de pricing pública
- `sort_order` — orden en la UI
- `bypass_limits` — bandera para planes demo/internos

**Columnas nuevas en `organization_subscriptions`:**
- `commercial_status` — `prospect | pilot | active | past_due | suspended | churned`
- `origin` — `organic | referral | outbound | demo | internal`
- `assigned_to` — ID del responsable comercial
- `internal_notes` — notas internas
- `onboarding_completed_at` — timestamp de onboarding completado
- `past_due_since` — tracking de morosidad

**Planes SaaS definidos:**

| Slug | Nombre | Precio | Créditos/mes |
|---|---|---|---|
| `free` | Piloto | $0 | 5,000 |
| `demo` | Demo (bypass_limits) | $0 | 999,999 |
| `starter` | Starter | $49 | 25,000 |
| `pro` | Pro | $99 | 75,000 |
| `business` | Business | $199 | 100,000 |
| `enterprise` | Enterprise | $499 | ilimitado |

---

### Lib (`apps/web/src/lib/admin/`)

**`auth.ts`**
- `requireSuperAdmin()` — verifica super_admin o redirige a `/`
- `isSuperAdmin(userId)` — booleano para verificaciones inline

**`organizations.ts`**
- `listAdminOrganizations(adminSupabase)` — lista con stats (wallet, miembros, WA, onboarding)
- `getAdminOrgDetail(adminSupabase, orgId)` — detalle completo con miembros (emails via auth.admin.listUsers), integraciones, errores recientes, jobs fallidos

**`plans.ts`**
- `listPlans(adminSupabase)` — planes ordenados por sort_order
- `getPlanBySlug(adminSupabase, slug)` — plan por slug
- `checkOrgLimit(adminSupabase, orgId, limitKey, currentCount)` — verifica si se puede crear más, respeta `bypass_limits`

---

### Server Actions (`apps/web/src/app/actions/admin.ts`)

Todas las acciones requieren `requireSuperAdmin()` como primer paso.

| Función | Propósito |
|---|---|
| `adminListOrganizations()` | Lista todas las orgs |
| `adminGetOrganization(id)` | Detalle de una org |
| `adminListPlans()` | Lista todos los planes |
| `adminSetSubscription(formData)` | Cambia plan/status/commercial_status |
| `adminLoadCredits(formData)` | Carga créditos positivos + audit log |
| `adminAdjustCredits(formData)` | Ajuste positivo o negativo de créditos |
| `adminSetAdminExempt(formData)` | Marca org como exenta de créditos |
| `adminGetCreditsOverview()` | Vista global de saldos + consumo reciente |
| `adminGetSystemStatus()` | Stats de sistema: orgs, jobs, errores, saldos bajos |
| `adminGetAuditLog(orgId?)` | Log de auditoría (filtrable por org) |

---

### UI (`apps/web/src/app/admin/`)

| Ruta | Descripción |
|---|---|
| `/admin` | Dashboard con stats de sistema |
| `/admin/organizations` | Lista de organizaciones con estado/créditos/plan |
| `/admin/organizations/[id]` | Detalle: gestionar suscripción, cargar/ajustar créditos, ver miembros/integraciones/errores |
| `/admin/plans` | Vista de todos los planes con límites |
| `/admin/credits` | Overview de saldos + consumo reciente |
| `/admin/system` | Stats de sistema + log de auditoría admin |

---

### Limit enforcement

`createAssistant` en `ai.ts` y `createAutomationRule` en `automations.ts` ahora verifican el límite del plan antes de insertar. Si se excede, redirigen con `?error=plan_limit`.

---

## Cómo crear un super_admin

Ejecutar directamente en la base de datos (requiere service_role o acceso directo):

```sql
INSERT INTO platform_users (user_id, role, is_active, notes, granted_by)
VALUES (
  '<USER_UUID>',   -- UUID del usuario en auth.users
  'super_admin',
  true,
  'Fundador / CEO',
  '<tu-propio-uuid-o-system>'
);
```

O desde el Supabase Dashboard → Table Editor → `platform_users`.

> La tabla tiene RLS: `authenticated` no puede SELECT ni INSERT. Solo `service_role` o via SECURITY DEFINER functions.

---

## Cómo probar el panel admin

1. Crear un super_admin con el SQL de arriba.
2. Navegar a `/admin` — si no eres super_admin, redirige a `/`.
3. Explorar `/admin/organizations` → click en una org → gestionar desde `/admin/organizations/[id]`.
4. Verificar que el audit log en `/admin/system` registra las acciones.

---

## Cómo cargar créditos manualmente

**Desde la UI:**
1. Ir a `/admin/organizations/[id]`
2. En la sección "Cargar créditos": ingresar monto y motivo → Submit.
3. Los créditos se suman al wallet y se registra en `credit_adjustments` + `admin_audit_log`.

**Desde SQL (emergencia):**
```sql
SELECT admin_load_credits(
  '<org-uuid>',
  10000,            -- créditos
  'Carga manual de emergencia',
  '<admin-user-uuid>'
);
```

---

## Archivos creados / modificados

| Archivo | Estado |
|---|---|
| `supabase/migrations/20260629000000_phase_30_admin_plans.sql` | Nuevo |
| `apps/web/src/lib/admin/auth.ts` | Nuevo |
| `apps/web/src/lib/admin/organizations.ts` | Nuevo |
| `apps/web/src/lib/admin/plans.ts` | Nuevo |
| `apps/web/src/app/actions/admin.ts` | Nuevo |
| `apps/web/src/app/admin/layout.tsx` | Nuevo |
| `apps/web/src/app/admin/page.tsx` | Nuevo |
| `apps/web/src/app/admin/organizations/page.tsx` | Nuevo |
| `apps/web/src/app/admin/organizations/[id]/page.tsx` | Nuevo |
| `apps/web/src/app/admin/plans/page.tsx` | Nuevo |
| `apps/web/src/app/admin/credits/page.tsx` | Nuevo |
| `apps/web/src/app/admin/system/page.tsx` | Nuevo |
| `apps/web/src/app/actions/ai.ts` | Modificado — checkOrgLimit en createAssistant |
| `apps/web/src/app/actions/automations.ts` | Modificado — checkOrgLimit en createAutomationRule |
| `packages/database/src/phase30-contract.test.ts` | Nuevo |
| `docs/PHASE_30_ADMIN_PLANS_AND_CREDITS.md` | Nuevo |

---

## Qué queda pendiente (fuera del scope de FASE 30)

- **Auto-billing**: renovación automática de créditos según el plan al inicio de cada ciclo.
- **Stripe integration**: cobro real de suscripciones. Por ahora solo tracking manual.
- **Self-service upgrade**: UI para que los clientes cambien su propio plan.
- **Email alerts**: notificaciones de créditos bajos o suscripción vencida.
- **Support role**: usuarios con role=support en platform_users con acceso read-only al panel.
- **Edición de planes**: UI para modificar límites de planes existentes sin SQL.
