# Validacion FASE 3

## Alcance

- Webhook GET de verificacion Meta.
- Webhook POST de mensajes y statuses.
- `WhatsAppCloudService` para Graph API.
- Recepcion de texto, imagen, audio, documento y ubicacion.
- Envio manual de texto desde Inbox cuando la conversacion es WhatsApp.
- Persistencia en `messages` y `whatsapp_events`.
- Panel `Settings > Channels > WhatsApp`.

## Comandos

```bash
npm run lint
npm run build
npm run test
```

## Seguridad

- Webhook POST valida firma HMAC si `WHATSAPP_APP_SECRET` esta configurado.
- El procesamiento de webhook requiere `SUPABASE_SERVICE_ROLE_KEY` en servidor.
- El frontend no recibe access token ni service role key.
- Las nuevas tablas tienen RLS por `organization_id`.
- El webhook solo procesa `phone_number_id` configurados y habilitados.

## Realtime

La FASE 2 ya refresca el Inbox con cambios en `messages` y `conversations`.
FASE 3 agrega `whatsapp_events` a `supabase_realtime` para monitoreo operacional.
