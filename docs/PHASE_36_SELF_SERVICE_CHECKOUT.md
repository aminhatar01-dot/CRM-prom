# FASE 36 — Self-Service Checkout, Compra de Créditos y Cambio de Plan

## Objetivo

Permitir que un cliente pueda ver planes, elegir uno, comprar créditos adicionales y solicitar un upgrade de plan, sin intervención manual cuando hay un proveedor de pagos configurado.

---

## Arquitectura

```
Cliente → /settings/plan  → requestPlanUpgrade() → checkout session → [MP/Stripe redirect | pending request]
Cliente → /settings/credits/buy → purchaseCredits() → checkout session → [MP/Stripe redirect | pending]
                                                            ↓
                                               billing_create_checkout_session (SQL)
                                                            ↓
                                                  billing_invoice (abierta)
                                                            ↓
Webhook MP/Stripe → completeCheckoutSession() → billing_mark_invoice_paid + admin_load_credits
Admin → /admin/billing/requests → adminCompleteCheckoutSession() (modo manual)
```

---

## Tablas nuevas (migración `20260701000000_phase_36_self_service_checkout.sql`)

### `credit_packages`

Paquetes de créditos disponibles para compra:

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | Nombre (ej. "Paquete Pro") |
| `credits` | integer | Cantidad de créditos |
| `price_cents` | integer | Precio en centavos |
| `currency` | text | Moneda (USD) |
| `enabled` | boolean | Si está disponible para compra |

Seed inicial: Básico (10k/$9.99), Pro (50k/$39.99), Business (100k/$69.99)

### `plan_upgrade_requests`

Solicitudes de cambio de plan:

| Campo | Tipo | Descripción |
|---|---|---|
| `organization_id` | uuid | Tenant |
| `requested_by` | uuid | Usuario que solicitó |
| `target_plan_id` | uuid | Plan objetivo |
| `billing_cycle` | text | `monthly` o `annual` |
| `status` | text | `pending → approved/rejected/checkout_pending/completed` |
| `checkout_session_id` | uuid | Session de checkout asociada (si aplica) |
| `approved_by` | uuid | Admin que aprobó |

### Columnas agregadas a tablas existentes

- `billing_checkout_sessions`: + `session_type` (plan_upgrade/credit_purchase), `credits_amount`, `invoice_id`
- `plans`: + `price_usd_annual`

---

## Funciones SQL (SECURITY DEFINER)

| Función | Descripción |
|---|---|
| `billing_create_checkout_session(...)` | Crea sesión de checkout + factura asociada |
| `billing_complete_checkout(session_id, admin_id, idempotency_key)` | Marca sesión completada, paga factura, otorga créditos o activa plan |
| `billing_approve_upgrade_request(request_id, admin_id)` | Aprueba solicitud de upgrade y activa el plan |

---

## Providers y checkout

### Provider `manual` (siempre disponible)

- No requiere credenciales
- Crea checkout session con status `pending`
- Admin debe aprobar manualmente desde `/admin/billing/requests`
- Para créditos: admin completa la sesión → créditos acreditados
- Para plan: admin aprueba la solicitud → plan activado

### Provider `mercado_pago` (opcional)

Variables requeridas:
```env
BILLING_PROVIDER=mercado_pago
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-xxxx
MERCADO_PAGO_WEBHOOK_SECRET=tu-secret
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
```

Flujo:
1. Se crea preferencia en MP con `external_reference = session_id`
2. Cliente redirigido a `init_point` de MP
3. MP llama webhook `/api/webhooks/billing/mercado-pago`
4. Webhook valida firma, obtiene `external_reference` del pago, llama `billing_complete_checkout`
5. Créditos acreditados o plan activado automáticamente

### Provider `stripe` (opcional)

Variables requeridas:
```env
BILLING_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_live_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx
NEXT_PUBLIC_APP_URL=https://tu-dominio.com
```

Flujo:
1. Se crea Stripe Checkout Session con `metadata.session_id`
2. Cliente redirigido a `session.url` de Stripe
3. Stripe llama webhook `/api/webhooks/billing/stripe`
4. Webhook valida firma, extrae `metadata.session_id`, llama `billing_complete_checkout`
5. Créditos acreditados o plan activado automáticamente

---

## Páginas del cliente

### `/settings/plan`

- Muestra plan actual con créditos/mes y precio
- Grid de planes disponibles con features y precio mensual/anual
- Calcula ahorro anual automáticamente
- Si hay provider: botón "Mejorar a X" redirige al checkout externo
- Si no hay provider: botón "Solicitar X" crea solicitud que admin aprueba
- Bloquea doble envío si ya hay solicitud pendiente
- Historial de solicitudes con estado

### `/settings/credits/buy`

- Muestra créditos disponibles con alerta si < 100
- 3 paquetes de créditos con precio y costo por crédito
- Si hay provider: "Comprar ahora" redirige al checkout
- Si no hay provider: "Solicitar paquete" registra solicitud
- Historial de compras recientes

---

## Panel Admin `/admin/billing/requests`

