# FASE 27 - Integration Hub

Fecha: 2026-06-28
Rama: feature/phase-26-ai-credits

## 1. Objetivo

Construir la infraestructura reutilizable para que cada organizacion pueda conectar sus propias cuentas externas de forma segura, multi-tenant y extensible.

Esta fase NO implementa los flujos OAuth reales de cada proveedor (eso es FASE 29). Construye la arquitectura base: tablas, provider registry, executor, UI y contratos.

## 2. Arquitectura

```
┌─────────────────────────────────────────────────────┐
│ Integration Hub                                     │
│                                                     │
│  ProviderRegistry ──► HubProvider (interface)       │
│       │                    │                        │
│       │               getToolDefinitions()          │
│       │               executeTool()                 │
│       │               healthCheck()                 │
│       │               disconnect()                  │
│       │               getAuthorizationUrl()         │
│       │                                             │
│  HubExecutor ──► executeHubTool()                   │
│       │         (multi-tenant + error boundary)     │
│       │                                             │
│  Supabase DB                                        │
│  ├── integration_providers (catalog)                │
│  ├── integration_connections (per org/account)      │
│  ├── integration_credentials (server-only)          │
│  ├── integration_connection_logs (audit)            │
│  └── integration_hub_tools (per connection)         │
└─────────────────────────────────────────────────────┘
```

## 3. Tablas nuevas

### `integration_providers`

Catalogo de todos los proveedores soportados. Lo mantiene la plataforma, no el tenant.

| Campo | Tipo | Descripcion |
|---|---|---|
| key | text PK | Slug unico (ej: `google_calendar`) |
| name | text | Nombre display |
| category | text | messaging / ecommerce / productivity / advertising / social / storage / other |
| auth_type | text | oauth2 / api_key / token / webhook / none |
| features | text[] | Capacidades disponibles |
| active | boolean | Si el proveedor esta disponible |

### `integration_connections`

Una fila por cuenta conectada por organizacion. Una organizacion puede tener muchas conexiones al mismo proveedor.

| Campo | Tipo | Descripcion |
|---|---|---|
| id | uuid PK | |
| organization_id | uuid | FK tenant |
| provider_key | text | FK a integration_providers |
| display_name | text | Nombre dado por el usuario (ej: "Instagram principal") |
| status | text | connected / disconnected / expired / requires_auth / error |
| external_account_id | text | ID de la cuenta en el proveedor externo |
| external_account_name | text | Nombre de la cuenta externa |
| scopes | text[] | Permisos otorgados |
| expires_at | timestamptz | Vencimiento del token (si aplica) |
| last_refreshed_at | timestamptz | Ultima renovacion exitosa |
| last_sync_at | timestamptz | Ultima sincronizacion |
| last_error | text | Ultimo mensaje de error |
| metadata | jsonb | Datos adicionales del proveedor |

### `integration_credentials`

**CRITICO DE SEGURIDAD**: Sin grant SELECT para el rol `authenticated`. Solo `service_role` puede leer credenciales.

| Campo | Tipo | Descripcion |
|---|---|---|
| id | uuid PK | |
| connection_id | uuid | FK a integration_connections |
| organization_id | uuid | FK tenant (para borrado cascade) |
| credential_type | text | access_token / refresh_token / api_key / webhook_secret / client_id / client_secret / other |
| encrypted_value | text | Valor cifrado (solo service_role) |
| expires_at | timestamptz | Vencimiento del token |

### `integration_connection_logs`

Audit trail inmutable de todos los eventos de ciclo de vida de una conexion.

Eventos: `connected`, `disconnected`, `refreshed`, `expired`, `error`, `health_check`, `health_ok`, `synced`, `tool_executed`, `credential_stored`, `credential_rotated`.

### `integration_hub_tools`

Herramientas AI-callable registradas por cada conexion. Se crean automaticamente cuando se crea una conexion.

| Campo | Descripcion |
|---|---|
| connection_id | FK a la conexion |
| provider_key | Proveedor |
| tool_key | Clave unica de la herramienta dentro del proveedor |
| name / description | Para mostrar en la UI y al asistente |
| input_schema | Esquema JSON de parametros |
| enabled | Si la herramienta esta habilitada |

