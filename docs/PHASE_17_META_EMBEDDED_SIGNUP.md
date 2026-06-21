# FASE 17 - Meta Embedded Signup para WhatsApp

Fecha: 2026-06-21

## Objetivo

Permitir que cada organizacion conecte WhatsApp Cloud API desde `Conectar WhatsApp`, sin cargar manualmente:

- Phone Number ID;
- WABA ID;
- Access Token;
- Verify Token.

El Verify Token sigue existiendo como configuracion global del webhook de la app Meta, pero no es solicitado a los usuarios del CRM.

## Flujo

1. Owner o admin abre `Settings > Channels > WhatsApp`.
2. Pulsa `Conectar WhatsApp`.
3. Se carga el Facebook JavaScript SDK.
4. Meta abre Embedded Signup v4.
5. El usuario selecciona o crea su Business Portfolio, WABA y numero.
6. Meta devuelve:
   - codigo OAuth temporal;
   - WABA ID;
   - Phone Number ID.
7. El navegador envia esos datos y un state firmado al backend.
8. El backend intercambia el codigo antes de que expire.
9. El backend valida el token y comprueba que el numero pertenece a la WABA.
10. La app se suscribe a `/{WABA_ID}/subscribed_apps`.
11. El token se cifra con AES-256-GCM.
12. Supabase guarda metadata visible y credenciales privadas por organizacion.

## Configuracion global en Meta

Acciones manuales del operador:

1. Crear o abrir una Meta App de tipo Business.
2. Agregar WhatsApp y Facebook Login for Business.
3. Crear una configuracion de login:
   - variacion: WhatsApp Embedded Signup;
   - version: v4;
   - acceso offline/system-user;
   - expiracion: preferentemente `Never`;
   - activos: WhatsApp Accounts;
   - permisos: `whatsapp_business_management` y los requeridos para mensajeria.
4. Configurar dominios permitidos y HTTPS.
5. Completar App Review y Access Verification cuando Meta lo requiera.
6. Configurar el webhook existente:

```text
https://<dominio>/api/webhooks/whatsapp
```

7. Suscribir el campo `messages`.

Embedded Signup v2 queda fuera del alcance. Meta ha anunciado su deprecacion para el 15 de octubre de 2026.

## Variables Vercel

```env
META_APP_ID=
META_WHATSAPP_CONFIGURATION_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_TOKEN_ENCRYPTION_KEY=
WHATSAPP_GRAPH_API_VERSION=v23.0
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

Generar la clave de cifrado en PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

No cambiar la clave después de conectar cuentas sin ejecutar una rotacion controlada, porque los tokens existentes dejarian de poder descifrarse.

## Persistencia

### `whatsapp_channel_settings`

Contiene metadata no secreta:

- organization_id;
- Phone Number ID;
- WABA ID;
- telefono visible;
- nombre verificado;
- calidad;
- metodo de conexion;
- estado y expiracion del token;
- usuario y fecha de conexion.

### `whatsapp_channel_credentials`

Contiene:

- organization_id;
- referencia al canal;
- token cifrado;
- tipo y scopes;
- fechas de expiracion, validacion y renovacion.

La tabla:

- tiene RLS;
- no concede acceso a `anon` ni `authenticated`;
- solo es accesible mediante service role;
- valida integridad tenant con trigger especifico.

## Renovacion

Endpoint:

```text
GET /api/cron/whatsapp-tokens
POST /api/cron/whatsapp-tokens
```

Vercel lo ejecuta diariamente a las 06:00 UTC.

El proceso:

1. descifra el token en servidor;
2. consulta `/debug_token`;
3. marca tokens revocados;
4. conserva tokens sin expiracion;
5. intenta `fb_exchange_token` cuando faltan menos de siete dias;
6. guarda el nuevo token cifrado;
7. marca `refresh_failed` si Meta requiere una nueva autorizacion.

Meta no ofrece un refresh token estandar para todos los business integration system user tokens. Para evitar reconexiones periodicas, la configuracion de Embedded Signup debe usar token offline sin expiracion cuando la cuenta Meta lo permita.

## Compatibilidad

- El webhook GET/POST existente no cambia.
- La validacion `x-hub-signature-256` sigue usando `WHATSAPP_APP_SECRET`.
- Las cuentas manuales existentes siguen enviando mediante `WHATSAPP_ACCESS_TOKEN`.
- Las cuentas nuevas usan su token cifrado por organizacion.
- Inbox, mensajes y estados de entrega conservan el mismo flujo.

## Seguridad

- codigo OAuth con TTL corto intercambiado inmediatamente;
- state HMAC ligado a usuario y organizacion;
- comprobacion same-origin;
- solo owner/admin puede conectar;
- app ID validado mediante `/debug_token`;
- Phone Number ID validado contra la WABA;
- access token nunca llega a componentes React;
- credenciales cifradas con AES-256-GCM;
- auditoria de conexion;
- sin secretos en Git.

## Migracion

```text
20260621150000_phase_17_whatsapp_embedded_signup.sql
```

Aplicar sin reset:

```powershell
npx supabase db push
```

## Prueba en produccion

1. Aplicar migracion.
2. Agregar variables en Vercel.
3. Redeploy.
4. Abrir `/settings/channels/whatsapp`.
5. Pulsar `Conectar WhatsApp`.
6. Completar el popup oficial.
7. Confirmar que aparecen WABA, Phone Number ID y telefono.
8. Enviar un mensaje manual desde Inbox.
9. Enviar un mensaje al numero y verificar recepcion por webhook.
10. Revisar el cron y el estado del token.

## Referencias oficiales

- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview
- https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/subscribed-apps-api
- https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business
