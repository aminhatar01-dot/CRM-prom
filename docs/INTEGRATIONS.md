# Integraciones

FASE 9 agrega integraciones externas para que los asistentes IA puedan conocer herramientas disponibles y para que el equipo las pruebe manualmente.

## Tablas

- `integrations`: configuracion principal.
- `integration_tools`: herramientas ejecutables.
- `integration_tool_runs`: logs de pruebas y ejecuciones manuales.
- `google_sheets_connections`: configuracion MVP de hojas publicas o modo demo.
- `integration_secrets`: referencias a credenciales, sin guardar secretos reales.

## Seguridad

- Todas las tablas tienen `organization_id`.
- RLS limita acceso por organizacion.
- Gestion de integraciones requiere rol admin/owner.
- Los secrets se guardan como referencias (`credentials_ref`, `api_key_ref`), no como valores.
- Las tools no se ejecutan automaticamente en conversaciones reales.

## UI

- `/integrations`: listado.
- `/integrations/new`: crear Custom Connect.
- `/integrations/google-sheets`: setup inicial de Google Sheets.
- `/integrations/[id]`: detalle, logs y prueba manual.
- `/integrations/[id]/edit`: editar Custom Connect.

## AIOrchestrator

El contexto de IA incluye la lista de herramientas activas, con nombre, tipo, descripcion e input schema. La ejecucion queda desactivada salvo pruebas manuales desde el panel.
