# Auditoria: WhatsApp Cloud API directa

Fecha: 2026-06-21

## Resumen ejecutivo

CRM PRO AI puede operar inicialmente con una integracion directa de WhatsApp
Cloud API para una unica cuenta propiedad del operador, sin usar Embedded Signup
y sin completar la certificacion como Meta Technology Provider.

La ruta directa ya esta soportada por compatibilidad heredada:

- el esquema guarda configuracion y eventos de WhatsApp;
- el webhook recibe mensajes y estados;
- el Inbox envia texto mediante Graph API;
- el token manual se obtiene desde `WHATSAPP_ACCESS_TOKEN`;
- las conversaciones entrantes aparecen en el Inbox.

No esta listo para activarse completamente desde la interfaz actual. FASE 17
retiro el formulario manual y dejo solo `Conectar WhatsApp`. Para la conexion
directa se deben cargar variables en Vercel y crear o actualizar una fila
`connection_method = 'manual'` en Supabase.

## Estado de la implementacion

### Tablas existentes

#### `whatsapp_channel_settings`

Existe desde FASE 3 y contiene:

- `organization_id`;
- `phone_number_id`;
- `business_account_id` (WABA ID);
- `display_phone_number`;
- `enabled`;
- `connection_method`;
- estado y metadata del token.

Tiene RLS:

- miembros pueden leer;
- owner/admin pueden administrar;
- cada registro pertenece a una organizacion.

Para conexion directa debe usarse:

```text
connection_method = manual
enabled = true
```

#### `whatsapp_events`

Existe y registra:

- mensajes entrantes;
- mensajes salientes;
- cambios de estado;
- errores;
- IDs de mensaje, conversacion y telefono;
- payload de Meta.

Tiene RLS y esta incluida en Supabase Realtime.

#### `whatsapp_channel_credentials`

Existe desde FASE 17, pero solo es necesaria para Embedded Signup. La conexion
manual no lee esta tabla: usa `WHATSAPP_ACCESS_TOKEN` desde el servidor.

### Conversaciones y mensajes

Las tablas generales ya soportan:

- canal `whatsapp`;
- `external_contact_id`;
- `external_message_id`;
- media ID, MIME type y nombre;
- ubicacion;
- estados `sent`, `delivered`, `read` y `failed`.

## Webhook receptor

Existe:

```text
GET  /api/webhooks/whatsapp
POST /api/webhooks/whatsapp
```

Produccion:

```text
https://crm-prom.vercel.app/api/webhooks/whatsapp
```

### GET

Valida:

- `hub.mode=subscribe`;
- `hub.verify_token`;
- `hub.challenge`.

El token debe coincidir con `WHATSAPP_VERIFY_TOKEN`.

### POST

El endpoint:

1. valida `x-hub-signature-256` cuando existe `WHATSAPP_APP_SECRET`;
2. valida el payload con Zod;
3. identifica la organizacion mediante `phone_number_id`;
4. crea o reutiliza el contacto;
5. crea o reutiliza una conversacion WhatsApp abierta;
6. guarda el mensaje;
7. registra el evento;
8. actualiza estados de mensajes salientes.

Recepcion implementada:

- texto;
- imagen;
- audio;
- documento;
- ubicacion;
- estados de entrega, lectura y fallo.

Condicion indispensable: debe existir un registro habilitado en
`whatsapp_channel_settings` cuyo `phone_number_id` coincida con el enviado por
Meta.

## Envio mediante Graph API

Existe `WhatsAppCloudService`.

Envio:

```text
POST https://graph.facebook.com/{VERSION}/{PHONE_NUMBER_ID}/messages
Authorization: Bearer {WHATSAPP_ACCESS_TOKEN}
```

El Inbox:

1. crea el mensaje saliente;
2. busca un canal habilitado de la organizacion;
3. si `connection_method != embedded_signup`, lee `WHATSAPP_ACCESS_TOKEN`;
4. envia texto por Graph API;
5. guarda el ID externo;
6. marca `sent` o `failed`;
7. registra `whatsapp_events`.

El servicio tambien tiene envio de media por `media_id`, aunque el flujo manual
actual del Inbox esta centrado en texto.

