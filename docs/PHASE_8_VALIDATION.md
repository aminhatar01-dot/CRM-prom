# FASE 8 Validation

## Alcance implementado

- Tabla `webchat_widgets` con RLS.
- Configuracion en `Settings > Channels > WebChat`.
- Script publico `/widget/crm-pro-ai-widget.js`.
- Endpoint publico para iniciar conversacion.
- Endpoint publico para enviar mensaje.
- Endpoint publico para consultar historial.
- Creacion/actualizacion de lead o contacto desde WebChat.
- Conversaciones `channel='webchat'` visibles en Inbox.
- Mensajes entrantes y salientes persistidos.
- Token publico, dominios permitidos, CORS y rate limit basico.
- Widget demo local con seed.

## Validacion manual

1. Aplicar migraciones y seeds.
2. Abrir `/settings/channels/webchat`.
3. Confirmar que exista token demo o crear un widget nuevo.
4. Verificar que `localhost` este en dominios permitidos.
5. Insertar el script en una pagina HTML local.
6. Abrir el widget y enviar un mensaje.
7. Confirmar en `/inbox?channel=webchat` que aparece la conversacion.
8. Responder manualmente desde Inbox.
9. Usar "Sugerir respuesta con IA" si hay asistente activo.
10. Quitar el dominio permitido y confirmar bloqueo de endpoint.

## Validacion tecnica

```bash
npm run lint
npm run build
npm run test
```

## Demo local

Token seed:

```text
wchat_demo_local_token_00000000000000000001
```

Script:

```html
<script src="http://localhost:3000/widget/crm-pro-ai-widget.js" data-widget-token="wchat_demo_local_token_00000000000000000001" async></script>
```

## Seguridad

- No se exponen secrets en frontend.
- El service role no sale del servidor.
- Los endpoints publicos validan token y dominio.
- El historial solo se lee si la conversacion pertenece al mismo widget.
- No hay envio automatico con IA.
