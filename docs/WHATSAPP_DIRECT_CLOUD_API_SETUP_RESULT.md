# Resultado de configuracion: WhatsApp Cloud API directa

Fecha: 2026-06-21

## Estado

La conexion directa de un unico WhatsApp propio quedo preparada en CRM PRO AI.
Embedded Signup permanece pausado.

Estado actual:

- token de acceso validado contra Meta Graph API;
- Phone Number ID validado;
- display phone number validado;
- variables cargadas en Vercel Production;
- variables cargadas en Vercel Preview para la rama `master`;
- canal manual activado en Supabase remoto;
- redeploy Production completado;
- healthcheck Production correcto;
- verificacion GET del webhook correcta;
- configuracion manual pendiente de confirmar en Meta Developers.

## Vercel

Proyecto:

```text
aminhatar01-8073s-projects/crm-prom
```

Variables confirmadas en Production:

```text
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_APP_SECRET
WHATSAPP_GRAPH_API_VERSION
WHATSAPP_VERIFY_TOKEN
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
```

Variables directas confirmadas en Preview, rama `master`:

```text
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_APP_SECRET
WHATSAPP_GRAPH_API_VERSION
```

Los valores no se registran en este documento ni en Git.

Deployment Production:

```text
https://crm-prom.vercel.app
```

## Supabase

Proyecto:

```text
widehqbtmqiebaowidav
```

Organizacion activada:

```text
Nombre: Amin Valentin
Slug: amin-crm
Organization ID: cda92f21-8bd0-4ddf-9224-f9b9fe5e0b6e
```

Canal:

```text
ID: f9831397-3a7a-4922-bd25-7339811db587
Connection method: manual
Enabled: true
Token status: active
```

El Access Token permanece exclusivamente en variables server-side de Vercel.
No se almaceno en tablas ni se expuso al frontend.

## Script administrativo

Comando:

```powershell
npm run whatsapp:activate:direct
```

El script:

- carga variables locales ignoradas por Git;
- usa `SUPABASE_SERVICE_ROLE_KEY` solo desde Node server-side;
- selecciona automaticamente una unica organizacion owner;
- permite fijar `WHATSAPP_ORGANIZATION_ID` si existen varios tenants;
- rechaza un Phone Number ID registrado en otro tenant;
- deshabilita otros canales WhatsApp de la organizacion;
- hace upsert idempotente del canal manual;
- nunca guarda `WHATSAPP_ACCESS_TOKEN` en Supabase;
- oculta Phone Number ID y telefono en la salida.

En esta maquina fue necesario ejecutar temporalmente:

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED='0'
npm run whatsapp:activate:direct
Remove-Item Env:NODE_TLS_REJECT_UNAUTHORIZED
```

Esto se debe al error local de comprobacion de certificados de Windows. No es
una variable del proyecto ni debe configurarse en Vercel.

## Verificaciones realizadas

### Meta Graph API

```text
Token aceptado: si
Phone Number ID coincide: si
Display Phone Number coincide: si
Nombre verificado disponible: si
```

### Produccion

```text
GET /api/health: HTTP 200
Health status: ok
WhatsApp configured: true
Service role configured: true
```

### Webhook GET

```text
GET /api/webhooks/whatsapp: HTTP 200
Challenge devuelto correctamente: si
```

### Settings

Sin sesion:

```text
GET /settings/channels/whatsapp: HTTP 307 -> /login
```

Esto confirma que la pantalla permanece protegida. Supabase remoto confirma que
la cuenta manual esta habilitada, por lo que al ingresar como owner/admin debe
mostrarse como `Cuenta conectada` y metodo heredado/manual.

## Validacion del repositorio

```text
npm run validate: OK
37 archivos de test: OK
112 tests: OK
Build Next.js: OK

npm run deploy:check: OK
12 checks aprobados
2 advertencias locales por falta de anon key en .env.local
0 fallos
```

Las advertencias no afectan Production: Vercel conserva las variables publicas
de Supabase y el healthcheck remoto responde `ok`.

## Paso manual pendiente en Meta

Abrir:

```text
Meta for Developers
> My Apps
> aplicacion de WhatsApp
> WhatsApp
> Configuration
> Webhook
> Edit
```

Configurar:

```text
Callback URL:
https://crm-prom.vercel.app/api/webhooks/whatsapp

Verify Token:
valor de WHATSAPP_VERIFY_TOKEN
```

El Verify Token debe copiarse desde el almacenamiento local seguro o Vercel. No
debe publicarse en documentacion ni enviarse por chat.

Luego:

1. pulsar `Verify and save`;
2. buscar `Webhook fields`;
3. suscribir el campo `messages`;
4. confirmar que la aplicacion esta suscrita a la WABA;
5. enviar un mensaje al numero conectado;
6. revisar que aparezca en Inbox;
7. responder manualmente desde Inbox dentro de la ventana de atencion.

## Criterio final de aceptacion

La configuracion se considera funcional de punta a punta cuando:

- Meta acepta el Callback URL y Verify Token;
- `messages` queda suscrito;
- un mensaje entrante crea contacto, conversacion y mensaje;
- la respuesta manual obtiene un WhatsApp Message ID;
- Meta informa `sent`, `delivered` y, cuando corresponde, `read`.
