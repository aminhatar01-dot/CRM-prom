# Meta Setup Guide - WhatsApp Embedded Signup

Esta guía corresponde a la implementación actual de **FASE 17** de CRM PRO AI.
El dominio de producción usado en los ejemplos es:

```text
https://crm-prom.vercel.app
```

No cargues tokens de acceso de clientes manualmente. Embedded Signup obtiene el
WABA ID, Phone Number ID y Access Token durante la conexión y los guarda cifrados
por organización.

## 1. Requisitos previos en Meta

1. Entra en [Meta for Developers](https://developers.facebook.com/apps/).
2. Crea o abre una aplicación de tipo **Business**.
3. Agrega el producto o caso de uso **WhatsApp**.
4. Agrega **Facebook Login for Business**.
5. Verifica que la aplicación pertenezca al Business Portfolio correcto.
6. Para pruebas, agrega tu cuenta como administrador o desarrollador de la app.
7. Para conectar empresas externas en producción, completa los procesos de
   App Review, acceso avanzado y Access Verification que Meta solicite.

La implementación usa Embedded Signup v4 mediante el SDK JavaScript de Meta.

## 2. Variables requeridas

### `META_APP_ID`

**Origen:** Meta genera este identificador al crear la aplicación.

**Pantalla:**

```text
Meta for Developers
> My Apps
> [tu aplicación]
> App settings
> Basic
> App ID
```

También suele aparecer en la cabecera del App Dashboard.

**Vercel:**

```env
META_APP_ID=123456789012345
```

No es un secreto, pero en esta aplicación se configura como variable de servidor.

### `META_WHATSAPP_CONFIGURATION_ID`

**Origen:** Meta genera este valor al crear la configuración de Facebook Login
for Business para WhatsApp Embedded Signup. No es el WABA ID.

**Pantalla:**

```text
Meta for Developers
> My Apps
> [tu aplicación]
> Facebook Login for Business
> Configurations
> Create configuration
```

Configura la experiencia con estas opciones:

- Login variation o template: **WhatsApp Embedded Signup**.
- Versión: **v4**.
- Assets: **WhatsApp Accounts**.
- Permisos de administración y mensajería de WhatsApp.
- Token: acceso offline o sin vencimiento cuando Meta ofrezca esa opción.

Después de guardar, abre la configuración y copia el valor **Configuration ID**.

```env
META_WHATSAPP_CONFIGURATION_ID=123456789012345
```

El botón usa este valor como `config_id` en `FB.login`.

### `WHATSAPP_APP_SECRET`

**Origen:** secreto generado por Meta para la aplicación.

**Pantalla:**

```text
Meta for Developers
> My Apps
> [tu aplicación]
> App settings
> Basic
> App secret
> Show
```

Meta puede pedir nuevamente tu contraseña.

```env
WHATSAPP_APP_SECRET=valor_secreto_de_meta
```

Este secreto se usa para:

- intercambiar el código OAuth por el Access Token;
- validar el token recibido;
- firmar el estado temporal del Embedded Signup;
- validar `x-hub-signature-256` en el webhook.

No debe llevar el prefijo `NEXT_PUBLIC_` ni aparecer en el navegador.

### `WHATSAPP_VERIFY_TOKEN`

**Origen:** no lo entrega Meta. Debes inventar un valor aleatorio y conservarlo
como secreto. El mismo valor debe configurarse en Vercel y en el webhook de Meta.

Generación recomendada en PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToHexString($bytes).ToLower()
```

```env
WHATSAPP_VERIFY_TOKEN=valor_aleatorio_generado
```

**Pantalla de Meta donde se utiliza:**

```text
Meta for Developers
> My Apps
> [tu aplicación]
> WhatsApp
> Configuration
> Webhook
> Edit
> Verify token
```

Meta enviará una petición GET al webhook. La ruta actual compara
`hub.verify_token` con esta variable y devuelve `hub.challenge`.

### `WHATSAPP_TOKEN_ENCRYPTION_KEY`

**Origen:** no existe en Meta. Es una clave interna de CRM PRO AI para cifrar los
Access Tokens antes de guardarlos en Supabase.

Debe ser exactamente una clave aleatoria de 32 bytes codificada en Base64.

Generación en PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

```env
WHATSAPP_TOKEN_ENCRYPTION_KEY=base64_generado
```

No cambies esta clave después de conectar cuentas. Una clave diferente no podrá
descifrar los tokens ya almacenados. Cualquier rotación debe descifrar y volver a
cifrar las credenciales de forma controlada.

### `CRON_SECRET`

**Origen:** no existe en Meta. Es un secreto interno para proteger los endpoints
cron del proyecto.

Puedes generarlo con el mismo comando usado para `WHATSAPP_VERIFY_TOKEN`:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToHexString($bytes).ToLower()
```

```env
CRON_SECRET=valor_aleatorio_generado
```

Vercel ejecuta diariamente:

```text
GET https://crm-prom.vercel.app/api/cron/whatsapp-tokens
```

El endpoint valida `Authorization: Bearer <CRON_SECRET>`. No debes registrar esta
URL en Meta.

## 3. Variable adicional necesaria para habilitar el botón

Aunque no pertenece a Meta, la pantalla considera Embedded Signup listo solo si
también existe:

```env
SUPABASE_SERVICE_ROLE_KEY=
```

Se obtiene en:

```text
Supabase Dashboard
> proyecto widehqbtmqiebaowidav
> Project Settings
> API Keys
> service_role / secret key del servidor
```

Debe configurarse únicamente en Vercel. Nunca debe usar el prefijo
`NEXT_PUBLIC_`.

## 4. URLs que debes configurar en Meta

### Dominio de la aplicación

Pantalla:

```text
App settings
> Basic
> App domains
```

Valor:

```text
crm-prom.vercel.app
```

En este campo se usa el dominio sin `https://` y sin una ruta.

### Sitio web de la aplicación

Si Meta solicita agregar la plataforma Website:

```text
App settings
> Basic
> Add platform
> Website
> Site URL
```

Valor:

```text
https://crm-prom.vercel.app/
```

### Dominio permitido para el SDK JavaScript

Pantalla:

```text
Facebook Login for Business
> Settings
> Allowed domains for the JavaScript SDK
```

Agrega:

```text
crm-prom.vercel.app
```

Si la interfaz de Meta exige una URL completa, utiliza:

```text
https://crm-prom.vercel.app
```

No agregues URLs de preview de Vercel salvo que quieras probar explícitamente en
un deployment preview y comprendas que cada hostname deberá autorizarse.

### Callback del webhook

Pantalla:

```text
WhatsApp
> Configuration
> Webhook
> Edit
```

Callback URL:

```text
https://crm-prom.vercel.app/api/webhooks/whatsapp
```

Verify token:

```text
El valor exacto de WHATSAPP_VERIFY_TOKEN
```

### URLs que no debes registrar como callback OAuth

La implementación usa `FB.login` con `response_type: "code"` y envía el código
desde el navegador al backend. Por ello, estas rutas no son callbacks para
registrar en Meta:

```text
/api/integrations/whatsapp/embedded-signup/complete
/api/cron/whatsapp-tokens
```

La primera es un endpoint interno autenticado del CRM y la segunda pertenece al
cron de Vercel.

## 5. Webhook que debes registrar

Registra un único webhook global para la aplicación:

```text
GET  https://crm-prom.vercel.app/api/webhooks/whatsapp
POST https://crm-prom.vercel.app/api/webhooks/whatsapp
```

En Meta ambos corresponden a la misma **Callback URL**:

```text
https://crm-prom.vercel.app/api/webhooks/whatsapp
```

Pasos:

1. Abre **WhatsApp > Configuration**.
2. En **Webhook**, pulsa **Edit**.
3. Pega la Callback URL.
4. Pega exactamente el valor de `WHATSAPP_VERIFY_TOKEN`.
5. Pulsa **Verify and save**.
6. En **Webhook fields**, suscribe el campo **messages**.

Durante Embedded Signup, el backend llama automáticamente a:

```text
POST /{WABA_ID}/subscribed_apps
```

Esto asocia la WABA elegida al webhook de la aplicación. No debes crear un
webhook distinto por organización.

## 6. Configuración exacta en Vercel

Abre:

```text
Vercel Dashboard
> crm-prom
> Settings
> Environment Variables
```

Agrega como mínimo:

```env
META_APP_ID=
META_WHATSAPP_CONFIGURATION_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_TOKEN_ENCRYPTION_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
WHATSAPP_GRAPH_API_VERSION=v23.0
```

Recomendación:

- habilita las variables para **Production**;
- utiliza los mismos valores en Preview solo si realmente probarás Embedded
  Signup en previews autorizados por Meta;
- no habilites ninguna de estas variables para el navegador;
- no escribas comillas alrededor de los valores;
- evita espacios al inicio o al final.

Después de guardar las variables debes realizar un **Redeploy**. Vercel no agrega
variables nuevas a un deployment que ya estaba construido.

## 7. Cómo eliminar “Pendiente en Vercel”

El indicador **Embedded Signup > Pendiente en Vercel** desaparece únicamente
cuando el servidor encuentra las cinco variables siguientes:

```text
META_APP_ID
META_WHATSAPP_CONFIGURATION_ID
WHATSAPP_APP_SECRET
WHATSAPP_TOKEN_ENCRYPTION_KEY
SUPABASE_SERVICE_ROLE_KEY
```

`WHATSAPP_VERIFY_TOKEN` aparece en un indicador separado llamado
**Webhook existente**. `CRON_SECRET` protege la renovación programada, pero no
forma parte de la condición que muestra el botón.

Procedimiento:

1. Confirma que la migración de FASE 17 fue aplicada:

   ```powershell
   npx supabase db push
   ```

2. Agrega las cinco variables anteriores en Vercel para **Production**.
3. Agrega también `WHATSAPP_VERIFY_TOKEN` y `CRON_SECRET`.
4. Guarda los cambios.
5. Ve a **Deployments**, abre el deployment más reciente y pulsa **Redeploy**.
6. Espera a que el deployment finalice correctamente.
7. Cierra sesión o recarga completamente:

   ```text
   https://crm-prom.vercel.app/settings/channels/whatsapp
   ```

8. Entra con un usuario cuyo rol sea `owner` o `admin`.

Después del redeploy:

- **Embedded Signup** debe indicar `Configurado`;
- debe aparecer el botón **Conectar WhatsApp**;
- **Webhook existente** debe indicar `Listo` si `WHATSAPP_VERIFY_TOKEN` existe.

## 8. Diagnóstico si el botón sigue sin aparecer

1. Comprueba que las variables están en el proyecto Vercel correcto.
2. Comprueba que están habilitadas para **Production**.
3. Confirma que hiciste redeploy después de agregarlas.
4. Verifica que `WHATSAPP_TOKEN_ENCRYPTION_KEY` sea Base64 de 32 bytes.
5. Confirma que `SUPABASE_SERVICE_ROLE_KEY` no esté vacía.
6. Confirma que el usuario sea `owner` o `admin`; un `agent` no puede conectar
   canales.
7. Abre **Settings > System Status** y revisa WhatsApp, Service Role y Cron.
8. Ejecuta localmente, sin imprimir secretos:

   ```powershell
   npm run deploy:check
   ```

9. Si el botón aparece pero el popup falla, revisa:
   - App ID y Configuration ID pertenecen a la misma Meta App;
   - el dominio está autorizado para el SDK JavaScript;
   - Facebook Login for Business está agregado;
   - la configuración es WhatsApp Embedded Signup v4;
   - tu usuario tiene acceso a la Meta App y al Business Portfolio;
   - la app tiene los permisos y revisiones requeridos por Meta.

10. Si el popup termina pero el CRM muestra error:
    - revisa los logs de la función en Vercel;
    - confirma que la migración de FASE 17 está aplicada;
    - confirma que el Phone Number pertenece a la WABA seleccionada;
    - confirma que Meta permite suscribir la WABA a la aplicación.

## 9. Prueba final

1. Pulsa **Conectar WhatsApp**.
2. Inicia sesión en Meta.
3. Selecciona o crea el Business Portfolio.
4. Selecciona o crea la WABA.
5. Selecciona o registra el número.
6. Finaliza Embedded Signup.
7. Comprueba que el CRM muestra:
   - WABA ID;
   - Phone Number ID;
   - número visible;
   - token activo.
8. Envía un mensaje al número conectado.
9. Confirma que aparece en Inbox.
10. Responde manualmente desde Inbox.

## Referencias oficiales

- [Embedded Signup: implementación](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/implementation/)
- [Embedded Signup v4](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/version-4/)
- [Facebook Login for Business](https://developers.facebook.com/documentation/facebook-login/facebook-login-for-business)
- [Crear un webhook de WhatsApp](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint/)
- [Configuración básica de Meta App](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/basic-settings/)
