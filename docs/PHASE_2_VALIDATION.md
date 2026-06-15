# Validacion FASE 2

## Alcance

- Leads: CRUD base, detalle, busqueda, filtro por estado y asignacion.
- Contactos: CRUD base, detalle y conversion desde lead.
- Conversaciones: creacion desde lead/contacto, estados, canal y responsable.
- Mensajes: creacion manual e historial.
- Inbox: layout tipo WhatsApp Web con filtros y Realtime.

## Comandos

```bash
npm run lint
npm run build
npm run test
```

## Realtime

La UI se suscribe desde el cliente a cambios Postgres en:

- `conversations`
- `messages`
- `leads`

Todas las suscripciones usan filtro `organization_id=eq.<org_id>`.

## Seguridad

- Todas las escrituras pasan por Server Actions.
- Todos los payloads se validan con Zod.
- Las queries filtran por `organization_id`.
- RLS bloquea acceso cross-tenant aunque un usuario manipule IDs.
