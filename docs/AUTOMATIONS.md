# Automatizaciones

FASE 7 agrega automatizaciones y seguimientos seguros para el CRM conversacional.

## Tablas

- `automation_rules`: reglas por organizacion. Quedan en `draft` por defecto.
- `automation_actions`: acciones ordenadas de cada regla.
- `automation_runs`: ejecuciones programadas, manuales o por cron.
- `tasks`: seguimientos pendientes para leads y conversaciones.
- `internal_notifications`: avisos internos relacionados a entidades CRM.

## Triggers soportados

- `lead_created`
- `message_received`
- `smart_tag_assigned`
- `variable_updated`
- `inactivity`
- `manual`

## Acciones soportadas

- `send_message`
- `assign_smart_tag`
- `update_variable`
- `create_task`
- `pause_ai`
- `notify_internal`

`send_message` queda mockeada en esta fase. No se llama a WhatsApp ni se envian mensajes reales desde automatizaciones.

## Seguridad

- Todas las tablas incluyen `organization_id`.
- RLS usa membresia de organizacion.
- Triggers SQL impiden referencias cross tenant.
- El endpoint cron usa service role solo en servidor y requiere `CRON_SECRET`.
- Las reglas nacen `draft` e inactivas.

## Cron

Endpoint:

```http
POST /api/cron/automations
Authorization: Bearer <CRON_SECRET>
```

Tambien se acepta `x-cron-secret`. El endpoint procesa `automation_runs` con `status='pending'` y `scheduled_for <= now()`.

## UI

- `/automations`: listado.
- `/automations/new`: creacion.
- `/automations/[id]`: detalle e historial.
- `/automations/[id]/edit`: edicion.
- Inbox y detalle de lead muestran tareas/notificaciones y permiten crear seguimientos manuales.
