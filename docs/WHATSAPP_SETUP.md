# WhatsApp Cloud API

CRM PRO AI usa la WhatsApp Cloud API oficial de Meta para recibir webhooks y enviar mensajes manuales desde el Inbox.

Fuentes oficiales consultadas:

- [Meta Webhooks for WhatsApp](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/)
- [Create a webhook endpoint](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint/)
- [WhatsApp Business Phone Number Message API](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/message-api)

## Variables de entorno

Configurar en Vercel y localmente:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_GRAPH_API_VERSION=v23.0
```

`SUPABASE_SERVICE_ROLE_KEY` solo se usa en Route Handlers del servidor para procesar webhooks entrantes sin sesion de usuario. Nunca se expone al frontend.

`WHATSAPP_APP_SECRET` permite validar `x-hub-signature-256`. Es recomendado para produccion.

## Webhook

Endpoint:

```text
GET  /api/webhooks/whatsapp
POST /api/webhooks/whatsapp
```

En Meta Developers configurar:

- Callback URL: `https://<dominio>/api/webhooks/whatsapp`
- Verify token: valor exacto de `WHATSAPP_VERIFY_TOKEN`
- Webhook field: `messages`

El GET responde el `hub.challenge` cuando `hub.mode=subscribe` y el verify token coincide.

## Settings

En la app:

```text
Settings > Channels > WhatsApp
```

Configurar:

- Phone Number ID
- WhatsApp Business Account ID
- Telefono visible
- Canal habilitado

El webhook solo procesa payloads cuyo `phone_number_id` exista en `whatsapp_channel_settings` y este habilitado.

## Mensajes soportados

Recepcion:

- texto
- imagen
- audio
- documento
- ubicacion

Envio manual desde Inbox:

- texto

La estructura del servicio tambien deja preparado envio de imagen/documento con media id.
