# FASE 26 - Creditos IA, Ledger de Consumo y Planes

Fecha: 2026-06-28
Rama: feature/phase-26-ai-credits

## 1. Objetivo

Implementar un sistema de creditos por organizacion que permita:
- Controlar el consumo de IA por cliente antes de llamar a OpenAI.
- Registrar cada operacion en un ledger inmutable con tokens, costo estimado y creditos descontados.
- Bloquear llamadas IA cuando no hay saldo suficiente.
- Mostrar un panel de consumo y saldo en la UI.
- Cargar creditos manualmente desde admin (sin facturacion automatica en esta fase).

## 2. Modelo de datos

### `plans`

Plan comercial base (semilla inicial: Piloto, Starter, Pro).

| Columna | Tipo | Descripcion |
|---|---|---|
| id | uuid | PK |
| name | text | Nombre del plan |
| monthly_credits | integer | Creditos mensuales incluidos |
| max_members / max_documents / max_assistants | integer | Limites por plan |
| features | jsonb | Features habilitadas |
| active | boolean | Si el plan esta disponible |

### `organization_subscriptions`

Una suscripcion por organizacion, gestionada manualmente en FASE 26.

| Columna | Tipo | Descripcion |
|---|---|---|
| organization_id | uuid | FK unica a organizations |
| plan_id | uuid | FK a plans (nullable) |
| status | text | trial / active / suspended / cancelled |
| current_period_start/end | timestamptz | Periodo actual |

### `ai_credit_wallets`

Un saldo por organizacion.

| Columna | Tipo | Descripcion |
|---|---|---|
| organization_id | uuid | FK unica a organizations |
| available_credits | numeric(14,2) | Saldo actual disponible |
| lifetime_credits_loaded | numeric | Total historico cargado |
| lifetime_credits_used | numeric | Total historico consumido |
| low_balance_threshold | numeric | Umbral de alerta |
| is_admin_exempt | boolean | Si es verdadero, omite la verificacion de saldo |

### `ai_usage_ledger`

Registro inmutable de cada operacion IA. Nunca se actualiza, solo se inserta.

| Columna | Tipo | Descripcion |
|---|---|---|
| organization_id | uuid | Tenant |
| assistant_id | uuid | Asistente usado (nullable) |
| conversation_id | uuid | Conversacion (nullable) |
| user_id | uuid | Usuario que disparo la accion |
| ai_log_id | uuid | Referencia al registro en ai_logs |
| provider | text | openai |
| model | text | Modelo usado (gpt-4o, etc.) |
| operation_type | text | reply / test / classification / ... |
| input_tokens | integer | Tokens de entrada reportados |
| output_tokens | integer | Tokens de salida reportados |
| total_tokens | integer | Total |
| estimated_cost_usd | numeric | Costo estimado en USD |
| credits_charged | numeric | Creditos descontados del saldo |
| mode | text | openai / demo / policy |
| idempotency_key | text | Clave unica (evita doble cargo) |

### `credit_adjustments`

Auditoria de cargas manuales y ajustes.

| Columna | Tipo | Descripcion |
|---|---|---|
| organization_id | uuid | Tenant |
| amount | numeric | Monto (positivo = carga, negativo = ajuste) |
| adjustment_type | text | load / refund / correction / bonus / expiry |
| reason | text | Descripcion del motivo |
| actor_id | uuid | Usuario que realizo el ajuste |

## 3. Funciones de base de datos

### `deduct_ai_credits(org_id, credits, idempotency_key)`

Funcion SECURITY DEFINER que descuenta creditos del saldo de forma atomica (SELECT FOR UPDATE).

- Si `is_admin_exempt = true`: retorna true sin descontar.
- Si saldo insuficiente: retorna false (la app ya bloqueo antes de llamar a OpenAI).
- Si `credits = 0` (demo/policy): retorna true sin tocar el saldo.

### `load_ai_credits(org_id, credits, reason, actor_id, external_ref)`

Carga creditos mediante UPSERT en wallet e inserta en `credit_adjustments`.

## 4. Modelo de creditos

- **1 credito = 1000 tokens** (input + output combinados, redondeado hacia arriba).
- Modo `demo` o `policy`: 0 creditos (no llama a OpenAI real).
- Minimo para iniciar una llamada: 5 creditos (`MIN_CREDITS_TO_CALL`).
- Umbral de alerta por defecto: 50 creditos.

### Precios estimados por modelo

