# FASE 13 - Reparacion critica de base de datos y CRUD real

Fecha: 2026-06-20

## Objetivo

Eliminar los triggers polimorficos que accedian a campos inexistentes en `NEW`, restaurar operaciones CRUD reales y validar aislamiento multi tenant en PostgreSQL.

## Migracion

Archivo:

`supabase/migrations/20260620213000_phase_13_integrity_and_archiving.sql`

La migracion:

- no elimina datos;
- no recrea tablas;
- no requiere reset remoto;
- elimina los triggers genericos defectuosos;
- crea una funcion de validacion por tabla;
- agrega archivo no destructivo mediante `archived_at`;
- agrega indices para registros activos;
- otorga privilegios SQL a `authenticated` y `service_role`;
- conserva RLS como frontera de acceso.

## Triggers reemplazados

Se eliminaron las funciones genericas:

- `enforce_crm_tenant_integrity`;
- `enforce_smart_tag_tenant_integrity`;
- `enforce_variable_tenant_integrity`;
- `enforce_automation_tenant_integrity`;
- `enforce_webchat_tenant_integrity`;
- `enforce_integration_tenant_integrity`.

Se agregaron validadores especificos para:

- contacts;
- leads;
- conversations;
- messages;
- lead tags;
- conversation smart tags;
- smart tag logs;
- lead variables;
- conversation variables;
- variable logs;
- automation actions;
- automation runs;
- tasks;
- internal notifications;
- webchat widgets;
- AI logs y assistant tests;
- WhatsApp events;
- integration tools, runs, Google Sheets connections y secret references.

Cada funcion accede solamente a columnas existentes en su tabla.

## CRUD

Los modulos siguientes disponen de crear, listar, detalle, editar y archivar:

- Leads;
- Contacts;
- Conversations;
- Messages;
- Assistants;
- Smart Tags;
- Variables.

El archivo:

- actualiza `archived_at`;
- no borra relaciones ni historial;
- excluye registros archivados de listados y operaciones activas;
- registra el evento en `audit_logs`.

Messages permite editar el cuerpo desde Inbox y archivar mensajes individuales.

## Errores visibles

`apps/web/src/lib/action-errors.ts` traduce errores PostgreSQL/Supabase a codigos seguros:

- duplicado;
- permisos;
- referencia invalida;
- integridad multi tenant;
- registro no encontrado;
- error de base de datos.

El layout CRM muestra mensajes globales mediante `ActionNotice`. No se exponen SQL, tokens ni detalles internos.

## Seed

`supabase/seed.sql` vuelve a incluir de forma idempotente:

- lead;
- conversation;
- message;
- lead tag;
- automation action;
- webchat widget.

No crea usuarios Auth, memberships, secretos ni envios reales.

## Pruebas PostgreSQL

Archivo:

`supabase/tests/phase_13_integrity_crud.sql`

Cobertura real:

- aplicacion completa de migraciones;
- seed completo;
- inserts de contacts, leads, conversations y messages;
- widget WebChat;
- automation action;
- Smart Tag assignment;
- Variable value;
- Integration tool;
- archivo no destructivo;
- rechazo de referencias cross tenant;
- lectura RLS con dos organizaciones.

Ejecucion:

```powershell
npx supabase start
npm run db:test:phase13
```

Este repositorio usa puertos locales `55321` y `55322` para no interferir con otros proyectos Supabase.

## Build en OneDrive

El error local:

```text
EINVAL: invalid argument, readlink apps/web/.next/...
```

provenia de un artefacto `.next` sincronizado parcialmente por OneDrive.

El build de workspace ejecuta `scripts/clean-next.mjs` antes de Next.js. El script verifica la ruta absoluta y elimina solamente `apps/web/.next`.

## Aplicacion remota

No ejecutar `db reset` en remoto.

```powershell
git pull
npx supabase link --project-ref widehqbtmqiebaowidav
npx supabase db push --dry-run
npx supabase db push
```

Para actualizar tambien el seed demo:

```powershell
npm run db:seed:remote
```

El seed es opcional. La migracion no depende del seed.

## Verificacion posterior

1. Crear un lead.
2. Editarlo y asignar responsable.
3. Crear una conversation manual.
4. Enviar y editar un message.
5. Asignar un Smart Tag.
6. Extraer o guardar una Variable.
7. Crear una automation con al menos una action.
8. Guardar WebChat settings.
9. Archivar los registros de prueba.
10. Confirmar que otra organizacion no puede leerlos.

## Resultado local

- migraciones desde cero: OK;
- seed: OK;
- pgTAP: 20/20;
- build Next.js: OK, 34 rutas;
- no se modificaron datos remotos durante la implementacion.
