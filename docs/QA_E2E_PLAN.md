# QA E2E Plan

## Objetivo

Validar el MVP completo antes del deploy real sin usar servicios pagos, credenciales reales, OpenAI real ni envios WhatsApp.

## Capas

### Smoke HTTP y navegador

Ejecutado con Playwright sobre `http://localhost:3100`:

- Login renderiza el formulario magic link.
- Healthcheck responde HTTP 200 en entorno QA.
- Dashboard y modulos CRM redirigen a login sin sesion.
- Webhook GET de WhatsApp acepta solo el verify token QA.
- Widget WebChat entrega JavaScript.
- Endpoints WebChat rechazan payloads invalidos.

### Flujo integral simulado

Ejecutado con Vitest y servicios reales en memoria:

1. Crear lead y contacto validados.
2. Crear conversacion y mensaje entrante.
3. Generar sugerencia con `AI_DEMO_MODE`.
4. Clasificar Smart Tag.
5. Extraer presupuesto con source message y confidence.
6. Crear y programar automatizacion manual.
7. Preparar acciones, manteniendo `send_message` mockeado.
8. Ejecutar Custom Connect `mock://success`.
9. Iniciar WebChat y guardar mensaje.
10. Parsear mensaje WhatsApp mock.
11. Confirmar mensajes manuales, WebChat y WhatsApp en el estado Inbox simulado.

## Matriz de modulos

| Modulo | Cobertura |
| --- | --- |
| Auth | Formulario login y redirects sin sesion |
| Dashboard | Proteccion de ruta |
| Leads | Schema, creacion simulada y flujo integral |
| Contacts | Schema y creacion simulada |
| Inbox | Mensajes manual, WebChat y WhatsApp |
| Assistants | Configuracion y sugerencia IA demo |
| Smart Tags | Clasificacion y asignacion preparada |
| Variables | Extraccion tipada con mensaje origen |
| Automations | Run manual y acciones mock |
| Integrations | Custom Connect demo |
| WhatsApp | Verificacion GET y payload entrante mock |
| WebChat | Widget, validacion HTTP y persistencia simulada |
| Healthcheck | HTTP 200 con env QA |
| System Status | Proteccion owner/admin mediante ruta autenticada |

## Datos

- `supabase/seed.sql` mantiene datos demo para CRM, Inbox, asistentes, tags, variables, automatizaciones, WebChat e integraciones.
- La simulacion E2E genera sus propios datos en memoria y no modifica Supabase.

## Comandos

```powershell
npm run qa:smoke
npm run qa:e2e
```

Playwright usa Chrome instalado en el sistema por defecto. Puede cambiarse con:

```powershell
$env:QA_BROWSER_CHANNEL="msedge"
npm run qa:smoke
Remove-Item Env:QA_BROWSER_CHANNEL
```

## Criterio de salida

- Cero tests fallidos.
- Cero secretos detectados por `deploy:check`.
- Build de produccion exitoso.
- Ninguna llamada a OpenAI o WhatsApp real.
- Ninguna mutacion contra Supabase remoto.