## 4. Provider Interface

Todos los proveedores implementan `HubProvider` (en `packages/integrations/src/hub-provider.ts`):

```typescript
interface HubProvider {
  readonly key: string;
  readonly name: string;
  readonly category: ProviderCategory;
  readonly authType: AuthType;
  readonly description: string;
  readonly iconEmoji: string;

  getToolDefinitions(): HubToolDefinition[];
  executeTool(toolKey, input, connection): Promise<HubToolResult>;
  healthCheck(connection): Promise<ConnectionHealth>;
  disconnect(connection): Promise<void>;
  getAuthorizationUrl?(params): string;  // solo oauth2
}
```

## 5. Como agregar un nuevo provider

### Paso 1: Definir la clase en `provider-registry.ts`

```typescript
class MiProviderProvider extends BaseHubProvider {
  readonly key = "mi_provider";
  readonly name = "Mi Provider";
  readonly category = "ecommerce" as const;
  readonly authType = "oauth2" as const;
  readonly description = "Descripcion breve del provider.";
  readonly iconEmoji = "🔧";

  getToolDefinitions(): HubToolDefinition[] {
    return [
      {
        key: "get_orders",
        name: "Obtener pedidos",
        description: "Lista los pedidos del proveedor.",
        inputSchema: {
          limit: { type: "number", description: "Maximo de pedidos" }
        }
      }
    ];
  }
}
```

### Paso 2: Registrarlo en `ALL_PROVIDERS`

```typescript
const ALL_PROVIDERS: HubProvider[] = [
  // ... proveedores existentes ...
  new MiProviderProvider(),
];
```

### Paso 3: Agregar seed en la migracion (o insertar manualmente)

```sql
insert into public.integration_providers (key, name, category, auth_type, description, icon_emoji, features)
values ('mi_provider', 'Mi Provider', 'ecommerce', 'oauth2', 'Descripcion', '🔧', '{orders,products}');
```

### Paso 4: Implementar `executeTool` con la API real (FASE 29)

```typescript
async executeTool(toolKey, input, connection): Promise<HubToolResult> {
  if (toolKey === "get_orders") {
    // Llamar a la API real usando las credenciales de la conexion
    const token = await getConnectionCredential(connection.id, "access_token");
    const data = await fetch("https://api.mi_provider.com/orders", { headers: { Authorization: `Bearer ${token}` } });
    return { success: true, data: await data.json(), durationMs: ... };
  }
  return super.executeTool(toolKey, input, connection); // HubNotImplementedError
}
```

## 6. Como conectar OAuth (FASE 29)

1. Implementar `getAuthorizationUrl()` en el provider.
2. Crear ruta `GET /api/integrations/[provider]/oauth/start` que redirige al proveedor.
3. Crear ruta `GET /api/integrations/[provider]/oauth/callback` que:
   - Intercambia el code por tokens.
   - Guarda tokens en `integration_credentials` via service_role.
   - Actualiza `integration_connections.status = 'connected'`.
   - Registra evento `connected` en logs.
4. El refresh token se renueva automaticamente via cron job.

## 7. Como usar herramientas desde un asistente IA

Las herramientas del hub se exponen a los asistentes igual que las herramientas de Custom Connect:

1. El asistente tiene habilitadas ciertas conexiones/tools.
2. El AIOrchestrator recibe `availableTools` incluyendo herramientas del hub.
3. Cuando el asistente decide usar una herramienta, llama a `executeHubTool()`.
4. El resultado se inyecta en el contexto del siguiente turno.

```typescript
import { executeHubTool } from "@crm-pro-ai/integrations/hub-executor";

const result = await executeHubTool({
  connection: hubConnection,   // HubConnection del tenant
  toolKey: "create_event",
  input: { title: "Reunion", start: "...", end: "..." },
  organizationId: org.id       // multi-tenant guard
});

if (result.success) {
  // usar result.data en el contexto del asistente
} else if (result.notImplemented) {
  // herramienta aun no implementada en Phase 27
}
```

