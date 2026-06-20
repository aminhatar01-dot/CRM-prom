# Deploy Vercel + Supabase

Para el flujo guiado completo, usar [DEPLOY_ASSISTANT.md](DEPLOY_ASSISTANT.md) y [DEPLOY_CHECKLIST.md](DEPLOY_CHECKLIST.md).

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

Para insertar el conjunto demo minimo en el proyecto remoto vinculado, sin reset:

```bash
npm run db:seed:remote
```

El seed remoto es idempotente, no crea usuarios ni membresias y mantiene WhatsApp, IA automatica y automatizaciones desactivadas. Siembra configuracion y datos de referencia, pero no inserta `leads`, `conversations`, `messages`, `lead_tags`, `automation_actions` ni `webchat_widgets` porque los triggers genericos actuales de esas tablas requieren una migracion correctiva separada.

## 2. Vercel

1. Importar el repositorio GitHub en Vercel.
2. Configurar **Root Directory** en la raiz del repositorio (`.`). No seleccionar `apps/web`.
3. Framework Preset: `Next.js`.
4. Install Command: `npm install`.
5. Build Command: `npm run build --workspace @crm-pro-ai/web`.
6. Output Directory: dejar vacio para usar la deteccion automatica de Next.js.
7. Mantener habilitado el uso de `vercel.json`; la configuracion raiz contiene esos mismos valores.

Configuracion versionada:

```json
{
  "framework": "nextjs",
  "installCommand": "npm install",
  "buildCommand": "npm run build --workspace @crm-pro-ai/web"
}
```

El workspace `apps/web/package.json` declara directamente `next`, `react` y `react-dom`. Esto permite que Vercel detecte Next.js sin depender de que npm haya elevado las dependencias del paquete raiz.

No configurar manualmente `apps/web/.next` como Output Directory: Vercel ya ejecuta el build dentro del workspace y duplicaria la ruta como `apps/web/apps/web/.next`.

Si el proyecto Vercel tenia Root Directory `apps/web` o un Output Directory personalizado, cambiar Root Directory a la raiz, limpiar Output Directory y hacer **Redeploy** sin reutilizar Build Cache.

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
npm run deploy:check
```

Luego revisar:

- `/api/health`
- Settings > System Status
- Inbox
- WebChat
- WhatsApp settings
