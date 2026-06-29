# FASE 31 — Billing Foundation: Facturación SaaS inicial

## Objetivo

Establecer la infraestructura de facturación completa para CRM PRO AI sin romper el sistema existente. El proveedor `manual` está completamente funcional. Mercado Pago y Stripe están preparados arquitectónicamente: webhooks, validación de firma, parsing de eventos y almacenamiento idempotente. No requieren credenciales para build ni para pruebas.

---

## Arquitectura de billing

```
organization → billing_customer → billing_subscription → billing_invoice
                                                      ↓
                                              billing_payment
                                                      ↓
                                          admin_load_credits (ai_credit_wallets)
                                                      ↓
                                             admin_audit_log
```

### Providers soportados

| Provider | Estado | Variables requeridas |
|---|---|---|
| `manual` | ✅ Funcional | Ninguna |
| `mercado_pago` | 🏗 Preparado | `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`, `BILLING_PROVIDER=mercado_pago` |
| `stripe` | 🏗 Preparado | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `BILLING_PROVIDER=stripe` |

---

## Tablas creadas (migración `20260629120000_phase_31_billing_foundation.sql`)

| Tabla | Propósito |
|---|---|
| `billing_customers` | Cliente de billing por org (one-per-org) |
| `billing_subscriptions` | Suscripción de billing con plan, ciclo y estado |
| `billing_invoices` | Facturas con número auto-generado |
| `billing_payments` | Pagos con idempotency_key para evitar duplicados |
| `billing_checkout_sessions` | Sesiones de checkout de provider externo |
| `billing_webhook_events` | Raw events de webhooks (dedup por external_id) |

### RLS por tabla

- `billing_customers`, `billing_subscriptions`, `billing_invoices`, `billing_payments`, `billing_checkout_sessions`: `SELECT` para org miembros; escritura solo via `service_role`.
- `billing_webhook_events`: solo `service_role` — datos crudos nunca expuestos a usuarios.

### SECURITY DEFINER functions

| Función | Propósito |
|---|---|
| `billing_get_or_create_customer(org, provider, email, name)` | Crea o retorna customer |
| `billing_create_invoice(...)` | Crea factura con número INV-YYYYMM-NNNN |
| `billing_mark_invoice_paid(invoice_id, admin_id, method, notes, idempotency_key)` | Marca pagada + registra pago + carga créditos del plan |
| `billing_suspend_org(org_id, reason, admin_id)` | Suspende org en billing + org_subscriptions |
| `billing_reactivate_org(org_id, admin_id)` | Reactiva org en billing + org_subscriptions |
| `billing_record_webhook(provider, external_id, event_type, payload, org_id)` | Almacena webhook idempotentemente |

---

## Flujo manual (proveedor manual)

### Crear y pagar factura desde admin

1. Ir a `/admin/billing` → "Nueva factura"
2. Seleccionar organización, monto en USD, descripción y opcionalmente plan
3. Se crea factura con estado `open`
4. Desde `/admin/billing/invoice/[id]` → "Marcar como pagada"
5. Al pagar:
   - Factura pasa a estado `paid`
   - Se registra `billing_payment` con `idempotency_key = admin-pay-{invoice_id}` (evita doble pago)
   - Si hay suscripción con plan, se cargan los créditos del plan via `admin_load_credits()`
   - Se activa la suscripción con `current_period_end` calculado según ciclo
   - Se registra en `admin_audit_log`

### Suspender / Reactivar org

Desde `/admin/billing/invoice/[id]` o via Server Action directa:
- **Suspender**: actualiza `billing_subscriptions.status = 'suspended'` y `organization_subscriptions.commercial_status = 'suspended'`
- **Reactivar**: revierte ambos a `active`

### Ver desde la org

Ir a `/admin/organizations/[id]` (pestaña billing desde FASE 30) o `/admin/billing` para lista global.

---

## Cómo conectar Mercado Pago

1. Crear cuenta de Mercado Pago y aplicación
2. Obtener `ACCESS_TOKEN` de producción
3. Configurar webhook en MP → URL: `https://tu-dominio.com/api/webhooks/billing/mercado-pago`
4. Generar secret de firma y guardarlo
5. Agregar al `.env.local` (o Vercel env vars):

```env
BILLING_PROVIDER=mercado_pago
MERCADO_PAGO_ACCESS_TOKEN=APP_USR-xxxx
MERCADO_PAGO_WEBHOOK_SECRET=tu-secret
```

6. Implementar lógica de procesamiento en `apps/web/src/app/api/webhooks/billing/mercado-pago/route.ts` (el webhook ya valida firma y almacena eventos — agregar handlers específicos)

### Eventos esperados de MP

| Evento | Acción |
|---|---|
| `payment` con status `approved` | Buscar factura por `external_reference`, marcar pagada |
| `subscription_authorized_payment` | Renovar suscripción, cargar créditos |
| `subscription_preapproval` | Actualizar estado de suscripción |