## 8. Proveedores disponibles en FASE 27

| Proveedor | Key | Categoria | Auth | Tools |
|---|---|---|---|---|
| WhatsApp Business | `whatsapp` | messaging | token | - |
| Instagram Business | `instagram` | social | oauth2 | send_dm, get_dms, reply_comment, get_media |
| Facebook Pages | `facebook` | social | oauth2 | send_page_message, get_page_posts, reply_comment |
| Facebook Messenger | `messenger` | messaging | oauth2 | send_message, get_conversations |
| TikTok Business | `tiktok` | social | oauth2 | get_videos, reply_comment |
| Mercado Libre | `mercadolibre` | ecommerce | oauth2 | get_listings, get_questions, answer_question, get_orders, get_stock |
| Tiendanube | `tiendanube` | ecommerce | oauth2 | get_products, get_orders, get_order |
| Shopify | `shopify` | ecommerce | oauth2 | get_products, get_orders, get_customer, get_inventory |
| WooCommerce | `woocommerce` | ecommerce | api_key | get_products, get_orders |
| Gmail | `gmail` | productivity | oauth2 | send_email, search_emails, read_email |
| Google Calendar | `google_calendar` | productivity | oauth2 | create_event, check_availability, list_events |
| Google Sheets | `google_sheets` | productivity | oauth2 | read_rows, append_row, search_rows, update_row |
| Google Drive | `google_drive` | storage | oauth2 | list_files, get_file_url |
| Meta Ads | `meta_ads` | advertising | oauth2 | get_campaigns, get_campaign_insights |
| Google Ads | `google_ads` | advertising | oauth2 | get_campaigns, get_campaign_metrics |

> Todos los `executeTool()` devuelven `HubNotImplementedError` en FASE 27. La implementacion real de cada proveedor se hace en FASE 29 (OAuth framework).

## 9. Seguridad

- `integration_credentials`: **sin SELECT para `authenticated`**. Solo `service_role` puede leer tokens.
- `disconnect_integration_connection()`: SECURITY DEFINER. Borra credenciales y actualiza estado en una transaccion.
- RLS estricto en todas las tablas con `is_org_member` / `is_org_admin`.
- Los tokens nunca se devuelven al navegador.
- Cross-tenant guard en `executeHubTool()`: valida que `connection.organizationId === organizationId`.

## 10. Archivos clave

| Archivo | Proposito |
|---|---|
| `supabase/migrations/20260628170000_phase_27_integration_hub.sql` | Tablas, RLS, funcion disconnect, seeds de proveedores |
| `packages/integrations/src/hub-provider.ts` | Tipos e interfaz HubProvider |
| `packages/integrations/src/provider-registry.ts` | Registry de 15 proveedores con tool definitions |
| `packages/integrations/src/hub-executor.ts` | executeHubTool (multi-tenant, error boundary) |
| `packages/integrations/package.json` | Exports: hub-provider, provider-registry, hub-executor |
| `apps/web/src/lib/integrations/hub.ts` | Helpers Supabase: listConnections, createConnection, disconnect, logs |
| `apps/web/src/app/actions/integration-hub.ts` | Server actions para UI del Hub |
| `apps/web/src/app/(crm)/integrations/hub/page.tsx` | Pagina principal del Hub |
| `apps/web/src/app/(crm)/integrations/hub/[id]/page.tsx` | Detalle de conexion |
| `packages/database/src/phase27-contract.test.ts` | 40+ contract tests |
| `docs/PHASE_27_INTEGRATION_HUB.md` | Esta documentacion |

## 11. Proximas fases

- **FASE 28**: Rate limiting distribuido, DLQ, observabilidad.
- **FASE 29**: OAuth framework real por proveedor (Google, Meta, MercadoLibre).
  - Authorization URLs, callbacks, token exchange, refresh cron.
- **FASE 29+**: Implementar `executeTool()` real en cada provider class.
- **FASE 30**: Billing automatico conectado al ledger de FASE 26.
