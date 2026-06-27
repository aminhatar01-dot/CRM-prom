# FASE 20 - Agente IA autonomo controlado

## Objetivo

FASE 20 habilita respuestas automaticas por WhatsApp con control explicito, limites de seguridad y trazabilidad. El modo seguro sigue siendo el valor por defecto: las automatizaciones generan borradores y requieren aprobacion humana.

## Controles requeridos para autoenvio

Una respuesta automatica solo se envia si se cumplen todas estas condiciones:

1. La automatizacion esta `active`, `enabled=true` y `auto_send=true`.
2. La accion es `generate_ai_draft`.
3. El asistente tiene `auto_reply_enabled=true`.
4. La conversacion esta en `ai_status='active'` y `ai_paused=false`.
5. Existe una ventana de WhatsApp abierta de 24 horas desde el ultimo mensaje inbound.
6. No se excedio el limite de 5 respuestas por conversacion cada 30 minutos ni el limite de 20 respuestas por organizacion y hora.
7. La respuesta IA tiene contexto suficiente de CRM/Base de Conocimiento.
8. No se detecta intencion sensible o de escalamiento humano.

Si una condicion falla, el sistema conserva el borrador pendiente para revision humana y registra la decision.

## Configuracion productiva aplicada

El boton `IA automatica` de Inbox solo cambia el estado de la conversacion. Para que exista autoenvio real tambien debe existir una regla `message_received` con accion `generate_ai_draft` y `auto_send=true`.

Comando idempotente:

```bash
npm run phase20:configure:auto-agent
```

El comando:

- habilita `auto_reply_enabled=true` en el asistente WhatsApp configurado;
- mejora el prompt comercial para WhatsApp;
- crea o actualiza la regla `Auto respuesta IA WhatsApp`;
- restringe esa regla a `conditions.channel='whatsapp'`, `conditions.ai_status='active'` y `conditions.ai_paused=false`;
- deja la regla `Borrador IA para WhatsApp` en modo humano/borrador.

## Modos de conversacion

Desde Inbox, cada conversacion muestra un indicador:

- `Modo humano / borrador`: la IA puede sugerir borradores, pero no envia.
- `IA automatica`: permite autoenvio si tambien estan habilitados asistente y automatizacion.
- `IA pausada`: bloquea autoenvio y fuerza revision humana.

Los botones del panel de Inbox permiten cambiar entre `Modo borrador`, `IA automatica` y `Pausar IA`.

## Escalamiento a humano

El motor bloquea autoenvio y marca la conversacion para humano si detecta temas sensibles como reclamos, enojo, pagos, precios inciertos, temas legales, denuncias, cancelaciones o falta de informacion interna. En ese caso:

- deja el borrador como pendiente;
- actualiza la conversacion a `ai_status='human'` y `ai_paused=true`;
- crea una tarea interna;
- crea una notificacion interna;
- registra auditoria y logs de automatizacion.

## RAG y fuentes

AIOrchestrator sigue usando la Base de Conocimiento por organizacion. Los borradores y logs guardan `knowledge_sources` y `knowledge_sufficient`. Si no hay contexto suficiente, no se autoenvia.

## Drafts fallidos historicos

Los drafts `failed` o `blocked` no se eliminan. Inbox permite ocultarlos con `Ocultar fallido`, que cambia el estado a `discarded` y conserva auditoria, error original y registros relacionados.

## Correccion visual del Inbox

El panel de automatizaciones tiene scroll propio y altura maxima. El historial de mensajes mantiene scroll interno y el input manual queda en un footer fijo dentro del panel de conversacion.

## Prueba en produccion

1. Ejecutar `npm run phase20:configure:auto-agent` si todavia no se aplico la configuracion.
2. Confirmar que el asistente elegido tenga `Permitir respuestas automaticas` activado.
3. Confirmar que la automatizacion `Auto respuesta IA WhatsApp` tenga `auto_send=true`.
4. Abrir Inbox y poner la conversacion en `IA automatica`.
5. Enviar un WhatsApp inbound dentro de la ventana de 24 horas.
6. Verificar en Inbox si se envio automaticamente o si quedo borrador por revision.
7. Revisar `Historial de automatizaciones`, tareas y notificaciones si fue escalado.

## Riesgos y limites

- Cada mensaje inbound tiene una unica ejecucion idempotente. Un segundo mensaje real del cliente puede recibir una nueva respuesta.
- Si se alcanza un limite, la respuesta queda como borrador pendiente para aprobacion manual en lugar de descartarse.
- No activar `auto_send=true` en reglas amplias sin revisar prompts, RAG y limites.
- WhatsApp no permite mensajes libres fuera de la ventana de 24 horas.
- Consultas sensibles deben ser atendidas por humano.
- El token de WhatsApp y `OPENAI_API_KEY` nunca deben exponerse al frontend.
