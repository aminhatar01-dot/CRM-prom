# FASE 7 Validation

## Alcance implementado

- CRUD base de automatizaciones en `/automations`.
- Detalle con historial de `automation_runs`.
- Endpoint protegido `POST /api/cron/automations`.
- Tablas `automation_runs`, `tasks` e `internal_notifications`.
- Extensiones de enums para triggers y acciones de FASE 7.
- RLS e integridad multi tenant para nuevas tablas.
- Runner seguro con `send_message` mockeado.
- Integracion en Inbox y Leads para tareas/notificaciones y seguimientos manuales.
- Seeds demo de automatizaciones.

## Variables de entorno

```bash
CRON_SECRET=
```

## Validacion funcional

1. Crear regla en `/automations/new`.
2. Confirmar que el estado por defecto sea `draft`.
3. Abrir el detalle y ejecutar manualmente.
4. Revisar historial de ejecuciones.
5. Crear seguimiento manual desde Inbox.
6. Crear seguimiento manual desde detalle de lead.
7. Llamar cron sin secreto y confirmar `401`.
8. Llamar cron con `Authorization: Bearer $CRON_SECRET` y confirmar respuesta JSON.

## Validacion tecnica

```bash
npm run lint
npm run build
npm run test
```

## Notas de seguridad

- No se ejecutan envios reales por automatizacion.
- Las automatizaciones no se activan automaticamente.
- `SUPABASE_SERVICE_ROLE_KEY` no se expone al frontend.
- Los triggers SQL bloquean acciones, runs, tareas y notificaciones con referencias de otra organizacion.
