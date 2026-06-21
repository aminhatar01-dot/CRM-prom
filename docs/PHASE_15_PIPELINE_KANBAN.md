# FASE 15 - Pipeline Kanban

Fecha: 2026-06-21

## Objetivo

Incorporar una vista operativa de pipeline para gestionar leads por estado, con movimiento visual y persistencia real en Supabase.

## Ruta

```text
/pipeline
```

El acceso esta disponible:

- en la navegacion principal para `owner`, `admin` y `agent`;
- desde el listado de Leads;
- mediante el boton `Nuevo lead` dentro del pipeline.

## Estados

El tablero utiliza el enum existente `public.lead_status`:

1. `nuevo`
2. `contactado`
3. `interesado`
4. `propuesta`
5. `ganado`
6. `perdido`

No se agregaron tablas ni estados paralelos.

## Funcionamiento

### Lectura

La pagina carga desde Supabase:

- leads activos de la organizacion;
- Smart Tags asociados;
- responsables asignables;
- ultima actividad de conversaciones;
- `updated_at` del lead como fallback de actividad.

Todas las consultas incluyen `organization_id`. Los leads archivados quedan fuera mediante:

```text
archived_at IS NULL
```

### Drag and drop

El tablero usa `@dnd-kit/core` con sensor de puntero. Cada tarjeta tiene un control de arrastre identificable y las columnas son zonas de destino.

El movimiento:

1. actualiza la tarjeta de forma optimista;
2. ejecuta `updateLeadPipelineStatus`;
3. valida UUID y estado con Zod;
4. obtiene la organizacion desde la sesion autenticada;
5. actualiza por `id`, `organization_id` y `archived_at`;
6. registra `update_lead_pipeline_status` en `audit_logs`;
7. revierte la tarjeta si Supabase rechaza la operacion.

Cada tarjeta incluye ademas un selector de estado para teclado, touch y accesibilidad.

### Filtros

Los filtros se aplican en cliente sobre los datos autorizados que ya devolvio Supabase:

- nombre, email o telefono;
- responsable;
- origen;
- sin responsable;
- sin origen.

El tablero muestra el total visible y permite limpiar todos los filtros.

## Tarjetas

Cada tarjeta muestra:

- nombre;
- telefono;
- email;
- origen;
- responsable;
- ultima actividad;
- hasta tres tags y contador adicional;
- estado actual.

## Estados de interfaz

- skeleton durante la carga de ruta;
- columna vacia con zona de drop;
- empty state diferenciado cuando hay filtros;
- tarjeta atenuada durante persistencia;
- confirmacion visible al guardar;
- error visible y rollback ante fallo de red, permisos o base de datos.

## Seguridad

No fue necesaria una migracion.

El schema ya dispone de:

- RLS en `public.leads`;
- policy tenant mediante `is_org_member(organization_id)`;
- trigger especifico de integridad de Leads;
- enum de estados;
- indice `leads_status_idx (organization_id, status)`;
- trigger `touch_leads_updated_at`.

La server action no acepta `organization_id` desde el navegador.

## Pruebas

### Unitarias

- payload valido de cambio de estado;
- rechazo de estado inexistente;
- presencia de Pipeline en navegacion para agentes.

### E2E real

Comando:

```powershell
npm run qa:pipeline
```

La suite usa Supabase local real, Auth, PostgreSQL, RLS, Next.js en produccion y Chrome:

1. crea usuario confirmado temporal;
2. completa onboarding;
3. crea un lead desde la UI;
4. abre `/pipeline`;
5. valida busqueda, origen y responsable;
6. arrastra la tarjeta de `nuevo` a `interesado`;
7. espera confirmacion de la server action;
8. recarga la pagina;
9. confirma que el estado persistio;
10. elimina workspace y usuario temporales.

No se utiliza un repositorio en memoria ni un mock de Supabase como validacion principal.

## Deploy

FASE 15 no crea migraciones.

Para desplegar:

```powershell
git push origin main
```

No es necesario ejecutar `npx supabase db push`.
