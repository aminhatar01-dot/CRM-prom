# FASE 34 — Ciclo completo de cuenta, equipo, roles e invitaciones

**Fecha:** 2026-06-30  
**Rama:** `feature/phase-26-ai-credits`  
**Tests:** 651 pasando (66 archivos)  
**Build:** ✅ OK | Deploy check: 12 PASS, 2 WARN, 0 FAIL

---

## Objetivo

Completar el ciclo de cuenta para que una empresa pueda operar CRM PRO AI con su equipo sin intervención técnica. Cubre el perfil de la organización, el perfil personal del usuario, la gestión del equipo con roles granulares y el sistema de invitaciones seguras.

---

## 1. Cambios en la base de datos

### Migración: `20260630000000_phase_34_account_team_roles.sql`

#### Roles extendidos

El enum `organization_role` ahora incluye:

| Rol | Descripción |
|---|---|
| `owner` | Control total. Solo puede haber uno por org. No se puede asignar por invitación. |
| `admin` | Gestión de equipo, integraciones y configuración. |
| `supervisor` | Lectura de reportes y todos los contactos. Sin acceso a configuración. |
| `agent` | Usa Inbox, gestiona contactos y leads. |
| `member` | Acceso básico al CRM. Sin configuración. |
| `viewer` | Solo lectura. No puede interactuar con clientes. |

#### Perfil de usuario extendido (`profiles`)

Columnas nuevas:

| Columna | Tipo | Default |
|---|---|---|
| `phone` | text | null |
| `job_title` | text | null |
| `preferred_language` | text | `'es'` |
| `timezone` | text | `'America/Argentina/Buenos_Aires'` |

#### Perfil de organización extendido (`organizations`)

Columnas nuevas:

| Columna | Tipo | Default |
|---|---|---|
| `business_type` | text | null |
| `description` | text | null |
| `country` | text | `'AR'` |
| `currency` | text | `'ARS'` |
| `timezone` | text | `'America/Argentina/Buenos_Aires'` |
| `logo_url` | text | null |
| `tax_id` | text | null (CUIT/RUT/NIF) |
| `fiscal_name` | text | null (Razón social) |
| `preferences` | jsonb | `{}` |

#### Tabla `organization_invitations` (nueva)

