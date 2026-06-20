# Deploy Assistant

Esta guia prepara CRM PRO AI para Supabase y Vercel sin automatizar acciones sobre cuentas externas.

## 1. Elegir escenario

### Demo sin WhatsApp real

- `AI_DEMO_MODE=true`.
- Dejar vacias las variables `WHATSAPP_*`.
- Usar Inbox manual y WebChat.

### IA demo

- `AI_DEMO_MODE=true`.
- `OPENAI_API_KEY` puede quedar vacia.
- Las sugerencias usan la respuesta demo y nunca se envian automaticamente.

### OpenAI real

- Cargar `OPENAI_API_KEY` solo en Vercel.
- Definir `OPENAI_MODEL`.
- Cambiar `AI_DEMO_MODE=false`.
- Confirmar limites y billing en OpenAI antes de habilitar usuarios.

### WhatsApp sandbox

- Crear la app en Meta Developers y agregar WhatsApp.
- Cargar `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`.
- Configurar el webhook `https://<dominio>/api/webhooks/whatsapp`.
- Mantener envios automaticos desactivados.

### Produccion

- Usar credenciales separadas de desarrollo.
- Configurar dominio, OpenAI, WhatsApp, cron y service role segun necesidad.
- Ejecutar `DEPLOY_STRICT=true npm run deploy:check`.
- Completar [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md).

## 2. Preparar GitHub

1. Confirmar que `git status` esta limpio.
2. Ejecutar `npm run predeploy`.
3. Subir los commits a GitHub.
4. No agregar `.env.local` ni copiar secrets en issues, commits o logs.

## 3. Preparar Supabase

1. Abrir el proyecto con ref `widehqbtmqiebaowidav`.
2. Instalar o autenticar Supabase CLI.
3. Vincular el repositorio cuando sea necesario:

```powershell
npx supabase link --project-ref widehqbtmqiebaowidav
npm run db:check
npm run db:push
```

4. Revisar RLS y Realtime desde el dashboard.
5. Usar `npm run db:seed` solo contra Supabase local. Ese comando reinicia la base local.

## 4. Preparar Vercel

1. Importar el repositorio GitHub.
2. Seleccionar Next.js y Root Directory `apps/web`.
3. Activar `Include source files outside of the Root Directory`.
4. Mantener el build command `npm run build`.
5. Cargar las variables para Preview y Production.
6. Desplegar y guardar la URL generada.

## 5. Variables

Obligatorias:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Server-only segun funcionalidad:

- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `CRON_SECRET`
- Todas las variables `WHATSAPP_*`

Nunca crear una variable `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.

## 6. Verificar canales

### WhatsApp

1. Configurar callback GET/POST en Meta.
2. Usar el mismo `WHATSAPP_VERIFY_TOKEN` en Meta y Vercel.
3. Suscribir eventos de mensajes.
4. Enviar un mensaje de prueba y comprobar Inbox.

### WebChat

1. Crear un widget desde Settings > Channels > WebChat.
2. Agregar el dominio permitido.
3. Insertar:

```html
<script src="https://<dominio>/widget/crm-pro-ai-widget.js" data-widget-token="<token-publico>" async></script>
```

4. Confirmar que un dominio no permitido recibe rechazo.

## 7. Healthcheck y System Status

1. Abrir `https://<dominio>/api/health`.
2. Esperar HTTP 200. HTTP 503 indica variables requeridas ausentes o invalidas.
3. Entrar como owner/admin.
4. Abrir Settings > System Status.

## 8. Rollback

1. En Vercel, promover el ultimo deployment estable.
2. Desactivar temporalmente WhatsApp, cron o IA real mediante variables si el incidente esta en una integracion.
3. No revertir migraciones destructivamente. Crear una migracion correctiva.
4. Rotar cualquier credencial posiblemente expuesta.
5. Ejecutar nuevamente healthcheck y smoke tests.

## Acciones manuales obligatorias

Codex no puede completar sin autorizacion humana:

- Crear o importar el proyecto en Vercel.
- Cargar variables y secrets en Vercel.
- Conectar y verificar un dominio.
- Crear/configurar la app en Meta Developers.
- Obtener tokens reales y registrar el webhook WhatsApp.
- Rotar credenciales o contrasenas.
- Revisar billing y limites de Vercel, Supabase, Meta y OpenAI.
- Cambiar la contrasena de Supabase si fue compartida.
