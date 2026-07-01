# FASE 35 — Legal, Privacidad, Consentimiento y Gestión de Datos

## Objetivo

Agregar la infraestructura legal y de privacidad necesaria para operar CRM PRO AI como SaaS comercial, cumpliendo con LGPD, GDPR, LPDP Argentina y requisitos de registro de consentimiento.

## Alcance implementado

### 1. Páginas legales públicas

| Ruta | Descripción |
|---|---|
| `/legal/terms` | Términos y Condiciones de Uso |
| `/legal/privacy` | Política de Privacidad |
| `/legal/cookies` | Política de Cookies |
| `/legal/data-processing` | Acuerdo de Tratamiento de Datos (DPA) |

Todas usan `LegalLayout` con banner de borrador, navegación entre documentos y última actualización.

### 2. Tablas de base de datos

**`legal_documents`** — Versiones de documentos legales:
- `doc_type`: `terms | privacy | cookies | data_processing | ai_consent`
- `version`: texto (ej. `1.0`)
- `active`: flag para versión vigente
- RLS: SELECT abierto a todos los autenticados; INSERT/UPDATE solo via `service_role`

**`legal_acceptances`** — Registro de aceptaciones por usuario:
- Captura `ip_address` y `user_agent`
- RLS: cada usuario solo ve sus propias aceptaciones

**`privacy_requests`** — Solicitudes de privacidad por organización:
- Tipos: `export_data | delete_data | anonymize_contact | restrict_processing`
- Estados: `pending → processing → completed | rejected | cancelled`
- RLS: tenant-isolated; admins ven todas las de su org

### 3. Columnas en `organizations`

- `ai_consent_at timestamptz` — cuándo se otorgó consentimiento AI
- `ai_consent_by uuid` — quién otorgó el consentimiento
- `legal_accepted_at timestamptz` — cuándo se completó la aceptación legal en onboarding

### 4. Funciones SQL (SECURITY DEFINER)

- `get_active_legal_document(p_doc_type)` — devuelve el documento activo vigente
- `user_has_accepted_current(p_user_id, p_doc_type)` — verifica si el usuario aceptó la versión activa

### 5. Seed de documentos iniciales

5 documentos v1.0 activos insertados via `INSERT ... ON CONFLICT DO NOTHING`.

### 6. Server Actions (`apps/web/src/app/actions/legal.ts`)

| Función | Descripción |
|---|---|
| `getConsentStatus()` | Estado de consentimiento: terms, privacy, data_processing, ai_consent, allAccepted |
| `getMyAcceptances()` | Historial de aceptaciones del usuario |
| `getMyPrivacyRequests()` | Solicitudes de privacidad del usuario |
| `getActiveDocuments()` | Documentos legales vigentes |
| `acceptDocument(docType)` | Acepta un documento; ignora duplicados |
| `acceptAllDocuments()` | Acepta todos los documentos activos de una vez |
| `grantAiConsent()` | Otorga consentimiento IA + acepta documento ai_consent |
| `createPrivacyRequest(type, opts?)` | Crea solicitud con rate-limit y anti-duplicado |
| `cancelPrivacyRequest(id)` | Cancela solicitud propia en estado pending |
| `exportOrgDataSecure()` | Exporta datos de la org sin secrets |
| `adminListPrivacyRequests()` | Lista solicitudes (requiere super admin) |
| `adminHandlePrivacyRequest(id, status, notes)` | Actualiza estado de solicitud (super admin) |

Seguridad:
- `omitSecrets()` inline aplica redacción de campos sensibles en exportaciones
- Rate limiting via `checkDistributedRateLimit(..., "api_requests")`
- Bloqueo de solicitudes duplicadas pendientes
- `requireSuperAdmin()` via dynamic import en funciones admin

### 7. Cookie Banner

`apps/web/src/components/cookie-banner.tsx`:
- Client Component que aparece si `cookie_consent` no está en cookies del navegador
- Solo activa cookies esenciales
- Enlace a `/legal/cookies`
- Se guarda por 1 año con `SameSite=Lax`

Importado en `apps/web/src/app/layout.tsx` para render global.

### 8. Settings → Privacidad y datos (`/settings/privacy`)

- Estado de consentimiento de cada documento legal con badge ✓/✗ y botón de aceptar
- Sección de consentimiento IA
- Historial de aceptaciones con fechas
- Formulario para solicitar exportación de datos
- Formulario para solicitar eliminación de datos con campo de motivo
- Lista de solicitudes activas con estado y botón de cancelar

### 9. Admin → Privacidad (`/admin/privacy`)

- Estadísticas: solicitudes pendientes, en proceso, total
- Lista completa con tipo, organización, estado y notas
- Acciones inline: pasar a En proceso / Rechazar / Completar
- Requiere `requireSuperAdmin()`

### 10. Gate de consentimiento en onboarding

`finishOnboarding()` en `setup-actions.ts` verifica que el usuario haya aceptado `terms`, `privacy` y `data_processing` antes de completar el onboarding. Si no, redirige a `?error=consent_required`.

## Archivo de migración

`supabase/migrations/20260630060000_phase_35_legal_privacy.sql`

## Tests

`packages/database/src/phase35-contract.test.ts` — 70+ assertions que verifican:
- Migración SQL (tablas, RLS, funciones, columnas, seed)
- Exports de `actions/legal.ts`
- Contenido de páginas legales
- Página de settings/privacy
- Cookie banner
- Admin privacy page
- Gate de onboarding
- Navegación

## Cómo probar

### Aceptación legal en onboarding
1. Crear una cuenta nueva o ir a `/onboarding`
2. Intentar finalizar el onboarding sin aceptar los documentos → debe redirigir con `?error=consent_required`
3. Ir a `/settings/privacy` → aceptar Términos, Privacidad y DPA
4. Volver a finalizar el onboarding → debe completarse

### Exportación de datos
1. Ir a `/settings/privacy`
2. Click en "Solicitar exportación de datos" → se crea una solicitud con status `pending`
3. Ir a `/admin/privacy` → cambiar estado a `completed`
4. Ver la solicitud actualizada en `/settings/privacy`

### Cookie banner
1. Limpiar cookies del navegador
2. Abrir cualquier página → debe aparecer el banner inferior
3. Click "Aceptar esenciales" → banner desaparece; cookie `cookie_consent=accepted` guardada

## Dependencias de fases anteriores

- FASE 28: `checkDistributedRateLimit`, `logEvent`
- FASE 33: `createAdminClient`, `requireUser`, `getActiveOrganization`
- FASE 34: `requireSuperAdmin`, navegación de settings

## Notas de seguridad

- `omitSecrets()` redacta password, token, secret, key, credential, api_key, access_token, refresh_token, private_key, webhook_secret en exportaciones
- No se expone `embedding` ni `service_role` en exportaciones
- Cada solicitud de privacidad registra `ip_address` y `user_agent` del aceptante
- Admin privacy requiere plataforma super admin, no solo org admin
