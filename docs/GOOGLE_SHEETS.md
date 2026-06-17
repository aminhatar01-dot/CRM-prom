# Google Sheets

FASE 9 implementa Google Sheets MVP sin OAuth obligatorio.

## Modos soportados

- URL publica exportable como CSV.
- `demo://leads` para pruebas locales.
- `api_key_ref` preparado para futura configuracion con API key.

## Lectura

`GoogleSheetsConnector` convierte URLs publicas de Google Sheets a CSV:

```text
https://docs.google.com/spreadsheets/d/<id>/gviz/tq?tqx=out:csv
```

Luego parsea filas y permite busqueda simple por texto.

## UI

Configurar desde:

```text
/integrations/google-sheets
```

La prueba manual se ejecuta desde el detalle de la integracion con input:

```json
{ "query": "Ana" }
```

## Limitaciones MVP

- No hay OAuth.
- No se escriben filas.
- No se ejecuta automaticamente desde conversaciones reales.
