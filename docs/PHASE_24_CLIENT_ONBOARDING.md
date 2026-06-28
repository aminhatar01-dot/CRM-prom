# FASE 24 - Onboarding inteligente del cliente

## Objetivo

El onboarding permite que una empresa nueva configure CRM PRO AI sin escribir prompts ni conocer Supabase, OpenAI o automatizaciones. El progreso queda guardado por `organization_id` y puede retomarse desde `/onboarding` o **Settings > Configuración**.

## Flujo completo

1. **Negocio**: nombre comercial, rubro libre, descripción, país, moneda, horarios y objetivo.
2. **Actividad**: productos, servicios, soporte, turnos, cotizaciones, postventa, cobranzas u otro.
3. **Asistentes**: sugerencias basadas en casos de uso. Los asistentes se crean activos, editables y con auto respuesta apagada.
4. **Estilo**: tono, formalidad, emojis, longitud, personalidad, reglas y derivación humana. El sistema regenera los prompts internos de los asistentes creados.
5. **Conocimiento**: documento manual indexado o acceso al importador existente para CSV, XLSX, PDF, DOCX, TXT, Google Sheets y URL pública.
6. **WhatsApp**: muestra conexión, estado del token, webhook y número. Si ya funciona, no modifica nada ni solicita credenciales.
7. **Automatizaciones**: opciones explícitas, inicialmente desmarcadas. El modo borrador crea una regla sin autoenvío. La IA automática controlada sólo funciona si además el asistente y la conversación lo permiten.
8. **Prueba**: simula mensaje y canal, ejecuta el router real y muestra asistente, fuentes y política de envío. No crea mensajes ni llama Graph API.
9. **Checklist**: resume negocio, asistentes, conocimiento, WhatsApp, automatizaciones y prueba.

## Plantillas inteligentes

Las plantillas representan casos de uso, no rubros cerrados:

- negocio general;
- ventas;
- soporte;
- ecommerce;
- servicios profesionales;
- turnos y reservas;
- cotizaciones;
- cobranza.

El rubro siempre es texto libre. Las recomendaciones combinan las necesidades elegidas y pueden editarse posteriormente.

## Base de conocimiento

Para una configuración mínima, crear un documento con servicios, productos, horarios, políticas y preguntas frecuentes. Para precios o cotizaciones, importar una tabla con producto/servicio, precio, moneda, SKU, stock y disponibilidad. El dashboard advierte si no detecta catálogo indexado.

## WhatsApp

El paso consulta `whatsapp_channel_settings` y la existencia server-side del verify token. Estados mostrados:

- conectado o no conectado;
- credencial activa, vencida o faltante;
- webhook configurado o pendiente;
- número vinculado.

La pantalla enlaza a la configuración actual y no cambia tokens, webhook ni Graph API.

## Automatizaciones seguras

Todas las opciones aparecen apagadas. Al seleccionarlas se crean reglas identificables con prefijo `Onboarding -` y se evitan duplicados por nombre. Los borradores usan `auto_send=false`. El modo automático requiere una selección explícita y sigue limitado por conversación, asistente, ventana WhatsApp, contexto, rate limit e idempotencia.

## Dashboard de configuración

`/settings/setup` calcula el porcentaje desde datos reales:

- perfil completo;
- asistentes activos;
- documentos o importaciones indexadas;
- WhatsApp activo;
- automatizaciones activas;
- prueba guiada completada.

También muestra tareas pendientes, advertencia de catálogo y cantidad de asistentes con auto respuesta.

## Seguridad

- `organization_onboarding` tiene RLS por organización.
- Sólo miembros administradores pueden crear o modificar la configuración.
- No se almacenan secretos en el onboarding.
- No se activa autoenvío global.
- No se ejecutan envíos durante la simulación.
- No se modifican WhatsApp, Inbox, router, cotizaciones o importaciones existentes.

## Prueba en producción

1. Abrir `/onboarding` con un owner o admin.
2. Completar los pasos 1 a 4 y confirmar los asistentes en `/assistants`.
3. Indexar un documento o importar un catálogo.
4. Confirmar el estado de WhatsApp sin cambiar su configuración.
5. Mantener automatizaciones apagadas o activar sólo **Generar borradores IA**.
6. Simular una consulta de precio y revisar asistente, fuentes y motivo.
7. Finalizar y revisar `/settings/setup`.

No se requieren variables de entorno nuevas.
