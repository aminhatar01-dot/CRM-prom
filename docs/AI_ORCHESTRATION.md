# AI Orchestration

FASE 4 agrega asistentes IA y `AIOrchestrator` para generar sugerencias con contexto del CRM.

## Variables

```bash
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.2
AI_DEMO_MODE=true
```

`AI_DEMO_MODE=true` fuerza modo demo y no llama a OpenAI. Con `AI_DEMO_MODE=false`, `OPENAI_API_KEY` es obligatoria.

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
- Smart Tags asignados
- Variables Inteligentes extraidas

Luego llama a OpenAI Responses API desde servidor. La salida siempre es una sugerencia para revision humana.

Smart Tags y Variables usan Structured Outputs y validacion local antes de persistir resultados.

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
