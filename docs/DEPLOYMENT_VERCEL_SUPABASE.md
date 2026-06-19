# Deploy Vercel + Supabase

## 1. Supabase

1. Crear o abrir el proyecto Supabase.
2. Confirmar Project Ref: `widehqbtmqiebaowidav`.
3. Ejecutar migraciones:

```bash
npm run db:push
```

4. Cargar datos demo/locales solo cuando corresponda:

```bash
npm run db:seed
```

`db:seed` usa `supabase db reset --local`; no ejecutarlo contra produccion.

## 2. Vercel

1. Importar el repositorio GitHub en Vercel.
2. Framework: Next.js.
3. Root directory: `apps/web`.
4. Activar `Include source files outside of the Root Directory` para que Vercel incluya los paquetes del monorepo.
5. Build command: `npm run build`.
6. Output: Next.js default.

## 3. Variables de entorno

Obligatorias:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Recomendadas para produccion:

```bash
NEXT_PUBLIC_APP_URL=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.5
AI_DEMO_MODE=false
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_GRAPH_API_VERSION=v23.0
```

## 4. WhatsApp webhooks

Configurar en Meta:

```text
GET/POST https://<dominio>/api/webhooks/whatsapp
```

Usar `WHATSAPP_VERIFY_TOKEN` como token de verificacion.

## 5. WebChat

Script:

```html
<script src="https://<dominio>/widget/crm-pro-ai-widget.js" data-widget-token="<token>" async></script>
```

Agregar el dominio del sitio en Settings > Channels > WebChat.

## 6. Cron

Endpoint:

```http
POST https://<dominio>/api/cron/automations
Authorization: Bearer <CRON_SECRET>
```

## 7. Validacion final

```bash
npm run validate
```

Luego revisar:

- `/api/health`
- Settings > System Status
- Inbox
- WebChat
- WhatsApp settings
