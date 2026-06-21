# FASE 14 - Functional Recovery

Fecha: 2026-06-21

## Objetivo

Recuperar la operacion real del MVP existente antes de agregar nuevos modulos. La fase conecta navegacion, UI, server actions y PostgreSQL mediante una prueba autenticada de extremo a extremo.

## Diagnostico

### Modulos visuales o incompletos detectados

| Superficie | Problema |
|---|---|
| Dashboard | Estaba fuera del layout CRM y no mostraba la navegacion de modulos. |
| Dashboard KPIs | Las tarjetas no eran enlaces y el contador de asistentes estaba fijo en cero. |
| Navegacion movil | El sidebar desaparecia en pantallas menores a `lg` y no existia menu alternativo. |
| Formularios CRUD | Enviaban acciones reales, pero no mostraban estado pendiente; durante una operacion parecian inmoviles. |
| Automations | La UI basica funcionaba, pero los errores al crear acciones hijas se ignoraban. |
| Integrations | Crear Custom Connect con descripcion vacia siempre fallaba validacion. |
| Integrations | Un error al crear la tool podia dejar una integration huerfana. |
| Google Sheets | Los errores de tool/connection se ignoraban parcialmente. |
| QA | El flujo integral anterior usaba objetos en memoria y Supabase ficticio. |
| Desarrollo OneDrive | `next dev` podia reutilizar un `.next` corrupto y fallar con `EINVAL readlink`. |

## Bugs reales encontrados

### 1. Dashboard aislado

`/dashboard` vivia fuera del route group `(crm)`. Auth y datos funcionaban, pero el usuario no tenia forma visible de entrar a Leads, Contacts, Inbox u otros modulos.

Correccion:

- dashboard movido al layout CRM conservando la URL `/dashboard`;
- KPIs convertidos en enlaces;
- accesos rapidos para lead, contact, Inbox, assistant, automation e integration;
- contador de assistants conectado a Supabase;
- listado de leads recientes.

### 2. Sin navegacion movil

El sidebar usaba `hidden lg:block` y no existia reemplazo movil.

Correccion:

- `DesktopNavigation`;
- `MobileNavigation`;
- estado activo por pathname;
- acceso a todos los modulos permitidos por rol.

### 3. Custom Connect rechazaba formularios validos

La action normalizaba una descripcion vacia como `null`, pero el schema `optionalText` no aceptaba `null`.

Resultado anterior:

```text
/integrations/new?error=invalid
```

Correccion:

- schema acepta `string`, string vacio, `undefined` y `null`;
- prueba unitaria con el payload real del formulario.

### 4. Operaciones multipaso incompletas

Automation e Integration realizaban varias escrituras, pero algunas respuestas de Supabase no se comprobaban.

Correccion:

- Automation elimina la rule recien creada si fallan sus actions;
- al editar, conserva una copia de actions anteriores y las restaura si falla el reemplazo;
- Custom Connect elimina la integration huerfana si falla la tool;
- Google Sheets elimina la integration incompleta si falla tool o connection;
- errores PostgreSQL se convierten a mensajes seguros y visibles;
- updates verifican que el registro exista.

### 5. Formularios sin feedback de envio

Se agrego `SubmitButton` con `useFormStatus`.

Los formularios prioritarios ahora:

- se deshabilitan durante el envio;
- muestran `Guardando...`;
- evitan dobles submits.

Cobertura:

- Leads;
- Contacts;
- Assistants;
- Smart Tags;
- Variables;
- Automations;
- Integrations.

### 6. Build y desarrollo bajo OneDrive

El build ya limpiaba `.next`, pero desarrollo no.

Correccion:

- `npm run dev` del workspace ejecuta `scripts/clean-next.mjs`;
- solo elimina `apps/web/.next`;
- la ruta absoluta se valida antes de eliminar.

## Flujo E2E real

Archivos:

- `apps/web/phase14.playwright.config.ts`
- `apps/web/tests/e2e/phase14-functional.spec.ts`
- `scripts/phase14-functional-local.ps1`

El test utiliza:

- Supabase local real;
- migraciones reales;
- PostgreSQL real;
- Auth real;
- RLS real;
- Next.js en modo produccion;
- Chrome del sistema;
- usuario y workspace temporales eliminados al finalizar.

No utiliza repositorios en memoria para la persistencia CRM.

### Recorrido validado

1. Login con email/password.
2. Onboarding.
3. Dashboard operativo.
4. Navegacion desktop.
5. Navegacion movil.
6. Crear lead.
7. Editar lead.
8. Crear conversation.
9. Enviar message manual.
10. Crear contact.
11. Crear assistant.
12. Crear Smart Tag.
13. Crear Variable.
14. Crear automation.
15. Ejecutar automation manual.
16. Crear Custom Connect activo.
17. Probar la integration y obtener `status=success`.

Ejecucion:

```powershell
npm run qa:functional
```

El script:

- reutiliza Supabase local si ya esta activo;
- lo inicia si hace falta;
- no imprime ni guarda claves;
- crea un usuario confirmado temporal;
- limpia organization y auth user;
- detiene Supabase solamente si el mismo script lo inicio.

## Supabase remoto

Comprobaciones realizadas:

```powershell
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

Resultado:

- FASE 13 ya esta aplicada;
- remoto y local tienen las mismas migraciones;
- no hay migraciones pendientes para FASE 14.

No se ejecuto reset remoto.

## Limitacion del entorno

El proceso Node local no confia en la cadena TLS corporativa usada al acceder directamente a Supabase remoto. No se deshabilito validacion TLS.

Por esa razon:

- el E2E funcional usa Supabase local real;
- la compatibilidad remota se valida con Supabase CLI;
- Vercel continuara usando sus variables y conectividad normal.

## Resultado

- navegacion funcional desktop/mobile;
- dashboard operativo;
- CRUD prioritario conectado a server actions;
- Inbox y mensajes persistidos;
- Automation manual ejecutada;
- Custom Connect ejecutado correctamente;
- E2E funcional real: OK;
- datos temporales eliminados.

## Deploy

FASE 14 no crea migraciones.

Despues de los commits:

```powershell
git push origin main
```

No es necesario ejecutar `npx supabase db push` mientras `db push --dry-run` siga indicando que la base remota esta actualizada.
