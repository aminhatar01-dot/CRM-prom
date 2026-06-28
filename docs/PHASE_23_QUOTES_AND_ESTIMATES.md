# FASE 23 - Cotizaciones y presupuestos

## Resultado

CRM PRO AI incorpora cotizaciones multi-tenant creadas manualmente o desde una conversacion. Los precios, moneda, stock y disponibilidad generados desde Inbox proceden exclusivamente de documentos indexados de la Base de Conocimiento. Si falta cantidad, existe ambiguedad o no hay precio verificable, el sistema pide aclaracion y no crea ni envia un importe inventado.

## Preparar el catalogo

1. Ir a **Base de conocimiento > Importar conocimiento**.
2. Cargar CSV/XLSX/Google Sheets con columnas de producto o servicio, precio, moneda, SKU, stock y disponibilidad.
3. Mapear las columnas y comprobar que la fuente termina en estado `indexed`.
4. Usar una moneda ISO de tres letras, por ejemplo `ARS` o `USD`.

Un producto sin precio puede recuperarse como contexto, pero nunca se cotiza automaticamente. El sistema tampoco convierte monedas ni inventa descuentos, impuestos, plazos o stock.

## Cotizacion desde WhatsApp

1. El cliente envia una solicitud como `Cotizame 2 taladros profesionales`.
2. Abrir la conversacion en Inbox y pulsar **Crear cotizacion**.
3. El extractor obtiene productos y cantidades; la busqueda semantica los contrasta con el catalogo de la organizacion.
4. Si hay una coincidencia clara se crea una cotizacion `pending_approval`.
5. Revisar items, precio, vigencia y condiciones; pulsar **Aprobar y enviar**.
6. Se registra un mensaje outbound, el evento WhatsApp y el historial de la cotizacion.

Si falta cantidad, hay productos similares o el precio no esta publicado, Inbox muestra el motivo y el asesor debe pedir el dato puntual al cliente.

## Cotizacion manual

1. Ir a **Cotizaciones > Nueva cotizacion**.
2. Indicar cliente, moneda, items, cantidades, precios, descuentos, impuestos, vigencia y condiciones.
3. Guardar como borrador o pendiente de aprobacion.
4. Las cotizaciones asociadas a una conversacion WhatsApp pueden enviarse desde su detalle. Una cotizacion puramente manual puede editarse, duplicarse, marcarse aceptada/rechazada o archivarse.

Los totales se calculan nuevamente en PostgreSQL después de cada cambio de items; el total mostrado por el navegador no es la fuente de verdad.

## Enlace publico

Cada cotizacion posee un token aleatorio de 256 bits y una URL `/q/[token]`. La ruta publica consulta por ese token desde servidor y no dispone de policies anonimas sobre `quotes`, `quote_items` o `quote_events`. El cliente puede ver items y total, consultar por WhatsApp y aceptar una cotizacion vigente. La aceptacion genera un evento y una notificacion interna.

## Automatizaciones

Acciones disponibles:

- `create_quote`: crea una cotizacion pendiente desde el ultimo inbound si los datos son suficientes.
- `send_quote_draft`: crea la cotizacion y deja un borrador textual pendiente de revision humana.
- `mark_quote_sent`: marca una cotizacion especifica como enviada.
- `notify_quote_accepted`: crea una notificacion interna.

`send_quote_draft` fuerza `auto_send_requested=false`. La fase no activa ninguna regla ni envio global. El envio automatico sólo podrá habilitarse mediante reglas controladas que validen certeza de precio y stock.

## Seguridad y auditoria

- RLS usa `organization_id` y `is_org_member` en todas las tablas privadas.
- Triggers especificos validan lead, contacto, conversacion, documento fuente, items y eventos contra el mismo tenant.
- Los embeddings y la service role permanecen server-side.
- Envio WhatsApp usa el token recuperado por `getWhatsAppAccessToken`; nunca llega al cliente.
- Creacion, edicion, estados, duplicacion, envio, fallo y aceptacion se registran en `quote_events` y/o `audit_logs`.

## Limitaciones

- No genera PDF; se envia resumen en texto y enlace seguro.
- No convierte monedas.
- No reserva stock ni procesa pagos.
- La extraccion desde texto libre requiere cantidad explicita para crear una cotizacion.
- Un catalogo mal mapeado o sin precio requiere intervencion humana.

## Despliegue

Aplicar sin reset:

```powershell
npx supabase db push
git push origin main
```

No se agregan variables de entorno nuevas. Tras el deploy, validar una cotizacion manual y una conversación WhatsApp real con un producto existente en un catalogo indexado.