---

## Cómo conectar Stripe

1. Crear cuenta Stripe
2. Obtener `STRIPE_SECRET_KEY` de producción
3. Configurar webhook en Stripe Dashboard → URL: `https://tu-dominio.com/api/webhooks/billing/stripe`
4. Seleccionar eventos: `invoice.paid`, `customer.subscription.updated`, `customer.subscription.deleted`
5. Copiar el "Signing secret" del webhook
6. Agregar al `.env.local`:

```env
BILLING_PROVIDER=stripe
STRIPE_SECRET_KEY=sk_live_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx
```

7. Implementar handlers en `apps/web/src/app/api/webhooks/billing/stripe/route.ts`

### Eventos esperados de Stripe

| Evento | Acción |
|---|---|
| `invoice.paid` | Marcar factura pagada, cargar créditos |
| `customer.subscription.updated` | Actualizar estado de suscripción |
| `customer.subscription.deleted` | Cancelar suscripción |

---

## Cómo probar webhooks localmente

### Con Stripe CLI

```bash
stripe listen --forward-to localhost:3000/api/webhooks/billing/stripe
stripe trigger invoice.paid
```

### Con Mercado Pago (ngrok)

```bash
ngrok http 3000
# Configurar URL de ngrok en el panel de MP
```

### Prueba de idempotencia

```bash
# Enviar el mismo evento dos veces → segunda vez retorna { "status": "duplicate" }
curl -X POST http://localhost:3000/api/webhooks/billing/stripe \
  -H "stripe-signature: t=...v1=..." \
  -d '{"id": "evt_test123", "type": "invoice.paid", ...}'
```

---

## Cómo probar facturación manual

```bash
# 1. Crear super_admin (si no existe)
# Ver docs/PHASE_30_ADMIN_PLANS_AND_CREDITS.md

# 2. Ir a panel admin
open http://localhost:3000/admin/billing

# 3. Crear factura
open http://localhost:3000/admin/billing/new

# 4. Marcar pagada desde detalle
open http://localhost:3000/admin/billing/invoice/<UUID>

# 5. Verificar créditos en la org
open http://localhost:3000/admin/organizations/<ORG_UUID>
```

---

## Variables de entorno

| Variable | Requerida para build | Propósito |
|---|---|---|
| `BILLING_PROVIDER` | ❌ | `manual` \| `mercado_pago` \| `stripe` (default: `manual`) |
| `MERCADO_PAGO_ACCESS_TOKEN` | ❌ | Acceso a API de Mercado Pago |
| `MERCADO_PAGO_WEBHOOK_SECRET` | ❌ | Validación de firma de webhooks MP |
| `STRIPE_SECRET_KEY` | ❌ | Acceso a API de Stripe |
| `STRIPE_WEBHOOK_SECRET` | ❌ | Validación de firma de webhooks Stripe |

---

## Archivos creados / modificados

| Archivo | Estado |
|---|---|
| `supabase/migrations/20260629120000_phase_31_billing_foundation.sql` | Nuevo |
| `apps/web/src/lib/billing/types.ts` | Nuevo |
| `apps/web/src/lib/billing/core.ts` | Nuevo |
| `apps/web/src/lib/billing/providers.ts` | Nuevo |
| `apps/web/src/app/actions/billing.ts` | Nuevo |
| `apps/web/src/app/api/webhooks/billing/mercado-pago/route.ts` | Nuevo |
| `apps/web/src/app/api/webhooks/billing/stripe/route.ts` | Nuevo |
| `apps/web/src/app/admin/billing/page.tsx` | Nuevo |
| `apps/web/src/app/admin/billing/new/page.tsx` | Nuevo |
| `apps/web/src/app/admin/billing/invoice/[id]/page.tsx` | Nuevo |
| `apps/web/src/app/admin/layout.tsx` | Modificado — agrega "Facturación" al nav |
| `apps/web/src/app/(crm)/settings/billing/page.tsx` | Nuevo |
| `packages/database/src/phase31-contract.test.ts` | Nuevo |
| `docs/PHASE_31_BILLING_FOUNDATION.md` | Nuevo |

---

## Qué queda pendiente (fuera del scope de FASE 31)

- **Checkout externo real**: crear sesión en Stripe/MP y redirigir al cliente (requiere credenciales)
- **Procesamiento automático de webhooks**: handlers específicos por evento (actualmente solo almacenan)
- **Renovación automática**: cron job que detecta `current_period_end` vencido y genera nueva factura
- **Email de factura**: envío de PDF al cliente al crear/pagar factura
- **Portal de cliente Stripe**: link a Stripe Customer Portal para auto-gestión
- **Alertas de pago vencido**: notificación proactiva antes de suspender
- **Créditos proporcionales**: prorate al cambiar de plan a mitad del ciclo
