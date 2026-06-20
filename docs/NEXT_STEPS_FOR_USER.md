# Next Steps For User

## PowerShell local

Desde la raiz del repositorio:

```powershell
npm install
Copy-Item .env.example .env.local
npm run env:check
npm run db:check
npm run predeploy
```

Completar `.env.local` con valores reales solo en el equipo local. No ejecutar `git add .env.local`.

Para exigir todas las variables de produccion:

```powershell
$env:DEPLOY_STRICT="true"
npm run deploy:check
Remove-Item Env:DEPLOY_STRICT
```

## Supabase

Ejecutar:

```powershell
npx supabase login
npx supabase link --project-ref widehqbtmqiebaowidav
npm run db:push
```

No pegar SQL de seeds demo en produccion salvo decision deliberada. `npm run db:seed` reinicia Supabase local.

Para cargar solo datos demo seguros en el remoto vinculado:

```powershell
npm run db:seed:remote
```

Este comando no resetea la base. No crea usuarios ni secretos y puede ejecutarse nuevamente de forma idempotente.

En el dashboard revisar:

1. Authentication > URL Configuration.
2. Database > Policies para RLS.
3. Database > Replication para Realtime.
4. Project Settings > API para URL y anon key.

## Vercel

1. Importar `CRM-prom` desde GitHub.
2. Root Directory: raiz del repositorio (`.`).
3. Install Command: `npm install`.
4. Build Command: `npm run build --workspace @crm-pro-ai/web`.
5. Output Directory: `apps/web/.next`.
6. Agregar variables desde `.env.example`, con valores reales.
7. No crear variables publicas para service role, OpenAI, cron o WhatsApp.
8. Desplegar y actualizar `NEXT_PUBLIC_APP_URL` con el dominio HTTPS final.
9. Agregar el dominio final a Supabase Auth Redirect URLs.

## Meta y WhatsApp

1. Crear o abrir la app en Meta Developers.
2. Agregar WhatsApp Cloud API.
3. Obtener phone number ID, access token y app secret.
4. Configurar callback:

```text
https://<dominio>/api/webhooks/whatsapp
```

5. Copiar en Meta el mismo verify token guardado en Vercel.
6. Rotar tokens temporales antes de produccion.

## Si falla

```powershell
npm run env:check
npm run db:check
npm run app:check
npm run deploy:check
```

- HTTP 503 en `/api/health`: revisar variables obligatorias.
- Vercel no detecta Next.js: confirmar Root Directory raiz, `vercel.json` y dependencias de `apps/web/package.json`.
- Supabase rechaza requests: revisar URL, anon key, RLS y dominio de Auth.
- WhatsApp no verifica: comparar callback y verify token.
- WebChat bloqueado: agregar el dominio exacto en la configuracion del widget.

## Volver atras

1. Promover el deployment anterior desde Vercel.
2. Desactivar temporalmente integraciones cambiando variables.
3. Crear una migracion correctiva; no borrar migraciones ya aplicadas.
4. Rotar credenciales si pudieron quedar expuestas.
5. Repetir `npm run predeploy` y el checklist funcional.

## Acciones que requieren al usuario

- Importar el proyecto y aprobar deployments en Vercel.
- Cargar variables y conectar el dominio.
- Configurar Meta Developers y aceptar sus condiciones.
- Obtener, renovar y rotar tokens reales.
- Revisar consumo, limites y billing.
- Cambiar contrasenas compartidas, incluida la de Supabase.
