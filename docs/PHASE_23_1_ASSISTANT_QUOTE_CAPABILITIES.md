# FASE 23.1 - Cotizaciones como capacidad de asistentes

## Organizacion del producto

Cotizaciones deja de ser el punto de entrada principal y pasa a funcionar como registro, historial y soporte operativo. La experiencia principal comienza en WhatsApp o Inbox: el router identifica la intencion, selecciona un asistente con las capacidades apropiadas y responde, pide aclaraciones o prepara una cotizacion.

El modulo **Cotizaciones** se conserva para revision, edicion, aprobacion, envio, estados, enlace publico y auditoria.

## Router de asistentes

El router evalua:

- canal compatible;
- intencion funcional: precio, cotizacion, ventas, soporte, agenda/logistica, cobranza, postventa o general;
- temas atendidos y excluidos;
- capacidad para responder precios o crear cotizaciones;
- categorias relevantes recuperadas por RAG;
- prioridad configurada;
- asistente anterior e intencion anterior;
- continuidad corta del mensaje;
- asistente por defecto.

La decision guarda candidato, nombre, puntaje, razones, intencion, confianza, asistente anterior, cambio de asistente y fallback en `ai_logs.metadata.assistant_routing`. La conversacion conserva la ultima decision en `assistant_routing_metadata` y el asistente actual en `current_assistant_id`.

Las acciones de automatizacion ahora usan router automatico salvo que su configuracion declare expresamente `auto_route=false`. Esto mantiene compatibles las reglas antiguas que contienen un `assistant_id`.

## Asignacion manual

Inbox muestra el asistente actual y el motivo de seleccion. **Asignar** cambia la conversacion a modo manual y fija el asistente elegido. **Volver al router automatico** elimina la fijacion; el siguiente mensaje entrante puede mantener el especialista actual o cambiarlo según la intencion.

Los triggers verifican que los asistentes forzado y actual pertenezcan a la misma organizacion.

## Plantillas

Al crear un asistente se puede elegir:

- Ventas y precios;
- Cotizador;
- Soporte;
- Agenda y turnos;
- Cobranza;
- Postventa;
- Atencion general.

La plantilla precarga rol, objetivo, intencion, temas, exclusiones, capacidades y playbooks. Ningun valor queda bloqueado: el usuario puede editar toda la configuracion antes de guardar.

## Configurar un asistente cotizador

1. Ir a **Asistentes > Nuevo asistente**.
2. Elegir la plantilla **Cotizador**.
3. Configurar las categorias exactas del catalogo, moneda y condiciones comerciales.
4. Habilitar `Puede responder precios`, `Puede crear cotizaciones` y, si corresponde, `Puede enviar cotizaciones`.
5. Mantener `Requiere aprobacion humana` para el modo seguro.
6. Para autoenvio controlado, habilitar la capacidad correspondiente, definir monto maximo y habilitar además auto respuesta en el asistente, conversación automática y regla `auto_send=true`.

El permiso del asistente nunca evita los controles de ventana WhatsApp, idempotencia, rate limit, intención sensible y contexto suficiente.

## Flujo conversacional

### Precio simple

`¿Cuanto sale el taladro 20V?` selecciona un asistente con capacidad de precios. El motor busca el item en las categorias permitidas y responde con el precio verificado. Si hay opciones ambiguas pide elegir; si falta precio no usa la salida libre de OpenAI y deriva o pide confirmacion según la configuración.

### Cotizacion

`Cotizame 20 taladros y 10 mechas` selecciona un asistente con capacidad de cotizar. Si existen productos, cantidades y precios inequívocos, crea el registro y genera el resumen conversacional. Si falta cantidad, precio o existe ambigüedad, deja una aclaracion segura. El enlace sólo se incluye si el asistente puede enviar cotizaciones.

### Cambio de especialista

1. Preguntar un precio: debe aparecer Ventas y precios.
2. Enviar `Me llego mal el pedido`: debe cambiar a Soporte.
3. Enviar `Cotizame 20 unidades`: debe cambiar a Cotizador.
4. Responder brevemente a una pregunta del cotizador: debe mantenerlo por continuidad.

Inbox muestra el cambio y su motivo. Los mismos datos quedan en el log IA.

## Seguridad

- Capacidades desactivadas por defecto para asistentes existentes.
- Aprobacion humana de cotizaciones activada por defecto.
- Sin autoenvio global.
- Precio, stock, moneda y condiciones no se inventan.
- RLS existente permanece activo y las nuevas referencias se validan por `organization_id`.
- No se modifican webhook, Graph API, tokens, RAG ni importaciones.

## Despliegue

```powershell
npx supabase db push
git push origin main
```

No se requieren variables de entorno nuevas.
