# FASE 18 - Automatizaciones reales

Fecha: 2026-06-22

## Objetivo

FASE 18 conecta las reglas del CRM con eventos reales de Supabase y WhatsApp.
Las reglas permanecen en modo seguro: `auto_send=false` por defecto y toda
respuesta generada por IA aparece como borrador en Inbox.

## Triggers

- `message_received`: mensaje inbound persistido por el webhook.
- `conversation_created`: primera conversacion creada por WhatsApp.
- `lead_created`: lead creado desde el CRM.
- `lead_status_changed`: cambio desde formulario o Pipeline/Kanban.
- `smart_tag_assigned`: tag aplicado manualmente.
- `variable_updated`: variable extraida y persistida.
- `inactivity`: reservado para cron.
- `manual`: ejecucion explicita.

Cada evento crea un `automation_run` con IDs de organizacion, conversacion,
lead, contacto y mensaje disponibles. La clave `idempotency_key` evita repetir
el mismo evento para la misma regla.

## Acciones

- `create_task`: crea seguimiento interno.
- `assign_smart_tag`: aplica tag a lead y/o conversacion sin duplicados.
- `extract_variable`: ejecuta `VariableExtractor` con contexto real.
- `update_variable`: escribe un valor configurado.
- `change_lead_status`: actualiza el estado comercial.
- `create_activity`: registra actividad en `audit_logs`.
- `notify_internal`: crea una notificacion CRM.
- `pause_ai`: pausa la IA de la conversacion.
- `generate_ai_draft`: genera borrador con `AIOrchestrator`.
- `send_message`: se trata como generacion IA controlada; solo envia si la regla
  tiene `auto_send=true`.

## Crear una automatizacion

1. Abrir `Automatizaciones > Nueva automatizacion`.
2. Elegir trigger.
3. Mantener estado `draft` mientras se configura.
4. Definir condiciones JSON simples, por ejemplo:

```json
{
  "channel": "whatsapp",
  "lead_status": "interesado"
}
```

5. Definir acciones:

```json
[
  {
    "type": "create_task",
    "enabled": true,
    "config": {
      "title": "Responder lead de WhatsApp"
    }
  },
  {
    "type": "generate_ai_draft",
    "enabled": true,
    "config": {
      "instruction": "Responder con el siguiente paso comercial."
    }
  }
]
```

6. Dejar `Auto envio` desmarcado.
7. Guardar y usar `Probar con conversacion existente`.
8. Revisar logs y borradores.
9. Activar la regla cuando el resultado sea correcto.

## Borradores en Inbox

Los borradores pendientes se muestran sobre el historial:

- `Aprobar y enviar`: crea el mensaje, llama Graph API y registra auditoria.
- `Descartar`: conserva trazabilidad y evita el envio.
- estados bloqueados o fallidos muestran el motivo.

Inbox tambien muestra las ultimas ejecuciones de automatizaciones de la
conversacion y se actualiza mediante Supabase Realtime.

## Auto envio

El auto envio solo se intenta cuando:

- la regla esta activa;
- `auto_send=true`;
- existe conversacion, mensaje inbound y asistente activo;
- el ultimo inbound tiene menos de 24 horas;
- no se supero `auto_reply_limit` dentro de
  `auto_reply_window_minutes`;
- la organizacion no supero 20 auto-respuestas por hora;
- el evento no fue procesado antes;
- WhatsApp esta configurado y el destinatario existe.

El valor inicial es:

```text
auto_send=false
auto_reply_limit=1
auto_reply_window_minutes=1440
```

Las respuestas outbound no disparan `message_received`, evitando loops. Los
errores del motor no hacen fallar el webhook: se registran como
`automation_dispatch_failed`.

## Limite de 24 horas de WhatsApp

CRM PRO AI envia texto libre solo dentro de las 24 horas posteriores al ultimo
mensaje del cliente. Fuera de esa ventana el borrador queda `blocked`.

El envio fuera de la ventana requiere templates aprobados por Meta, que no se
implementan en esta fase.

## Persistencia

### Cambios en `automation_rules`

- `auto_send`;
- `auto_reply_limit`;
- `auto_reply_window_minutes`.

### Cambios en `automation_runs`

- `idempotency_key`;
- `conversation_id`;
- `lead_id`;
- `contact_id`;
- `message_id`;
- `initiated_by`.

### `automation_drafts`

Guarda contenido, estado, modelo, tokens, aprobación y mensaje enviado.

### `automation_execution_logs`

Guarda acción, entrada resumida, resultado, error seguro, modelo y tokens.

Todas las tablas usan `organization_id`, RLS y triggers de integridad tenant.

## Auditoria

Se registra:

- regla y run;
- trigger y contexto;
- condiciones evaluadas;
- resultado por acción;
- errores sanitizados;
- modelo y tokens de IA;
- borrador o mensaje;
- usuario aprobador;
- autoenvio.

## Prueba en produccion

1. Aplicar la migracion:

```powershell
npx supabase db push
```

2. Desplegar código.
3. Crear una regla `message_received`, inicialmente `draft`.
4. Agregar `create_task` y `generate_ai_draft`.
5. Probarla con una conversación WhatsApp existente.
6. Confirmar borrador en Inbox.
7. Aprobar y verificar `sent/delivered`.
8. Activar la regla.
9. Enviar un mensaje inbound real.
10. Confirmar un único run por evento.

## Validacion ejecutada

- Migraciones aplicadas sin reset remoto.
- Smoke real contra Supabase remoto:
  - regla temporal insertada;
  - run con IDs reales de conversación y mensaje insertado;
  - borrador seguro insertado;
  - segundo run con la misma `idempotency_key` rechazado con HTTP 409;
  - `auto_send=false`;
  - datos temporales eliminados.
- Smoke firmado contra el webhook Production:
  - HTTP 200 para evento original y replay;
  - un solo run y una sola tarea;
  - replay bloqueado por idempotencia;
  - Smart Tag asignado;
  - borrador generado con OpenAI real;
  - borrador en estado `pending`;
  - `auto_send_requested=false`;
  - ningún mensaje automático creado;
  - reglas, tareas y tags temporales eliminados.
- El primer smoke detectó una función trigger genérica incompatible con
  `automation_runs`. Se corrigió mediante una segunda migración con funciones
  específicas por tabla antes del despliegue.

Para probar auto envio, crear una regla separada, mantener límite 1 y activar
`auto_send` solo después de validar el modo borrador.

## Pendiente para siguiente fase

- templates de WhatsApp fuera de la ventana de 24 horas;
- constructor visual avanzado sin JSON;
- secuencias con espera entre pasos;
- reintentos con backoff;
- métricas agregadas y alertas externas;
- ejecución automática de herramientas externas por IA.
