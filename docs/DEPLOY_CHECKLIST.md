# Deploy Checklist

## Antes del deploy

- [ ] `git status` esta limpio.
- [ ] `npm run predeploy` finaliza correctamente.
- [ ] `.env.local` no esta trackeado.
- [ ] Las migraciones fueron revisadas.
- [ ] Existe un plan de rollback.

## Durante el deploy

- [ ] Supabase esta vinculado al proyecto correcto.
- [ ] `npm run db:push` finaliza correctamente.
- [ ] Vercel usa Root Directory en la raiz (`.`).
- [ ] Build Command usa `npm run build --workspace @crm-pro-ai/web`.
- [ ] Output Directory esta vacio y usa la deteccion automatica de Next.js.
- [ ] Variables cargadas para Preview y Production.
- [ ] No se ejecutaron seeds locales en produccion.

## Despues del deploy

- [ ] `/api/health` responde HTTP 200.
- [ ] Settings > System Status no muestra errores requeridos.
- [ ] El dominio usa HTTPS.
- [ ] Logs de Vercel no exponen secrets.
- [ ] El deployment estable esta identificado para rollback.

## Validacion funcional

- [ ] Login y onboarding.
- [ ] Dashboard, Leads y Contactos.
- [ ] Inbox y envio manual.
- [ ] Asistentes, Smart Tags y Variables.
- [ ] Automatizaciones desactivadas por defecto.
- [ ] Integraciones solo en modo manual/test.

## Validacion de seguridad

- [ ] RLS habilitado en tablas publicas.
- [ ] Un usuario no accede a otra organizacion.
- [ ] Service role solo existe en servidor.
- [ ] `CRON_SECRET` protege el endpoint cron.
- [ ] Credenciales reales no estan en Git.
- [ ] Roles agent no acceden a System Status.

## Validacion de WhatsApp

- [ ] Verificacion GET aceptada por Meta.
- [ ] Firma HMAC configurada con `WHATSAPP_APP_SECRET`.
- [ ] Mensaje entrante aparece en Inbox.
- [ ] Estado sent/delivered/read se actualiza.
- [ ] Envios automaticos siguen desactivados.

## Validacion de WebChat

- [ ] Token publico del widget funciona.
- [ ] Dominio permitido inicia conversacion.
- [ ] Dominio no permitido queda bloqueado.
- [ ] Mensajes aparecen en Inbox.
- [ ] El token no concede acceso a datos privados.

## Validacion de IA

- [ ] Modo demo funciona sin API key.
- [ ] OpenAI real solo se activa con `AI_DEMO_MODE=false`.
- [ ] La sugerencia requiere confirmacion humana.
- [ ] Logs no almacenan secretos.
- [ ] Limites y billing fueron revisados.
