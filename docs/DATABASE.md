# Base de datos

## Tenancy

La raiz tenant es `organizations`. Cada usuario accede mediante `organization_members`.
Las tablas CRM tienen `organization_id` obligatorio y RLS habilitado.

## Tablas FASE 2

### `leads`

Campos principales:

- `organization_id`
- `first_name`, `last_name`
- `email`, `phone`, `company`
- `source`
- `status`: `nuevo`, `contactado`, `interesado`, `propuesta`, `ganado`, `perdido`
- `owner_id`
- `notes`

### `contacts`

Campos principales:

- `organization_id`
- `first_name`, `last_name`
- `email`, `phone`, `company`, `location`
- `owner_id`
- `converted_from_lead_id`
- `notes`

### `conversations`

Campos principales:

- `organization_id`
- `lead_id` o `contact_id`
- `channel`: `whatsapp`, `webchat`, `manual`
- `status`: `abierta`, `pendiente`, `cerrada`
- `ai_status`: `active`, `paused`, `human`
- `owner_id`
- `last_message_at`

### `messages`

Campos principales:

- `organization_id`
- `conversation_id`
- `direction`: `inbound`, `outbound`
- `channel`
- `status`: `pending`, `sent`, `delivered`, `read`, `failed`
- `body`
- `metadata`

## Realtime

La migracion FASE 2 agrega a `supabase_realtime`:

- `public.conversations`
- `public.messages`
- `public.leads`

Si el proyecto Supabase requiere configuracion manual, verificar en Database > Replication que esas tablas esten habilitadas.

## Integridad tenant

La migracion FASE 2 agrega `enforce_crm_tenant_integrity()` para evitar referencias cruzadas entre organizaciones en:

- `leads.contact_id`
- `conversations.lead_id`
- `conversations.contact_id`
- `messages.conversation_id`
- `lead_tags.lead_id`
- `lead_tags.tag_id`
- `owner_id` operativo

## WhatsApp FASE 3

### `whatsapp_channel_settings`

Configuracion por organizacion:

- `organization_id`
- `phone_number_id`
- `business_account_id`
- `display_phone_number`
- `webhook_verify_token_hint`
- `enabled`

### `whatsapp_events`

Persistencia de eventos:

- `direction`: `inbound`, `outbound`, `status`, `error`
- `event_type`
- `whatsapp_message_id`
- `conversation_id`
- `message_id`
- `phone_number_id`
- `contact_wa_id`
- `payload`
- `error_message`

Ambas tablas tienen RLS por `organization_id`.

## IA FASE 4

### `ai_assistants`

La tabla base se amplia con:

- `description`
- `objective`
- `active`
- `channel_id`
- `auto_reply_enabled`

### `ai_logs`

Registra llamadas y sugerencias:

- `assistant_id`
- `conversation_id`
- `message_id`
- `provider`
- `model`
- `mode`
- `input`
- `output`
- `status`
- `error_message`

### `ai_assistant_tests`

Guarda pruebas manuales de asistentes:

- `assistant_id`
- `conversation_id`
- `input`
- `output`
- `status`
- `metadata`

## Smart Tags FASE 5

### `tags`

La tabla se amplia con:

- `description`
- `classification_prompt`
- `active`
- `auto_pause_assistant`
- `notify_team`

### `conversation_smart_tags`

Relaciona tags con conversaciones y evita duplicados mediante `unique (conversation_id, tag_id)`.

### `smart_tag_classification_logs`

Guarda resultado de clasificacion:

- `conversation_id`
- `lead_id`
- `tag_id`
- `mode`
- `matched`
- `confidence`
- `reason`
- `input`
- `output`

Las nuevas tablas tienen RLS y triggers de integridad tenant.

## Variables FASE 6

### `variables`

Definiciones:

- `name`
- `key`
- `description`
- `type`
- `extraction_prompt`
- `active`
- `required`
- `options`
- `auto_extract_enabled`

### `lead_variables`

Valores por lead con `unique (lead_id, variable_id)`.

### `conversation_variables`

Valores por conversacion con `unique (conversation_id, variable_id)`.

### `variable_extraction_logs`

Registra cada intento:

- `variable_id`
- `lead_id`
- `conversation_id`
- `source_message_id`
- `mode`
- `extracted`
- `value`
- `confidence`
- `reason`
- `input`
- `output`

## Automatizaciones FASE 7

### `automation_rules`

La tabla base se amplia con:

- `description`
- `status`: `draft`, `active`, `paused`, `archived`
- `trigger_config`
- `conditions`
- `last_run_at`

Las reglas quedan desactivadas por defecto.

### `automation_runs`

Registra ejecuciones:

- `rule_id`
- `trigger_type`
- `status`: `pending`, `running`, `completed`, `failed`, `cancelled`
- `context`
- `result`
- `error_message`
- `scheduled_for`
- `started_at`
- `completed_at`

### `tasks`

Seguimientos internos:

- `lead_id`
- `conversation_id`
- `owner_id`
- `title`
- `description`
- `status`
- `due_at`
- `created_by`

### `internal_notifications`

Avisos internos:

- `user_id`
- `title`
- `body`
- `entity_table`
- `entity_id`
- `read_at`
- `metadata`

Las tablas nuevas tienen RLS, indices por organizacion y triggers de integridad tenant.
