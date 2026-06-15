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
