# Variables Inteligentes

FASE 6 agrega variables configurables para extraer datos estructurados desde conversaciones y leads.

## Tipos

- `text`
- `long_text`
- `number`
- `price`
- `boolean`
- `option`
- `link`

## Tablas

- `variables`: definiciones por organizacion.
- `lead_variables`: valores extraidos por lead.
- `conversation_variables`: valores extraidos por conversacion.
- `variable_extraction_logs`: bitacora de cada intento de extraccion.

Los valores se guardan como `jsonb` y se validan por tipo antes de persistir.

## Extraccion

El boton `Extraer variables con IA` en Inbox ejecuta `VariableExtractor` en modo demo.
El boton `Actualizar variables con IA` en la ficha de lead hace lo mismo sobre datos del lead.

Cada valor guarda:

- `value`
- `confidence`
- `source_message_id`
- `extracted_at`

La extraccion automatica queda preparada con `auto_extract_enabled`, pero desactivada por defecto.

## Seguridad

- RLS estricto por `organization_id`.
- Triggers de integridad tenant para variable, lead, conversacion y mensaje fuente.
- Upsert por `lead_id,variable_id` o `conversation_id,variable_id` para evitar duplicados.
- No se envian mensajes automaticos.