```sql
CREATE TABLE organization_invitations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  email           text NOT NULL,
  role            organization_role NOT NULL DEFAULT 'agent',
  token           text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by      uuid REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at      timestamptz NOT NULL DEFAULT now() + interval '7 days',
  accepted_at     timestamptz,
  revoked_at      timestamptz,
  resend_count    integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

**RLS aplicado:**
- `SELECT`: cualquier miembro de la org puede ver invitaciones.
- `INSERT`: solo admins/owners.
- `UPDATE`: solo admins/owners.

#### Funciones SECURITY DEFINER

| Función | Descripción |
|---|---|
| `is_org_owner(org_id)` | Verifica si el usuario actual es owner de la org. |
| `invite_member(org_id, email, role, invited_by)` | Crea invitación. Bloquea rol `owner`. Revoca pendientes duplicadas. |
| `accept_invitation(token, user_id)` | Acepta invitación con `FOR UPDATE`. Verifica expiry, revocación y doble-accept. Agrega al usuario a `organization_members`. |
| `revoke_invitation(invitation_id)` | Revoca una invitación pendiente. Verifica permisos de admin. |

---

## 2. Permisos y capacidades de roles

### `apps/web/src/lib/permissions/roles.ts`

| Función | owner | admin | supervisor | agent | member | viewer |
|---|---|---|---|---|---|---|
| `canManageSettings` | ✅ | ✅ | — | — | — | — |
| `canManageIntegrations` | ✅ | ✅ | — | — | — | — |
| `canManageTeam` | ✅ | ✅ | — | — | — | — |
| `canViewReports` | ✅ | ✅ | ✅ | — | — | — |
| `canUseInbox` | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `canEditData` | ✅ | ✅ | ✅ | ✅ | ✅ | — |

**Nuevas exportaciones:**
- `ROLE_LABELS`: mapa de rol → label en español.
- `INVITABLE_ROLES`: lista de roles invitables (excluye `owner`).
- `canManageTeam(role)`: alias de `canManageSettings`.
- `canViewReports(role)`: incluye supervisor.
- `canEditData(role)`: todos menos viewer.

---

## 3. Server Actions

### `apps/web/src/app/actions/team.ts`

| Acción | Descripción | Permisos |
|---|---|---|
| `getTeamData()` | Lista miembros + invitaciones pendientes. | Cualquier miembro |
| `inviteMember(email, role)` | Crea invitación via `invite_member` RPC. Valida email y rol. | admin/owner |
| `revokeInvitation(id)` | Revoca via `revoke_invitation` RPC. | admin/owner |
| `resendInvitation(id)` | Extiende `expires_at` +7 días, incrementa `resend_count`. | admin/owner |
| `updateMemberRole(memberId, newRole)` | Cambia rol de un miembro. Bloquea: owner target, asignar owner. | admin/owner |
| `removeMember(memberId)` | Elimina miembro. Bloquea: owner target, auto-eliminación. | admin/owner |
| `acceptInvitation(token)` | Acepta invitación via `accept_invitation` RPC. | Usuario autenticado |

**Seguridad:**
- Todas las mutaciones verifican permisos con `canManageTeam`.
- No se puede asignar el rol `owner` desde ninguna acción.
- No se puede eliminar al propietario.
- No se puede eliminar a uno mismo.
- Todas las acciones registran en `event_logs`.

### `apps/web/src/app/actions/organization.ts`

| Acción | Descripción |
|---|---|
| `updateOrganization(input)` | Actualiza perfil de la org. Requiere admin. |
| `uploadOrganizationLogo(formData)` | Sube logo a Supabase Storage (`public-assets/org-logos/`). Max 2 MB. JPG/PNG/WebP. |

### `apps/web/src/app/actions/profile.ts`

| Acción | Descripción |
|---|---|
| `updateProfile(input)` | Actualiza perfil personal del usuario (nombre, teléfono, cargo, idioma, zona horaria). |
| `changePassword(current, new)` | Verifica contraseña actual antes de cambiar. Mínimo 8 caracteres. |

---

## 4. UI — Páginas nuevas

### `/settings/organization`

- Formulario Server Component con 8 campos: nombre, descripción, tipo de negocio, país, moneda, zona horaria, CUIT, razón social.
- Muestra feedback de éxito/error via `searchParams`.
- Solo accesible para admins/owners (redirect a `/dashboard` si no).

### `/settings/profile`

- Sección 1: datos personales (nombre, teléfono, cargo, idioma, zona horaria). Email deshabilitado (readonly).
- Sección 2: cambio de contraseña (verifica contraseña actual).
- Feedback en línea por `searchParams`.
- Accesible para todos los roles.

### `/settings/team`

- Banner con formulario de invitación (email + selector de rol) — visible solo para admins.
- Lista de miembros con:
  - Avatar inicial del nombre.
  - Cargo/puesto si está disponible.
  - Etiqueta de rol o selector de cambio de rol (inline form).
  - Botón de eliminar con confirmación.
- Lista de invitaciones pendientes con:
  - Email, rol, fecha de expiración, contador de reenvíos.
  - Botones de reenviar y revocar (forms independientes).
- Guía de roles al pie explicando cada nivel.

### `/invite/[token]` (ruta pública)

- Verifica el token en DB (no en JWT): detecta inexistente, revocado, aceptado, expirado.
- Si el usuario está autenticado: muestra botón "Aceptar invitación".
  - Si el email del usuario difiere del email invitado: muestra advertencia.
- Si no está autenticado: muestra links a `/login` y `/register` con el email pre-cargado.

---

## 5. Navegación actualizada

`apps/web/src/lib/navigation/main-nav.ts` incluye tres ítems nuevos:

| Ruta | Label | Icono | Visible para |
|---|---|---|---|
| `/settings/profile` | Mi perfil | `User` | Todos los roles |
| `/settings/team` | Equipo | `Users` | Solo admins/owners |
| `/settings/organization` | Organización | `Building2` | Solo admins/owners |

---

## 6. Reglas de seguridad aplicadas

| Regla | Implementación |
|---|---|
| No asignar rol owner por invitación | Validado en `invite_member` SQL + `inviteMember` action |
| No eliminar al único owner | Validado en `removeMember` action (bloquea si `role === 'owner'`) |
| No auto-eliminarse | Validado en `removeMember` action con `user.id === target.user_id` |
| No escalar rol propio | `updateMemberRole` no acepta `newRole = 'owner'` |
| Token de invitación seguro | `gen_random_bytes(32)` → 256 bits de entropía |
| Expiración 7 días | Default en DB + renovada en `resendInvitation` |
| FOR UPDATE en aceptación | `accept_invitation` usa `SELECT ... FOR UPDATE` para prevenir doble-accept concurrente |
| RLS en invitaciones | Políticas en `organization_invitations` para SELECT/INSERT/UPDATE |
| Logs de auditoría | Todas las mutaciones escriben en `event_logs` |

---

## 7. Tests

### `packages/database/src/phase34-contract.test.ts`

59 tests de contrato que verifican:

- Migración SQL: roles, columnas, tabla de invitaciones, RLS, funciones SECURITY DEFINER.
- `roles.ts`: roles, labels, capacidades, lógica viewer.
- `team.ts`: todas las acciones exportadas, guards de seguridad, validación de email, logs.
- `organization.ts`: permisos, uso de admin client, filtro por org ID.
- `profile.ts`: acciones exportadas, validación de contraseña.
- Páginas UI: contenido clave de team, org, profile, invite.
- Navegación: las tres rutas nuevas presentes.

---

## 8. Archivos creados / modificados

| Archivo | Acción |
|---|---|
| `supabase/migrations/20260630000000_phase_34_account_team_roles.sql` | Nuevo |
| `apps/web/src/lib/permissions/roles.ts` | Modificado |
| `apps/web/src/lib/navigation/main-nav.ts` | Modificado |
| `apps/web/src/app/actions/team.ts` | Nuevo |
| `apps/web/src/app/actions/organization.ts` | Nuevo |
| `apps/web/src/app/actions/profile.ts` | Nuevo |
| `apps/web/src/app/(crm)/settings/team/page.tsx` | Nuevo |
| `apps/web/src/app/(crm)/settings/organization/page.tsx` | Nuevo |
| `apps/web/src/app/(crm)/settings/profile/page.tsx` | Nuevo |
| `apps/web/src/app/invite/[token]/page.tsx` | Nuevo |
| `packages/database/src/phase34-contract.test.ts` | Nuevo |
| `apps/web/src/lib/integrations/executor.test.ts` | Modificado (fix lint) |
| `docs/PHASE_34_ACCOUNT_TEAM_ROLES.md` | Nuevo |

---

## 9. Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `npm run lint` | ✅ 0 errores, 0 warnings |
| `npm run test` | ✅ 651 tests, 66 archivos, 0 fallos |
| `npm run build` | ✅ OK — 48+ páginas generadas |
| `npm run deploy:check` | ✅ 12 PASS, 2 WARN (env locales), 0 FAIL |

---

## 10. No se rompió

| Módulo | Estado |
|---|---|
| WhatsApp webhook | ✅ Sin cambios |
| Inbox / Realtime | ✅ Sin cambios |
| IA / Asistentes / RAG | ✅ Sin cambios |
| Créditos IA / Ledger | ✅ Sin cambios |
| Billing (manual + webhooks) | ✅ Sin cambios |
| Panel admin | ✅ Sin cambios |
| Job queue | ✅ Sin cambios |
| Integration Hub + Custom Connect | ✅ Sin cambios |
| Seguridad FASE 33 | ✅ Intacta |
| `roleCapabilities` (usado en credits page) | ✅ Retrocompatible — nuevas claves son aditivas |

---

## 11. Pendientes de fases futuras

- **Transferencia de ownership**: cambiar el rol `owner` a otro miembro. Requiere confirmación doble y protección extra.
- **Invitación vía WhatsApp/email real**: actualmente el link se genera pero no se envía automáticamente. FASE 35 agregará envío real via email (Resend o SendGrid).
- **Logo upload en UI**: la action `uploadOrganizationLogo` está lista; la UI de la página de organización usa campos de texto por ahora. El uploader visual queda para la FASE 35 (onboarding pulido).
- **Avatar de perfil de usuario**: similar al logo, la action está pendiente de UI.
- **2FA**: FASE 36 (compliance y seguridad avanzada).
- **Logs de auditoría visibles**: tabla de eventos del equipo visible desde settings/team. FASE 36.
