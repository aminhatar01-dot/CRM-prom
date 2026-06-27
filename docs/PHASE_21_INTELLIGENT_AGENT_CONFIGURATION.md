# FASE 21 - Configuracion Inteligente del Agente IA

## Objetivo

Cada organizacion configura su agente mediante decisiones de negocio y estilo. El sistema genera en servidor el prompt, objetivo, tono y reglas que ya consume `AIOrchestrator`. No se crean motores alternativos ni playbooks por rubro.

## Configurador guiado

1. **Empresa:** nombre del agente, rol, rubro, canal y descripcion.
2. **Oferta:** ventas, servicios, productos y objetivo principal.
3. **Personalidad:** formalidad, longitud, emojis, velocidad comercial y estilo.
4. **Conocimiento:** temas sugeridos para cargar en el modulo existente.
5. **Comportamiento:** datos requeridos, limites, escalamiento y playbooks editables.
6. **Prueba:** fallback, estado, auto respuesta y acceso a la prueba del asistente.

El usuario no ve ni edita el prompt tecnico. `buildAgentRuntime` deriva:

- `prompt`
- `objective`
- `tone`
- `rules`
- resumen de configuracion

## Playbooks

Los playbooks son instrucciones configurables de conversacion: primer contacto, seguimiento, ventas, soporte, cobranza, agenda, reservas, presupuesto y postventa. Guardarlos o habilitarlos no crea automatizaciones ni activa envios.

## Base de Conocimiento

El configurador sugiere productos, servicios, FAQs, politicas, garantias, catalogos, precios, horarios, inventario, procesos, documentos y URLs. La indexacion, embeddings y busqueda RAG no cambian.

## Seguridad y compatibilidad

- `agent_config` y `playbooks` viven en `ai_assistants`, por lo que usan su RLS y `organization_id` existentes.
- La migracion es aditiva y rellena configuracion inicial para asistentes existentes.
- WhatsApp, Inbox, automatizaciones, RAG, Pipeline y Graph API conservan sus contratos.
- `auto_reply_enabled` sigue requiriendo regla activa y conversacion en modo automatico.

## Prueba en produccion

1. Abrir **Asistentes IA** y crear o editar un asistente.
2. Completar los seis pasos y guardar.
3. Abrir el detalle y ejecutar una prueba sin conversacion.
4. Probar luego con una conversacion existente para validar historial y RAG.
5. Confirmar en Inbox que borrador/autoenvio respetan la configuracion previa.
