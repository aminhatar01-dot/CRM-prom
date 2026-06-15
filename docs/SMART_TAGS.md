# Smart Tags

FASE 5 agrega Smart Tags para clasificar leads y conversaciones con ayuda de IA.

## Campos

- `name`
- `color`
- `description`
- `classification_prompt`
- `active`
- `auto_pause_assistant`
- `notify_team`

La tabla existente `tags` se conserva y se amplia para mantener compatibilidad con FASE 2.

## Asignaciones

- Leads: `lead_tags`
- Conversaciones: `conversation_smart_tags`

Ambas relaciones evitan duplicados con claves unicas por entidad/tag.

## Clasificacion IA

El boton `Analizar tags con IA` en Inbox usa `SmartTagClassifier`.
En esta fase el clasificador corre en modo demo deterministico y deja preparada la entrada para una futura clasificacion con modelo.

La clasificacion:

- Lee contexto de conversacion, lead/contacto y ultimos mensajes.
- Evalua Smart Tags activos.
- Asigna tags coincidentes a la conversacion.
- Asigna tags al lead si la conversacion tiene lead asociado.
- Guarda logs en `smart_tag_classification_logs`.
- Registra auditoria en `audit_logs`.

Si un tag coincidente tiene `auto_pause_assistant=true`, la conversacion pasa a `ai_status='paused'` y `ai_paused=true`.

## Seguridad

- RLS por `organization_id`.
- Triggers de integridad tenant para evitar referencias cruzadas.
- Todas las escrituras de UI pasan por Server Actions.
- No se envian mensajes automaticos.
