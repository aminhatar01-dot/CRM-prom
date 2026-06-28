# FASE 29: Google Workspace OAuth

## Resumen

OAuth real por organización para Gmail, Google Calendar, Google Sheets y Google Drive.
Cada organización conecta sus propias cuentas de Google. Los tokens se cifran AES-256-GCM server-side.

## Arquitectura

```
Browser
  └─ GET /api/integrations/google/start?provider=gmail
       ├─ Genera nonce en oauth_states (Supabase)
       └─ Redirige → Google OAuth consent screen
  └─ GET /api/integrations/google/callback?code=...&state=NONCE
       ├─ claim_oauth_state() — valida y marca nonce usado (atómico)
       ├─ exchangeGoogleCode() — intercambia code por tokens
       ├─ Upsert integration_connection
       └─ storeCredential() — cifra y persiste access_token + refresh_token

AI/Automation
  └─ executeHubTool({ context: { getCredential } })
       └─ RealGmailProvider.executeTool(toolKey, input, connection, context)
            └─ context.getCredential("access_token")
                 └─ getDecryptedCredential(adminSupabase, connectionId, orgId, "access_token")
```

## Seguridad

- **AES-256-GCM** con IV aleatorio por cifrado. Formato: `v1.{iv_b64url}.{authTag_b64url}.{encrypted_b64url}`
- **HUB_CREDENTIAL_ENCRYPTION_KEY**: 32 bytes en base64 (nuevo env var obligatorio)
- **CSRF**: nonce UUID en `oauth_states`, expira en 10 min, de un solo uso (`used_at`)
- **Multi-tenant**: cada credential tiene `organization_id`. Las funciones SECURITY DEFINER validan que la conexión pertenece a la org antes de leer/escribir
- **Sin SELECT para authenticated**: `integration_credentials` solo es accesible vía RPC SECURITY DEFINER (service_role)
- **Aprobación humana**: `send_email`, `create_event`, `append_row`, `update_row` requieren `requireHumanApproval: false` explícito. Por defecto retornan `{ requiresApproval: true }` sin ejecutar.

## Variables de entorno nuevas

| Variable | Descripción |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID de Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | Debe ser `{APP_URL}/api/integrations/google/callback` |
| `HUB_CREDENTIAL_ENCRYPTION_KEY` | 32 bytes random en base64: `openssl rand -base64 32` |

## Archivos creados/modificados

### Migración
- `supabase/migrations/20260628190000_phase_29_google_oauth.sql`
  - Tabla `oauth_states` (CSRF nonces)
  - Funciones SECURITY DEFINER: `claim_oauth_state`, `store_hub_credential`, `get_hub_credential`, `delete_hub_credentials`, `cleanup_expired_oauth_states`
  - Unique constraint en `integration_credentials(connection_id, credential_type)`

### packages/integrations
- `src/hub-provider.ts` — `ToolContext` type, 4th param opcional en `executeTool`
- `src/hub-executor.ts` — pasa `context` a `provider.executeTool`
- `src/provider-registry.ts` — reemplaza stubs de Google por providers reales
- `src/google/oauth.ts` — helpers OAuth puros (buildGoogleAuthUrl, exchangeGoogleCode, refreshGoogleToken, etc.)
- `src/google/api.ts` — Google API calls (Gmail, Calendar, Sheets, Drive)
- `src/google/providers.ts` — RealGmailProvider, RealGoogleCalendarProvider, RealGoogleSheetsProvider, RealGoogleDriveProvider

### apps/web
- `src/lib/integrations/credentials.ts` — AES-256-GCM encrypt/decrypt, storeCredential, getDecryptedCredential, makeGetCredential
- `src/app/api/integrations/google/start/route.ts` — inicia flujo OAuth
- `src/app/api/integrations/google/callback/route.ts` — procesa callback OAuth
- `src/app/actions/google-integration.ts` — disconnect, test, refresh, list connections
- `src/lib/jobs/handlers.ts` — refresh_integration_token real para Google

### Tests
- `packages/database/src/phase29-contract.test.ts` — 51 tests de contrato

## Herramientas por provider

### Gmail
| Tool | Descripción | Aprobación requerida |
|---|---|---|
| `search_emails` | Busca por Gmail query syntax | No |
| `read_email` | Lee mensaje completo | No |
| `send_email` | Envía correo | **Sí** |

### Google Calendar
| Tool | Descripción | Aprobación requerida |
|---|---|---|
| `list_events` | Próximos N eventos | No |
| `check_availability` | Slots libres en rango | No |
| `create_event` | Crea evento | **Sí** |

### Google Sheets
| Tool | Descripción | Aprobación requerida |
|---|---|---|
| `read_rows` | Lee filas de un rango | No |
| `search_rows` | Busca por texto | No |
| `append_row` | Agrega fila | **Sí** |
| `update_row` | Actualiza fila | **Sí** |

### Google Drive
| Tool | Descripción | Aprobación requerida |
|---|---|---|
| `list_files` | Lista archivos/carpetas | No |
| `get_file_url` | Obtiene URL de visualización/descarga | No |

## Cómo usar en automatizaciones

```typescript
// En un Hub Tool handler de AI:
const result = await executeHubTool({
  connection,
  toolKey: "search_emails",
  input: { query: "from:cliente@example.com is:unread" },
  organizationId: org.id,
  context: {
    getCredential: makeGetCredential(adminSupabase, connection.id, org.id),
    requireHumanApproval: false, // permitir send_email sin confirmación
  },
});
```

## Job de refresco de tokens

```typescript
// Encolar refresh de token de Google:
await enqueueJob(adminSupabase, {
  organizationId: org.id,
  jobType: "refresh_integration_token",
  payload: {
    connectionId: connection.id,
    organizationId: org.id,
    providerKey: "gmail",
  },
  idempotencyKey: `refresh-${connection.id}`,
});
```

## Configuración en Google Cloud Console

1. Crear OAuth 2.0 credentials → Web application
2. Agregar redirect URI: `{APP_URL}/api/integrations/google/callback`
3. Habilitar APIs: Gmail API, Calendar API, Sheets API, Drive API
4. Copiar Client ID y Client Secret a las variables de entorno
