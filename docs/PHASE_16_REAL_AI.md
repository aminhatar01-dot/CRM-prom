# FASE 16 - IA real controlada

Fecha: 2026-06-21

## Objetivo

Conectar Asistentes, Smart Tags y Variables Inteligentes con OpenAI Responses API, conservando un modo demo explicito para desarrollo y contingencia.

## Configuracion

Variables server-side:

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.2
AI_DEMO_MODE=false
```

Reglas:

- `AI_DEMO_MODE=true`: no se realiza ninguna llamada a OpenAI.
- `AI_DEMO_MODE=false`: `OPENAI_API_KEY` es obligatoria.
- `OPENAI_API_KEY` nunca usa prefijo `NEXT_PUBLIC_`.
- `OPENAI_MODEL` permite cambiar el modelo sin desplegar codigo nuevo.

## Cliente OpenAI

`packages/ai/src/openai-client.ts` centraliza:

- endpoint `POST /v1/responses`;
- autenticacion Bearer server-side;
- respuestas de texto;
- Structured Outputs con JSON Schema;
- `store: false`;
- sanitizacion y limites de contexto;
- errores HTTP seguros;
- identificador de respuesta;
- uso de tokens.

El cliente usa `fetch` nativo y no agrega un SDK adicional al frontend.

Referencias oficiales:

- https://developers.openai.com/api/reference/resources/responses/methods/create
- https://developers.openai.com/api/docs/guides/structured-outputs

## AIOrchestrator

El contexto de sugerencia incluye:

- organizacion;
- configuracion del asistente;
- objetivo, tono y reglas;
- lead o contacto;
- conversacion y canal;
- ultimos 12 mensajes;
- Smart Tags asignados;
- Variables conocidas;
- herramientas externas disponibles;
- entrada manual del operador.

La salida se guarda como borrador. Nunca se crea un mensaje ni se envia automaticamente.

La Inbox muestra:

```text
Borrador IA para revision humana
```

El usuario debe copiar, ajustar o enviar manualmente el contenido.

## SmartTagClassifier

En modo real:

1. carga todos los Smart Tags activos de la organizacion;
2. construye contexto de lead, conversacion y mensajes;
3. solicita salida JSON estructurada;
4. valida tag IDs, confianza y motivo;
5. ignora IDs no autorizados;
6. asigna tags mediante las relaciones tenant existentes;
7. pausa IA cuando `auto_pause_assistant=true`.

En modo demo conserva la clasificacion heuristica.

## VariableExtractor

En modo real:

1. carga Variables activas;
2. envia definicion, tipo, opciones y prompt de extraccion;
3. usa Structured Outputs;
4. valida el valor con el contrato Zod existente;
5. valida que `source_message_id` pertenezca al contexto;
6. actualiza mediante upsert sin duplicados.

En modo demo conserva la extraccion heuristica.

## Logs

`ai_logs` registra:

- organizacion;
- asistente o conversacion;
- proveedor;
- modelo;
- modo `openai` o `demo`;
- resumen truncado del contexto;
- respuesta;
- estado;
- error seguro;
- response ID;
- input, output y total tokens cuando OpenAI los informa;
- origen de la accion;
- confirmacion humana requerida.

Los logs especializados continúan en:

- `smart_tag_classification_logs`;
- `variable_extraction_logs`;
- `ai_assistant_tests`.

## Rate limit

Antes de cada operacion se cuentan los logs IA de la organizacion durante el ultimo minuto.

Limite inicial:

```text
20 solicitudes por organizacion por minuto
```

La comprobacion respeta RLS y no usa estado global en memoria.

## Seguridad

- clave disponible solo en server actions;
- contexto sanitizado y truncado;
- prompts vacios rechazados;
- relaciones filtradas por `organization_id`;
- IDs devueltos por OpenAI se validan contra definiciones autorizadas;
- no se ejecutan tools automaticamente;
- no se envian mensajes automaticamente;
- errores visibles sin mostrar secretos.

## Pruebas

Unitarias con OpenAI mockeado:

- respuesta textual;
- Structured Output de Smart Tags;
- Structured Output de Variables;
- uso de tokens;
- validacion de tipos;
- fallback demo;
- clave requerida cuando demo esta desactivado.

Smoke funcional:

```powershell
npm run qa:ai:demo
```

El smoke usa Supabase local real y valida:

1. Auth y onboarding;
2. crear asistente;
3. crear Smart Tag;
4. crear Variable;
5. crear lead y conversacion;
6. guardar mensaje;
7. sugerir respuesta;
8. clasificar tags;
9. extraer variable;
10. persistencia visible en Inbox.

## Produccion

En Vercel:

1. agregar `OPENAI_API_KEY` como Secret;
2. agregar `OPENAI_MODEL=gpt-5.2`;
3. configurar `AI_DEMO_MODE=false`;
4. aplicar a Production, Preview y Development segun corresponda;
5. redeploy;
6. abrir una conversacion con mensajes reales;
7. pulsar `Sugerir respuesta con IA`;
8. confirmar que aparece `modo openai`;
9. probar Smart Tags y Variables;
10. revisar `ai_logs` sin exponer la clave.

Para volver temporalmente al fallback:

```env
AI_DEMO_MODE=true
```

No se necesita migracion para FASE 16.
