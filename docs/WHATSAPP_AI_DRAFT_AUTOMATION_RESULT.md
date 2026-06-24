# WhatsApp AI Draft Automation Result

Fecha: 2026-06-24

## Objetivo

Cada mensaje recibido por WhatsApp debe disparar una automatizacion segura que genere un borrador IA visible en Inbox, sin enviar respuestas automaticas.

## Configuracion aplicada

Organizacion: `cda92f21-8bd0-4ddf-9224-f9b9fe5e0b6e`

Regla creada/activada:

- `id`: `cd8ba29e-5a42-4d2c-8d51-d3d7c37852bd`
- `name`: `Borrador IA para WhatsApp`
- `trigger_type`: `message_received`
- `status`: `active`
- `enabled`: `true`
- `conditions`: `{ "channel": "whatsapp" }`
- `auto_send`: `false`
- `auto_reply_limit`: `1`
- `auto_reply_window_minutes`: `1440`

Accion configurada:

- `id`: `a73b9d0f-55ab-4cf9-a179-80222da68c4e`
- `action_type`: `generate_ai_draft`
- `enabled`: `true`
- `position`: `1`
- `assistant_id`: `62fadc8a-37c8-4bc5-8811-22876f6b70fc`
- `instruction`: `Responde utilizando el contexto CRM, historial de conversacion y Base de Conocimiento. No inventes informacion.`

## Verificacion realizada

Se uso una conversacion real existente de WhatsApp:

- `conversation_id`: `b85b64e0-3408-44ad-a1c8-e116f1996a02`
- `message_id`: `5b3f08ba-5aff-4044-8b10-d37eb2a90d3d`

Resultado exitoso:

- `automation_run_id`: `24579452-75be-494b-bfbe-9d14e85357b5`
- `status`: `completed`
- `draft_id`: `6148bb40-f564-425a-a335-5785b4c8ae12`
- `draft_status`: `pending`
- `auto_send_requested`: `false`
- `model`: `gpt-5.2`
- `mode`: `demo`
- `ai_log_id`: `dfb57ca6-569b-4e30-bc52-6cf989f6ed57`
- `auto_send.attempted`: `false`

La consulta equivalente a Inbox encontro el borrador pendiente para la conversacion real. Por lo tanto, el borrador debe aparecer en el panel derecho del Inbox para esa conversacion.

## Observaciones

No se modifico WhatsApp Cloud API, no se modifico Inbox y no se activo envio automatico.

La prueba controlada se ejecuto desde el entorno local. Como el entorno local no tiene `OPENAI_API_KEY`, una ejecucion local estricta fallo con:

`OPENAI_API_KEY no esta configurada. Activa AI_DEMO_MODE o agrega la clave en el servidor.`

Luego se repitio la prueba con `AI_DEMO_MODE=true` solo para validar el flujo de creacion de borradores sin enviar mensajes.

En produccion, los webhooks de Vercel usaran OpenAI real si `OPENAI_API_KEY` y `OPENAI_MODEL` estan configuradas en Vercel y `AI_DEMO_MODE` no fuerza modo demo.

## Proxima prueba recomendada

Enviar un nuevo WhatsApp real al numero conectado. El resultado esperado es:

1. El webhook recibe el mensaje.
2. Se guarda el mensaje inbound.
3. Se ejecuta la regla `Borrador IA para WhatsApp`.
4. Se crea un nuevo `automation_draft` con `status=pending`.
5. El draft aparece en Inbox.
6. No se envia ningun mensaje automatico.

Si el draft no aparece con un nuevo WhatsApp real, revisar:

- `automation_runs` para la regla `cd8ba29e-5a42-4d2c-8d51-d3d7c37852bd`.
- `automation_execution_logs` para action `generate_ai_draft`.
- `ai_logs` con metadata `source=automation_draft`.
- Variables de Vercel: `OPENAI_API_KEY`, `OPENAI_MODEL`, `AI_DEMO_MODE`.
