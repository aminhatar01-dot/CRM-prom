# FASE 11 Validation

## Alcance

- Deploy Assistant para Supabase, Vercel, GitHub, WhatsApp, WebChat e IA.
- Checklist interactivo antes, durante y despues del deploy.
- CLI local para runtime, env, Supabase, migraciones, docs, build y seguridad.
- Plantillas de entorno organizadas por responsabilidad.
- Guia exacta de acciones manuales y rollback.

## Scripts

```bash
npm run env:check
npm run db:check
npm run app:check
npm run deploy:check
npm run predeploy
```

`DEPLOY_STRICT=true` convierte variables requeridas o configuraciones parciales en fallos. Sin modo estricto, las integraciones externas ausentes se informan como advertencias para mantener funcional el escenario demo.

## Tests agregados

- Parseo y validacion de env.
- Existencia de documentos criticos.
- Existencia de scripts npm.
- Estructura del checklist.
- `.env.local` ignorado y no trackeado.
- Service role ausente de modulos cliente.

## Resultado esperado

- `lint`: sin warnings.
- `build`: produccion Next.js exitosa.
- `test`: suite completa exitosa.
- `validate`: lint, build y tests exitosos.
- `deploy:check`: cero fallos; puede mostrar warnings sin credenciales locales.