## Variables para conexion directa

### Estado actual en Vercel Production

| Variable | Estado |
| --- | --- |
| `WHATSAPP_VERIFY_TOKEN` | Configurada |
| `SUPABASE_SERVICE_ROLE_KEY` | Configurada |
| `WHATSAPP_TOKEN_ENCRYPTION_KEY` | Configurada, no necesaria para modo manual |
| `CRON_SECRET` | Configurada, no necesaria para modo manual |
| `WHATSAPP_ACCESS_TOKEN` | Falta |
| `WHATSAPP_PHONE_NUMBER_ID` | Falta |
| `WHATSAPP_APP_SECRET` | Falta |
| `WHATSAPP_GRAPH_API_VERSION` | Falta; el codigo usa `v23.0` por defecto |

### Variables obligatorias

```env
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
SUPABASE_SERVICE_ROLE_KEY=
```

### Requerida para seguridad de produccion

```env
WHATSAPP_APP_SECRET=
```

Sin App Secret el webhook acepta payloads sin verificar la firma. El codigo lo
permite por compatibilidad, pero no debe considerarse una configuracion de
produccion segura.

### Recomendada para fijar version

```env
WHATSAPP_GRAPH_API_VERSION=v23.0
```

### No requeridas para conexion directa

```text
META_WHATSAPP_CONFIGURATION_ID
WHATSAPP_TOKEN_ENCRYPTION_KEY
CRON_SECRET
```

`META_APP_ID` no es leido por el flujo manual del CRM, aunque naturalmente la
Meta App tiene un App ID.

## Requisitos de Meta sin Technology Provider

Para conectar solamente el WhatsApp propiedad del operador:

1. Crear o usar una Meta App de tipo Business.
2. Asociarla al Business Portfolio del propietario.
3. Agregar el producto WhatsApp.
4. En `WhatsApp > API Setup`, crear o seleccionar la WABA.
5. Agregar y verificar el numero de empresa.
6. Obtener:
   - Phone Number ID;
   - WhatsApp Business Account ID;
   - token de acceso.
7. Para pruebas iniciales puede usarse el token temporal de API Setup.
8. Para operacion continua, crear un System User en Business Settings, asignarle
   la app y los activos de WhatsApp, y generar un token con:
   - `whatsapp_business_messaging`;
   - `whatsapp_business_management`.
9. Configurar el webhook y suscribir `messages`.
10. Crear la configuracion manual del canal en Supabase.

Esto no convierte al operador en Technology Provider. Embedded Signup y su
certificacion son necesarios para incorporar cuentas de terceros mediante un
flujo SaaS autoservicio; no para que el negocio opere su propia WABA.

Meta puede exigir verificacion del negocio, revision del nombre visible,
metodo de pago o permisos adicionales conforme la cuenta pase de prueba a
produccion. Esos requisitos son distintos de la certificacion Technology
Provider.

## Procedimiento exacto de puesta en marcha

### 1. Crear la app y numero en Meta

