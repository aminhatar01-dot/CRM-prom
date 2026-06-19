# Production Checklist

## Seguridad

- [ ] RLS habilitado en todas las tablas `public`.
- [ ] `organization_id` presente en tablas operativas.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` solo en servidor.
- [ ] No hay secrets hardcodeados.
- [ ] WebChat valida token publico y dominios permitidos.
- [ ] WhatsApp valida verify token y firma HMAC cuando `WHATSAPP_APP_SECRET` existe.
- [ ] `CRON_SECRET` configurado.
- [ ] `AI_DEMO_MODE=false` solo cuando `OPENAI_API_KEY` esta listo.

## Deploy

- [ ] Vercel conectado a GitHub.
- [ ] Variables cargadas en Vercel.
- [ ] Migraciones aplicadas con `npm run db:push`.
- [ ] Seeds no ejecutados en produccion salvo decision explicita.
- [ ] Dominio principal configurado.
- [ ] Webhooks WhatsApp apuntan al dominio de produccion.

## Producto

- [ ] Login y onboarding funcionan.
- [ ] Dashboard carga.
- [ ] Inbox carga conversaciones.
- [ ] WebChat abre conversaciones.
- [ ] WhatsApp manual no envia si falta configuracion.
- [ ] IA solo sugiere respuestas; no envia automaticamente.
- [ ] Integraciones solo ejecutan herramientas en modo manual/test.

## Validacion

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] `npm run test`
- [ ] `npm run validate`
- [ ] `/api/health`
- [ ] Settings > System Status
