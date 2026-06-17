# Custom Connect

Custom Connect permite definir herramientas HTTP para pruebas manuales y futura orquestacion controlada por IA.

## Campos

- `name`
- `description`
- `method`: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- `url`
- `headers_schema`
- `body_schema`
- `response_schema`
- `active`
- `timeout_ms`

## Modo demo

Para pruebas locales se soporta:

- `mock://success`
- `mock://fail`

Estas URLs no hacen llamadas externas y permiten validar logs y UI sin servicios pagos.

## Ejecucion

La ejecucion solo sucede al presionar "Probar herramienta" en el detalle de la integracion. Cada intento se registra en `integration_tool_runs` con input, output, error y duracion.

## Secrets

No pegues secretos reales en headers. Usa referencias como `env:CRM_API_KEY` en `credentials_ref` o en metadata futura.