1. Abrir [Meta for Developers](https://developers.facebook.com/apps/).
2. Crear o abrir una app Business.
3. Agregar WhatsApp.
4. Ir a:

   ```text
   WhatsApp > API Setup
   ```

5. Para una prueba rapida:
   - usar el numero de prueba de Meta;
   - agregar el telefono receptor permitido;
   - copiar el token temporal;
   - copiar Phone Number ID y WABA ID.
6. Para el numero real:
   - seleccionar `Add phone number`;
   - completar perfil y nombre visible;
   - verificar el numero por SMS o llamada;
   - copiar Phone Number ID y WABA ID.

Un numero real debe cumplir los requisitos de Meta y estar registrado para Cloud
API. Si ya se usa en otra modalidad de WhatsApp, se debe seguir el procedimiento
de migracion o coexistencia que Meta ofrezca para esa cuenta.

### 2. Obtener un token estable

Para una prueba breve puede usarse el token temporal de `WhatsApp > API Setup`.
No debe considerarse permanente.

Para produccion:

1. Abrir Meta Business Settings.
2. Ir a:

   ```text
   Users > System Users
   ```

3. Crear un System User con rol administrador.
4. Asignar activos:
   - Meta App;
   - WhatsApp Account;
   - numero correspondiente.
5. Generar un token para la app con:
   - `whatsapp_business_messaging`;
   - `whatsapp_business_management`.
6. Guardarlo como `WHATSAPP_ACCESS_TOKEN`.

### 3. Configurar variables en Vercel

Proyecto:

```text
Vercel > crm-prom > Settings > Environment Variables
```

Agregar en Production:

```env
WHATSAPP_ACCESS_TOKEN=<token de Meta>
WHATSAPP_PHONE_NUMBER_ID=<Phone Number ID>
WHATSAPP_APP_SECRET=<App Secret>
WHATSAPP_GRAPH_API_VERSION=v23.0
```

Ya existen:

```text
WHATSAPP_VERIFY_TOKEN
SUPABASE_SERVICE_ROLE_KEY
```

Todos los secretos deben ser server-side y nunca llevar `NEXT_PUBLIC_`.

### 4. Configurar el webhook en Meta

Ir a:

```text
Meta App > WhatsApp > Configuration > Webhook
```

Configurar:

```text
Callback URL:
https://crm-prom.vercel.app/api/webhooks/whatsapp

Verify token:
valor exacto de WHATSAPP_VERIFY_TOKEN
```

Luego:

1. pulsar `Verify and save`;
2. suscribir el campo `messages`;
3. confirmar que la app esta suscrita a la WABA.

### 5. Crear el canal manual en Supabase

Primero obtener la organizacion del propietario:

```sql
select
  o.id,
  o.name,
  o.slug,
  om.role,
  om.user_id
from public.organizations o
join public.organization_members om on om.organization_id = o.id
where om.role = 'owner'
order by o.created_at;
```

Seleccionar cuidadosamente el `organization_id` correcto y ejecutar:

```sql
insert into public.whatsapp_channel_settings (
  organization_id,
  phone_number_id,
  business_account_id,
  display_phone_number,
  webhook_verify_token_hint,
  enabled,
  connection_method,
  token_status,
  connected_at
)
values (
  '<ORGANIZATION_ID>',
  '<PHONE_NUMBER_ID>',
  '<WABA_ID>',
  '<NUMERO_VISIBLE>',
  'configured-in-vercel',
  true,
  'manual',
  'active',
  now()
)
on conflict (organization_id, phone_number_id)
do update set
  business_account_id = excluded.business_account_id,
  display_phone_number = excluded.display_phone_number,
  enabled = true,
  connection_method = 'manual',
  token_status = 'active',
  connected_at = now();
```

No guardar el Access Token en esta tabla. El modo manual lo obtiene de Vercel.

Verificar:

```sql
select
  organization_id,
  phone_number_id,
  business_account_id,
  display_phone_number,
  enabled,
  connection_method,
  token_status
from public.whatsapp_channel_settings
where organization_id = '<ORGANIZATION_ID>';
```

Debe existir un solo canal habilitado para la organizacion durante esta etapa.

### 6. Redeploy

Las variables nuevas no afectan deployments anteriores. Hacer redeploy del
deployment Production después de cargarlas.

### 7. Prueba funcional

1. Enviar un mensaje desde un telefono personal al numero conectado.
2. Confirmar que Meta entrega un POST al webhook.
3. Confirmar que aparecen contacto, conversacion y mensaje en Inbox.
4. Responder manualmente desde Inbox.
5. Confirmar estado `sent`.
6. Confirmar actualizaciones `delivered` y `read`.
7. Revisar `whatsapp_events` si hay errores.

## Limitaciones y riesgos detectados

### La UI muestra Embedded Signup como pendiente

La pagina de Settings evalua solamente la configuracion Embedded Signup para el
indicador `Pendiente en Vercel`. Una conexion manual puede funcionar aunque ese
indicador siga pendiente.

La cuenta manual habilitada aparecera como cuenta conectada, pero la pagina
seguira ofreciendo migrarla mediante Embedded Signup.

### No existe formulario manual actual

La configuracion debe realizarse en Vercel y Supabase. No es un bloqueo de
backend, pero no es una experiencia autoservicio.

### Ventana de atencion de WhatsApp

El Inbox envia texto libre. Para conversaciones iniciadas por la empresa fuera
de la ventana de atencion permitida por Meta se necesita una plantilla aprobada.
El flujo actual no implementa envio de templates desde el Inbox.

La prueba mas segura es:

1. el cliente envia primero un mensaje;
2. el agente responde desde Inbox dentro de la ventana de atencion.

### Token temporal

El token de `API Setup` puede expirar. Para uso continuo debe sustituirse por un
System User token apropiado. La renovacion automatica de FASE 17 solo procesa
credenciales de Embedded Signup, no `WHATSAPP_ACCESS_TOKEN`.

### Un canal habilitado por organizacion

El envio obtiene un unico canal habilitado mediante `maybeSingle()`. Si hay mas
de uno, puede fallar. La puesta en marcha inicial debe mantener un unico registro
`enabled = true`.

### Unicidad de Phone Number ID entre tenants

La base garantiza unicidad por `(organization_id, phone_number_id)`, no unicidad
global. El webhook busca una sola fila por Phone Number ID. Para una unica cuenta
del propietario no es un bloqueo, pero el mismo Phone Number ID no debe
registrarse en organizaciones diferentes.

## Checklist

### Meta

- [ ] Meta App Business creada.
- [ ] Producto WhatsApp agregado.
- [ ] Business Portfolio correcto.
- [ ] WABA propia creada o seleccionada.
- [ ] Numero de prueba o numero real agregado.
- [ ] Numero real verificado, si corresponde.
- [ ] Phone Number ID copiado.
- [ ] WABA ID copiado.
- [ ] App Secret copiado.
- [ ] Token temporal obtenido para smoke test.
- [ ] System User creado para operacion continua.
- [ ] App y activos WhatsApp asignados al System User.
- [ ] Token con `whatsapp_business_messaging`.
- [ ] Token con `whatsapp_business_management`.

### Vercel

- [x] `WHATSAPP_VERIFY_TOKEN`.
- [x] `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] `WHATSAPP_ACCESS_TOKEN`.
- [ ] `WHATSAPP_PHONE_NUMBER_ID`.
- [ ] `WHATSAPP_APP_SECRET`.
- [ ] `WHATSAPP_GRAPH_API_VERSION=v23.0`.
- [ ] Variables solo server-side.
- [ ] Redeploy Production realizado.

### Webhook

- [ ] Callback URL configurada.
- [ ] Verify Token coincide con Vercel.
- [ ] Verificacion GET exitosa.
- [ ] Campo `messages` suscrito.
- [ ] App suscrita a la WABA.
- [ ] Firma HMAC validada con App Secret.

### Supabase

- [ ] Organization ID del propietario confirmado.
- [ ] Canal manual insertado o actualizado.
- [ ] Phone Number ID correcto.
- [ ] WABA ID correcto.
- [ ] `connection_method = manual`.
- [ ] `enabled = true`.
- [ ] `token_status = active`.
- [ ] Solo un canal habilitado en la organizacion.
- [ ] Token no almacenado en tablas publicas.

### Prueba

- [ ] Cliente envia primero un mensaje.
- [ ] Contacto creado o reutilizado.
- [ ] Conversacion WhatsApp visible.
- [ ] Mensaje entrante visible en Inbox.
- [ ] Respuesta manual enviada.
- [ ] Mensaje obtiene ID externo.
- [ ] Estado `sent`.
- [ ] Estado `delivered`.
- [ ] Estado `read`, si el destinatario lo permite.
- [ ] Eventos registrados sin errores.

## Dictamen

La integracion directa es viable y es el camino recomendado para poner en marcha
el WhatsApp propio de CRM PRO AI antes de completar Technology Provider.

No requiere cambios de negocio ni Embedded Signup. Requiere:

1. obtener tres valores de Meta;
2. cargar cuatro variables faltantes en Vercel;
3. configurar el webhook;
4. insertar la configuracion manual de la organizacion;
5. redeploy y smoke test.

## Referencias oficiales

- https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started
- https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/create-webhook-endpoint/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview/
- https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/message-api
- https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/phone-numbers