- Estadísticas: solicitudes pendientes, checkouts pendientes, total
- Lista de solicitudes de upgrade con acciones:
  - **Aprobar**: activa el plan inmediatamente
  - **Rechazar**: marca como rechazada
- Lista de checkout sessions con acción:
  - **Marcar pagado**: completa sesión manualmente (otorga créditos/activa plan)

---

## Seguridad

- RLS: org miembros ven solo sus propias solicitudes/sesiones
- `plan_upgrade_requests`: INSERT solo si `requested_by = auth.uid()` y `is_org_member`
- `credit_packages`: SELECT público para autenticados (solo lectura)
- No se exponen tokens de MP/Stripe en respuestas
- Idempotencia estricta: `completeCheckoutSession` es idempotente por session_id
- Webhooks: validación de firma HMAC antes de procesar; deduplicación por `external_id`
- Errores de webhook almacenados en `billing_webhook_events.error_message`

---

## Cómo probar — modo manual

### Compra de créditos

1. Ir a `/settings/credits/buy`
2. Seleccionar "Paquete Pro" → click "Solicitar paquete"
3. Ir a `/admin/billing/requests`
4. En "Checkout sessions" → click "Marcar pagado" en la sesión
5. Verificar en `/settings/billing` o `/settings/credits/buy` que los créditos aumentaron

### Cambio de plan

1. Ir a `/settings/plan`
2. Click "Solicitar Pro" (o Business)
3. Ir a `/admin/billing/requests`
4. En "Solicitudes de cambio de plan" → click "Aprobar"
5. Verificar en `/settings/plan` que el plan cambió

---

## Cómo probar — con Mercado Pago

1. Configurar variables en `.env.local`
2. Ir a `/settings/credits/buy` → click "Comprar ahora"
3. Se redirige al checkout de Mercado Pago
4. Completar pago (usar tarjeta de prueba)
5. MP llama webhook → créditos acreditados automáticamente
6. Verificar en `/settings/billing` los créditos

### Probar webhooks localmente (ngrok)

```bash
ngrok http 3000
# Configurar URL en MP: https://xxxx.ngrok.io/api/webhooks/billing/mercado-pago
```

---

## Cómo probar — con Stripe

1. Configurar variables en `.env.local`
2. Ir a `/settings/credits/buy` → click "Comprar ahora"
3. Se redirige al checkout de Stripe
4. Completar pago con tarjeta `4242 4242 4242 4242`
5. Stripe llama webhook → créditos acreditados

### Probar webhooks localmente (Stripe CLI)

```bash
stripe listen --forward-to localhost:3000/api/webhooks/billing/stripe
# En otra terminal:
stripe trigger checkout.session.completed
```

---

## Variables de entorno

| Variable | Requerida para build | Descripción |
|---|---|---|
| `BILLING_PROVIDER` | ❌ | `manual` (default) / `mercado_pago` / `stripe` |
| `MERCADO_PAGO_ACCESS_TOKEN` | ❌ | Token de acceso MP |
| `MERCADO_PAGO_WEBHOOK_SECRET` | ❌ | Secret para validar firma MP |
| `STRIPE_SECRET_KEY` | ❌ | Clave secreta Stripe |
| `STRIPE_WEBHOOK_SECRET` | ❌ | Secret para validar firma Stripe |
| `NEXT_PUBLIC_APP_URL` | ❌ | URL base para callbacks de checkout |

Ninguna es requerida para que el build o la app funcionen. Sin ellas, el sistema opera en modo manual.

---

## Limitaciones

- Sin provider: el admin debe completar el pago manualmente
- No hay prorate (descuento proporcional) al cambiar de plan a mitad del ciclo
- Las sesiones de checkout expiran a las 24h
- Un solo paquete de créditos por checkout (no multi-paquete)
- Plan Enterprise muestra "Contactar ventas" y crea solicitud como los demás

---

## Archivos creados/modificados

| Archivo | Estado |
|---|---|
| `supabase/migrations/20260701000000_phase_36_self_service_checkout.sql` | Nuevo |
| `apps/web/src/lib/billing/checkout.ts` | Nuevo |
| `apps/web/src/app/(crm)/settings/plan/page.tsx` | Nuevo |
| `apps/web/src/app/(crm)/settings/credits/buy/page.tsx` | Nuevo |
| `apps/web/src/app/admin/billing/requests/page.tsx` | Nuevo |
| `apps/web/src/app/actions/billing.ts` | Extendido — +8 nuevas funciones |
| `apps/web/src/app/api/webhooks/billing/stripe/route.ts` | Actualizado — procesamiento real |
| `apps/web/src/app/api/webhooks/billing/mercado-pago/route.ts` | Actualizado — procesamiento real |
| `apps/web/src/app/admin/billing/page.tsx` | Actualizado — link a solicitudes |
| `apps/web/src/lib/navigation/main-nav.ts` | Actualizado — /settings/plan |
| `packages/database/src/phase36-contract.test.ts` | Nuevo — 84 tests |
| `docs/PHASE_36_SELF_SERVICE_CHECKOUT.md` | Nuevo |