| Modelo | Input /1K tokens | Output /1K tokens |
|---|---|---|
| gpt-4o | $0.005 | $0.015 |
| gpt-4o-mini | $0.00015 | $0.0006 |
| gpt-4-turbo | $0.01 | $0.03 |
| gpt-3.5-turbo | $0.0005 | $0.0015 |

Estos precios son estimados y pueden actualizarse en `packages/ai/src/credit-service.ts`.

## 5. Flujo de verificacion y registro

```
1. enforceAIRateLimit()       -- limite de llamadas por minuto
2. checkCreditsOrThrow()      -- verificar saldo (omitido en demo/policy/admin-exempt)
     -> si no hay saldo: InsufficientCreditsError -> redirect a ?error=no-credits
3. orchestrator.generateReply() -- llamada real a OpenAI
4. supabase.from("ai_logs").insert() -- log existente
5. recordAIUsage()            -- ledger + deduccion atomica via RPC
```

Si ocurre `InsufficientCreditsError`, el error se registra en `ai_logs` con `status: "error"` y se redirige con `?error=no-credits`. No se llama a OpenAI.

## 6. Archivos clave

| Archivo | Proposito |
|---|---|
| `supabase/migrations/20260628160000_phase_26_ai_credits.sql` | Migracion completa |
| `packages/ai/src/credit-service.ts` | Calculos de creditos y tipos (sin I/O) |
| `packages/ai/package.json` | Export `./credit-service` |
| `apps/web/src/lib/ai/credits.ts` | Helpers server-side con Supabase |
| `apps/web/src/app/actions/ai.ts` | Integracion en `runAssistantTest` y `suggestConversationReply` |
| `apps/web/src/app/actions/credits.ts` | Server actions para el panel |
| `apps/web/src/app/(crm)/settings/credits/page.tsx` | Panel UI |
| `packages/database/src/phase26-contract.test.ts` | Tests de contrato |

## 7. Seguridad

- `deduct_ai_credits` y `load_ai_credits` son SECURITY DEFINER: solo se invocan con service_role desde el servidor.
- RLS en todas las tablas nuevas con `is_org_member` y `is_org_admin`.
- El saldo disponible es visible al tenant pero la modificacion solo ocurre via funciones controladas.
- Costos internos en USD se registran en ledger pero no se muestran en el panel por defecto (solo creditos).
- No se exponen secretos de OpenAI ni precios internos al navegador.

## 8. Panel de creditos

Ruta: `/settings/credits`

Muestra:
- Saldo disponible (o "Ilimitado" si `is_admin_exempt`).
- Creditos consumidos y costo estimado de las ultimas 50 operaciones.
- Alerta de saldo bajo.
- Historial de ledger (50 filas mas recientes).
- Historial de movimientos de saldo (20 mas recientes).
- Formulario para cargar creditos (solo admin/owner).

## 9. Como probar

### Verificar saldo insuficiente bloquea IA

1. Crear una organizacion de prueba.
2. Asegurarse de que el saldo es 0 (`available_credits = 0`).
3. Ir a `/assistants` -> seleccionar un asistente -> intentar Test.
4. Debe redirigir con `?error=no-credits` sin llamar a OpenAI.

### Verificar consumo registra correctamente

1. Cargar 1000 creditos via el panel `/settings/credits`.
2. Ejecutar un test de asistente en modo OpenAI real.
3. Verificar en Supabase: tabla `ai_usage_ledger` tiene una nueva fila.
4. Verificar `ai_credit_wallets.available_credits` disminuyo.

### Verificar modo demo no consume creditos

1. Configurar `AI_DEMO_MODE=true` en `.env.local`.
2. Ejecutar un test de asistente.
3. Verificar en `ai_usage_ledger`: `mode = "demo"`, `credits_charged = 0`.
4. Verificar que el saldo no cambio.

### Aplicar migracion

```bash
# Aplicar migracion a la base de datos vinculada
npm run db:push

# Verificar tests
npm run test
npm run lint
npm run build
```

## 10. Proximas fases

- **FASE 27**: Renovacion automatica de creditos al inicio de periodo (via plan).
- **FASE 30**: Billing automatico: Mercado Pago o Stripe carga creditos via webhook firmado.
- **Mejora futura**: Reserva transaccional (reserve + settle) para mayor consistencia bajo concurrencia.
- **Mejora futura**: Panel admin interno con vista multi-tenant de consumo.
- **Mejora futura**: Alertas por email cuando el saldo cae bajo el umbral.
