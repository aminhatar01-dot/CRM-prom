# AI Orchestration

FASE 4 agrega asistentes IA y `AIOrchestrator` para generar sugerencias con contexto del CRM.

## Variables

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
AI_DEMO_MODE=true
```

Si `OPENAI_API_KEY` no existe, el orquestador usa modo demo. Si `AI_DEMO_MODE=true`, fuerza demo aunque exista API key.

## Servicio

`packages/ai/src/orchestrator.ts` construye un contexto con:

- prompt del asistente
- objetivo
- tono
- reglas
- conversacion
- canal
- lead/contacto
- ultimos mensajes
- entrada manual del operador
- herramientas externas activas disponibles

Luego llama a OpenAI Responses API desde servidor. La salida siempre es una sugerencia para revision humana.

## Herramientas externas

Desde FASE 9, el contexto incluye las tools activas de Integraciones con nombre, tipo, descripcion e input schema. El orquestador solo las lista; no ejecuta herramientas automaticamente en conversaciones reales.

## Seguridad

- No se exponen claves OpenAI al frontend.
- Todas las acciones pasan por Server Actions autenticadas.
- `ai_assistants`, `ai_logs` y `ai_assistant_tests` tienen RLS por `organization_id`.
- `auto_reply_enabled` existe pero queda desactivado por defecto.

## Inbox

El boton `Sugerir respuesta con IA` genera un borrador y lo guarda en `ai_logs`.
La respuesta no se envia automaticamente.
