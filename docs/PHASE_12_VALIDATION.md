# FASE 12 Validation

## Resumen QA

La fase agrega smoke tests HTTP/navegador y un flujo integral simulado que usa los contratos y motores existentes del MVP.

## Bugs encontrados y corregidos

### Puerto QA reutilizado accidentalmente

Playwright tenia `reuseExistingServer=true` sobre el puerto 3000. Un proceso ajeno podia responder y producir falsos 404.

Correccion:

- Puerto QA dedicado `3100`.
- `reuseExistingServer=false`.

### Browser Playwright ausente

El binario descargable no estaba instalado y la descarga fue bloqueada por la cadena TLS del entorno.

Correccion:

- Playwright usa Chrome del sistema.
- `QA_BROWSER_CHANNEL` permite seleccionar otro canal instalado.
- No se deshabilito la verificacion TLS.

### Timeout por rutas secuenciales

Doce pantallas protegidas se compilaban y renderizaban dentro de un unico test de navegador.

Correccion:

- El contrato se verifica mediante HTTP 307 sin seguir redirects.
- El login sigue validandose visualmente en Chrome.

## Pruebas creadas

- `apps/web/tests/e2e/mvp-smoke.spec.ts`
- `apps/web/tests/qa/mvp-full-flow.test.ts`
- `packages/database/src/qa-contract.test.ts`

## Seguridad

- Entorno QA usa valores ficticios.
- `AI_DEMO_MODE=true`.
- WhatsApp solo prueba verificacion y payloads mock.
- Automatizaciones no envian mensajes reales.
- WebChat integral usa almacenamiento en memoria.
- `deploy:check` valida secrets, `.env.local` y service role.

## Resultado final

```powershell
npm run lint
npm run build
npm run test
npm run validate
npm run deploy:check
npm run qa:smoke
npm run qa:e2e
```

- `lint`: OK, sin warnings.
- `build`: OK, 34 rutas.
- `test`: OK, 28 archivos y 77 tests.
- `validate`: OK.
- `deploy:check`: 11 checks OK, 2 warnings esperados por ausencia de `.env.local`.
- `qa:smoke`: 5 tests Playwright OK.
- `qa:e2e`: flujo integral Vitest y 5 tests Playwright OK.
- Secrets obvios: no detectados.
- `.env.local`: ignorado y no trackeado.
- Service role: sin referencias en modulos cliente.
