# CRM PRO AI - Auditoria integral

Fecha: 2026-06-20

## 1. Resumen ejecutivo

El proyecto tiene una base tecnica amplia y ordenada: monorepo, Next.js 15, Supabase SSR, autenticacion, multi tenant, RLS, formularios validados con Zod, modulos CRM, Inbox, canales, IA, automatizaciones e integraciones. La mayor parte de la superficie funcional existe y compila conceptualmente como un MVP.

Sin embargo, el estado real no equivale a doce fases productivas completas. La auditoria encuentra una diferencia importante entre:

- funcionalidad implementada en UI y TypeScript;
- funcionalidad cubierta por pruebas unitarias o simuladas;
- funcionalidad que puede completar hoy un recorrido real contra Supabase remoto.

Estimacion global conservadora:

| Dimension | Estado |
|---|---:|
| Arquitectura y estructura | 80% |
| Superficie UI | 70% |
| Logica de aplicacion | 65% |
| Operacion real end-to-end | 40% |
| Paridad MVP con PROJECT_SPEC.md | 52% |
| Preparacion productiva efectiva | 45% |

Conclusion: CRM PRO AI es una base de MVP avanzada, pero todavia no es un equivalente funcional completo de Prometheo AI. Los principales bloqueos estan en integridad SQL, automatizacion real, clasificacion/extraccion IA real, media de WhatsApp, WebChat end-to-end, pipeline y pruebas reales contra Supabase.

## 2. Metodologia y alcance

Se revisaron:

- rutas y pantallas de `apps/web/src/app`;
- server actions;
- servicios de `packages/ai`, `packages/automation` y `packages/integrations`;
- migraciones de Supabase;
- `supabase/seed.sql`;
- RLS y triggers de integridad;
- pruebas Vitest y Playwright;
- documentacion de fases y produccion;
- scripts de build, validacion, QA y deploy.

Los porcentajes miden operacion productiva, no cantidad de archivos creados.

No se modifico logica de negocio durante esta auditoria.

## 3. Hallazgos criticos

### 3.1 Triggers SQL genericos bloquean operaciones centrales

Existen funciones de trigger reutilizadas por tablas con estructuras diferentes. Esas funciones acceden a campos que no existen en todos los registros `NEW`.

Casos:

- `enforce_crm_tenant_integrity()` usa campos como `conversation_id` y `owner_id` en una funcion asociada a leads, conversations, messages y lead_tags.
- `enforce_automation_tenant_integrity()` usa `user_id` en una funcion asociada tambien a automation_actions, automation_runs y tasks.
- `enforce_variable_tenant_integrity()` mezcla `lead_id`, `conversation_id` y `source_message_id` entre tablas distintas.
- `enforce_webchat_tenant_integrity()` mezcla `assistant_id` y `webchat_widget_id`.

El problema no es teorico: el seed remoto ya fallo con `record "new" has no field "user_id"`. El propio `supabase/seed.sql` excluye leads, conversations, messages, lead_tags, automation_actions y webchat_widgets por esta razon.

Impacto probable:

- crear o editar leads puede fallar;
- crear conversaciones y mensajes puede fallar;
- asignar tags a leads puede fallar;
- guardar acciones de automatizacion puede fallar;
- crear widgets WebChat puede fallar;
- guardar valores o logs de variables puede fallar;
- WhatsApp y WebChat no pueden completar su flujo si conversations/messages fallan.

Severidad: critica.

### 3.2 La suite E2E principal no usa la base real

`apps/web/tests/qa/mvp-full-flow.test.ts` ejecuta el flujo completo con:

- objetos en memoria;
- Supabase falso para WebChat;
- OpenAI demo;
- Custom Connect `mock://success`;
- payload WhatsApp parseado, no webhook persistido contra PostgreSQL.

Los smoke tests verifican healthcheck, redirects, webhook GET y rechazo de payloads invalidos. No verifican login real, CRUD real ni RLS real en Supabase.

Resultado de esta auditoria:

- lint: OK;
- test: 33 archivos y 96 tests OK;
- build dentro de `npm run validate`: fallo por `EINVAL readlink` sobre un archivo generado en `apps/web/.next`, dentro de una ruta OneDrive;
- validate: incompleto porque build fallo antes de ejecutar test.

Este fallo de build parece relacionado con el artefacto local `.next`/OneDrive, no con TypeScript, pero el estado actual no permite declarar `npm run validate` OK.

### 3.3 No hay CRUD completo estricto

Los modulos principales implementan Create, Read y Update, pero no Delete ni una alternativa consistente de archivo/desactivacion.

No hay acciones de eliminacion para:

- leads;
- contacts;
- assistants;
- smart tags;
- variables;
- integrations;
- webchat widgets.

Automations permite estado `archived`, pero no presenta una accion especifica de borrado. La eliminacion encontrada solo reemplaza acciones hijas durante una edicion.

### 3.4 El Pipeline requerido no esta implementado

Existen tablas `pipelines` y `pipeline_stages` y datos seed. No existe:

- ruta de Pipeline;
- tablero Kanban;
- drag and drop;
- cambio de etapa;
- realtime del pipeline.

Estado estimado: 10%.

### 3.5 Auditoria de eventos incompleta

`audit_logs` existe y algunos modulos escriben eventos, especialmente Smart Tags, Variables, Automations, Integrations y WebChat settings.

No se auditan de forma consistente:

- login y logout;
- creacion/edicion de leads y contacts;
- conversaciones y mensajes;
- asistentes;
- cambios de estado;
- eliminaciones, que tampoco existen.

## 4. Funcionalidades completamente operativas

Considerando evidencia local y sin afirmar una verificacion remota completa:

1. Autenticacion por email/password con Supabase SSR.
2. Magic link y callback conservados.
3. Onboarding atomico de organizacion mediante RPC.
4. Proteccion de rutas y renovacion de sesion.
5. Listados y vistas de lectura para entidades ya existentes.
6. CRUD C/R/U de contacts.
7. CRUD C/R/U de assistants.
8. CRUD C/R/U de Smart Tags como definiciones.
9. CRUD C/R/U de Variables como definiciones.
10. Healthcheck y System Status basico.
11. Custom Connect manual para URLs HTTP sin secretos y para `mock://`.
12. Google Sheets publico por CSV y busqueda simple.
13. OpenAI Responses API para sugerencias manuales cuando existe una API key valida y demo esta desactivado.
14. Validacion de schemas y contratos unitarios.

Nota: "operativa" aqui significa que el codigo del recorrido esta completo y no depende directamente de uno de los triggers identificados. No sustituye una prueba remota con credenciales reales.

## 5. Funcionalidades parcialmente implementadas

- Leads: UI completa, persistencia expuesta al trigger CRM defectuoso.
- Conversations y Messages: UI y actions completas, persistencia expuesta al mismo trigger.
- Inbox: lectura y herramientas presentes; escritura y canales dependen de conversations/messages.
- WhatsApp: API real y webhook real, pero persistencia central bloqueable y media incompleta.
- WebChat: widget y endpoints reales, pero persistencia bloqueable y sin IA conectada.
- Smart Tags: definicion y asignacion; clasificacion solo heuristica demo.
- Variables: definicion y visualizacion; extraccion solo heuristica demo.
- Automations: modelado, cron y runner; triggers de negocio no conectados y send_message no ejecuta.
- Integrations: ejecucion manual; asistentes solo listan tools.
- Realtime: suscripciones configuradas, pero se resuelve con `router.refresh()` y no con actualizacion incremental.
- Roles: navegacion y algunas policies diferencian admin/agent, pero la proteccion de pagina no es uniforme.
- Dashboard: tres conteos reales y un conteo de asistentes hardcodeado.

## 6. Pantallas placeholder o demostrativas

No hay paginas totalmente vacias, pero estas superficies son placeholders funcionales:

| Pantalla | Motivo |
|---|---|
| Dashboard | "Asistentes IA" esta fijo en 0 y conserva texto que habla de fases futuras ya implementadas. |
| System Status | Diagnostica presencia de env vars, no conectividad real con Supabase, Meta u OpenAI. |
| Google Sheets setup | Default `demo://leads`; no OAuth ni API key realmente resuelta. |
| Custom Connect | Default `mock://success`. |
| Smart Tag analysis | Etiquetado presentado como IA, pero siempre usa clasificacion demo. |
| Variable extraction | Presentada como IA, pero siempre usa heuristicas demo. |
| Automation execution | `send_message` se registra como operacion mock y no se envia. |
| QA E2E | Flujo integral simulado en memoria. |

Ausencias completas que deben considerarse placeholders de producto:

- Pipeline/Kanban;
- gestion de usuarios y membresias;
- configuracion general de organizacion;
- perfil de usuario;
- centro de auditoria;
- gestion de archivos/media;
- panel de notificaciones global.

## 7. Matriz de CRUDs

| Modulo | Create | Read | Update | Delete/Archive | Resultado |
|---|---:|---:|---:|---:|---|
| Leads | Si, con riesgo SQL | Si | Si, con riesgo SQL | No | Incompleto |
| Contacts | Si | Si | Si | No | Incompleto |
| Conversations | Si, con riesgo SQL | Si | Estado/responsable, con riesgo SQL | No | Incompleto |
| Messages | Si, con riesgo SQL | Si | Status via webhook | No | Incompleto |
| Assistants | Si | Si | Si | No | Incompleto |
| Smart Tags | Si | Si | Si | No | Incompleto |
| Variables | Si | Si | Si | No | Incompleto |
| Automations | Si, acciones con riesgo SQL | Si | Si | Estado archived | Parcial |
| Integrations | Si | Si | Custom Connect si | No | Incompleto |
| WebChat widget | Si, con riesgo SQL | Si | Si, con riesgo SQL | No | Incompleto |
| WhatsApp settings | Upsert | Si | Upsert | No | Parcial |

CRUDs estrictamente completos: ninguno.

## 8. Integraciones reales funcionando

### Supabase

- Auth SSR real.
- PostgreSQL y RLS configurados.
- Realtime configurado para varias tablas.
- Service role usado solo en rutas server.

Limitacion: no se ejecuto en esta auditoria un flujo CRUD remoto completo. Los triggers detectados reducen la confiabilidad operativa.

### OpenAI

- `AIOrchestrator` llama a `https://api.openai.com/v1/responses`.
- Usa modelo configurable.
- Construye contexto con asistente, persona, conversacion, mensajes y tools disponibles.
- Guarda logs y pruebas.
- Solo sugiere; no envia automaticamente.

### WhatsApp Cloud API

- Webhook GET de Meta.
- Webhook POST con validacion Zod.
- Firma HMAC opcional.
- Envio real de texto mediante Graph API.
- Parsing de texto, imagen, audio, documento y ubicacion.
- Persistencia prevista de eventos y estados.

Limitacion: no esta probado end-to-end con Meta en esta auditoria y la persistencia depende de triggers CRM defectuosos.

### Custom Connect

- Ejecuta HTTP GET/POST/PUT/PATCH/DELETE.
- Timeout con AbortController.
- Logs de ejecucion.
- Resultado y error visibles.

Limitaciones:

- no hay vault/credentials resolver real;
- headers pueden terminar almacenados como JSON comun;
- no hay proteccion SSRF;
- no se valida `response_schema`;
- no hay transformacion de body segun schema.

### Google Sheets

- Lectura real de hojas publicas mediante CSV.
- Busqueda simple por texto.

Limitaciones:

- parser CSV artesanal, no robusto para todos los casos;
- `api_key_ref` se guarda pero no se resuelve;
- sin OAuth;
- solo lectura publica.

## 9. Integraciones simuladas

- Custom Connect con `mock://success` y `mock://fail`.
- Google Sheets con `demo://leads`.
- Flujo QA WebChat con base en memoria.
- Flujo QA WhatsApp mediante payload parseado.
- Automatizacion `send_message` mockeada.
- OpenAI demo sin llamada externa.
- Seeds con canal WhatsApp deshabilitado.

## 10. Funciones IA reales

### Reales

- Generacion de sugerencia manual mediante OpenAI Responses API.
- Construccion de contexto CRM con ultimos 12 mensajes.
- Prompt, objetivo, tono, reglas y fallback.
- Contexto de lead/contacto y conversacion.
- Listado de tools disponibles dentro del prompt.
- Logs de AI y pruebas de asistentes.

### Limitaciones de la IA real

- no incluye valores de Variables Inteligentes en el contexto del orchestrator;
- no incluye Smart Tags asignados;
- no ejecuta tools;
- no aplica memoria/resumen para conversaciones largas;
- no hay control de tokens ni costos;
- no hay salida estructurada;
- no hay retry, timeout o circuit breaker;
- no hay moderacion ni proteccion especifica contra prompt injection;
- no hay auto reply, por decision de seguridad;
- el asistente asociado a WebChat no participa en el flujo del widget.

## 11. Funciones IA mock/demo

- Smart Tags: siempre demo. El camino `demoMode=false` llama al mismo clasificador heuristico.
- Variables: siempre heuristica demo.
- AIOrchestrator sin API key: respuesta fija contextual basica.
- Clasificacion automatica: no conectada.
- Extraccion automatica: no conectada.
- Ejecucion de tools por IA: no implementada.
- Respuestas automaticas: no implementadas.

## 12. Estado por modulo

### Inbox - 45%

Funciona:

- layout de dos columnas;
- lista y seleccion de conversaciones;
- busqueda por nombre/telefono;
- filtros por canal, estado y responsable;
- historial;
- cambio de status, estado IA y responsable;
- sugerencia IA;
- tags, variables, tareas y notificaciones;
- envio manual;
- suscripcion Realtime con refresh.

No funciona o no esta probado:

- escritura confiable por el trigger CRM;
- adjuntos y media;
- paginacion;
- unread counts;
- typing, presencia o read receipts visuales;
- optimismo de UI;
- busqueda server-side completa;
- responsive movil usable: el grid mantiene dos paneles y no ofrece navegacion maestro-detalle movil;
- cierre/reapertura con historial de auditoria;
- prueba real multicanal end-to-end.

Falta:

- reparar persistencia;
- paginacion y estados no leidos;
- panel de datos del contacto;
- media;
- UX movil;
- pruebas E2E reales.

### Leads - 40%

Funciona:

- listado;
- busqueda;
- filtro por estado;
- alta y edicion en codigo;
- detalle;
- estado y responsable;
- conversion a contact;
- tags, variables y tareas en ficha.

No funciona o no esta probado:

- inserts/updates remotos confiables por trigger;
- pipeline;
- bulk actions;
- duplicados;
- import/export;
- historial completo;
- borrado/archivo;
- auditoria de cambios.

Falta:

- reparar trigger;
- pipeline Kanban;
- deduplicacion;
- timeline;
- archivo;
- CSV;
- E2E remoto.

### Contacts - 70%

Funciona:

- listado y busqueda;
- crear, editar y detalle;
- conversion desde lead;
- iniciar conversacion desde contacto.

No funciona o no esta probado:

- iniciar conversacion depende del trigger de conversations;
- no muestra conversaciones relacionadas en el detalle;
- no hay tags, variables ni timeline equivalente al lead;
- no hay borrado/merge/deduplicacion.

Falta:

- historial conversacional;
- merge y deduplicacion;
- archivo;
- paridad de ficha con Leads.

### Assistants - 75%

Funciona:

- listado, crear, editar y detalle;
- configuracion de prompt, objetivo, tono, reglas y fallback;
- activacion;
- prueba manual;
- sugerencia desde Inbox;
- OpenAI real o demo;
- logs de prueba.

No funciona:

- eliminar/archivar;
- asignacion robusta por canal: `channel_id` es texto libre;
- auto reply;
- versionado de prompts;
- metricas y costos;
- contexto de tags/variables;
- tools ejecutables.

Falta:

- lifecycle completo;
- selector de canal tipado;
- observabilidad;
- guardrails;
- contexto enriquecido;
- ejecucion controlada de tools.

### Smart Tags - 50%

Funciona:

- crear, listar, editar y detalle;
- asignacion manual a conversaciones;
- prevencion de duplicados mediante upsert;
- logs;
- auto pause de IA;
- asignacion a leads prevista.

No funciona:

- clasificacion IA real;
- asignacion a leads confiable por trigger;
- notify_team no crea una notificacion;
- clasificacion automatica;
- eliminar/desasignar tags desde UI.

Falta:

- clasificador estructurado con OpenAI;
- umbrales y revision;
- notificaciones reales;
- eventos automaticos;
- quitar/archivar tags.

### Variables - 40%

Funciona:

- crear, listar, editar y detalle;
- tipos y validacion;
- UI de extraccion en lead e Inbox;
- upsert conceptual;
- confidence y source message.

No funciona:

- extraccion IA real;
- persistencia confiable por trigger generico;
- extraccion automatica;
- edicion manual del valor;
- required no se hace cumplir en workflows;
- historial/versionado del valor.

Falta:

- extractor OpenAI con JSON Schema;
- correccion de integridad SQL;
- revision humana;
- valores manuales;
- jobs automaticos.

### Automations - 35%

Funciona:

- listado, crear, editar y detalle;
- triggers y acciones modelados;
- runs e historial;
- cron protegido;
- ejecucion manual;
- create_task, pause_ai, assign_smart_tag, update_variable y notify_internal en el runner;
- reglas desactivadas por defecto.

No funciona:

- acciones pueden no guardarse por trigger;
- los eventos lead_created, message_received, smart_tag_assigned y variable_updated no programan runs;
- inactivity no tiene productor de runs;
- send_message nunca envia;
- errores de operaciones internas son ignorados por el runner;
- no hay retry, locking ni idempotencia;
- no hay constructor visual de condiciones/acciones: se usan campos JSON.

Falta:

- bus de eventos/outbox;
- workers idempotentes;
- ejecucion real segura de mensajes;
- manejo de errores por accion;
- retries;
- editor visual;
- observabilidad.

### Integrations - 65%

Funciona:

- listado y detalle;
- alta/edicion de Custom Connect;
- alta de Google Sheets;
- ejecucion manual;
- logs;
- rate limit basico;
- HTTP real y Sheets publico real;
- tools visibles para AIOrchestrator.

No funciona:

- tools no se ejecutan desde IA;
- secretos no usan un vault real;
- Google Sheets no se edita desde su propia pantalla;
- no hay delete/archive;
- rate limit es memoria local de instancia;
- falta SSRF allowlist;
- schemas no gobiernan request/response de forma completa.

Falta:

- credential resolver server-side;
- seguridad de red;
- validacion estructurada;
- lifecycle completo;
- tool calling con aprobacion humana.

### WebChat - 35%

Funciona:

- script embebible;
- panel de configuracion;
- token publico;
- allowed domains;
- endpoints start/message/history;
- captura opcional soportada por API;
- lead/contact upsert;
- conversacion e Inbox previstos;
- respuesta manual prevista.

No funciona o no esta completo:

- widget puede no guardarse por trigger;
- creacion de lead/conversation/message puede fallar por trigger CRM;
- el script no muestra formulario para nombre, email o telefono;
- no hay respuesta IA;
- no hay polling periodico ni Realtime en el widget;
- errores se silencian;
- historial se protege con token publico + conversation UUID, sin prueba adicional de visitante;
- rate limit en memoria no es distribuido.

Falta:

- corregir persistencia;
- captura de identidad en UI;
- token de sesion de visitante firmado;
- polling/Reatime;
- estados y errores;
- IA opcional;
- test desde dominio externo real.

### WhatsApp - 45%

Funciona:

- webhook GET;
- webhook POST;
- validacion Zod;
- firma HMAC opcional;
- parsing de texto, imagen, audio, documento y ubicacion;
- envio manual real de texto;
- estados sent/delivered/read/failed;
- eventos y payloads previstos;
- settings.

No funciona o no esta completo:

- persistencia puede fallar por triggers de conversations/messages;
- imagen/audio/documento solo guardan IDs y metadata;
- no se descarga media ni se guarda en Storage;
- Inbox no renderiza media ni ubicacion;
- envio manual solo usa texto aunque el servicio soporta media;
- no hay templates;
- no hay gestion de ventana de 24 horas;
- firma queda desactivada si falta APP_SECRET;
- no se verifico sandbox/Meta real en esta auditoria.

Falta:

- persistencia estable;
- media download/upload;
- templates;
- reglas de ventana;
- retries e idempotencia;
- dashboard de delivery;
- prueba real sandbox.

### Dashboard - 35%

Funciona:

- workspace y rol;
- conteos de leads, conversaciones y tags;
- logout;
- estado vacio sin organizacion.

No funciona:

- asistentes esta hardcodeado en 0;
- no hay KPIs requeridos de nuevos leads, conversaciones abiertas/cerradas, mensajes enviados/recibidos, uso IA o tokens;
- no hay graficos, tendencias ni actividad;
- el texto de "siguientes fases" esta obsoleto;
- usa un layout distinto al resto del CRM.

Falta:

- queries KPI reales;
- filtros por fecha;
- actividad reciente;
- metricas de canal y agentes;
- uso/costo IA;
- consistencia visual.

## 13. Seguridad y multi tenant

Fortalezas:

- todas las entidades principales incluyen `organization_id`;
- RLS esta habilitado ampliamente;
- queries de aplicacion agregan filtro de organizacion;
- service role esta encapsulado en servidor;
- schemas Zod cubren inputs principales;
- callback/auth SSR siguen patrones correctos;
- webhook WhatsApp soporta HMAC;
- cron usa secreto;
- configuraciones sensibles se leen desde env.

Riesgos:

- triggers rotos convierten la proteccion de integridad en indisponibilidad;
- RLS se prueba como contrato de texto, no contra PostgreSQL con dos tenants reales;
- Custom Connect no evita SSRF a hosts internos;
- headers potencialmente sensibles se guardan en `headers_schema`;
- rate limits en memoria se reinician y no coordinan instancias Vercel;
- WebChat no usa un token firmado por sesion/visitante;
- `WHATSAPP_APP_SECRET` opcional permite aceptar webhooks sin firma;
- paginas admin se ocultan por navegacion, pero no todas hacen un guard explicito; se depende de RLS;
- no hay sanitizacion/normalizacion avanzada para telefono, URLs o contenido;
- no hay Content Security Policy especifica para widget/canales.

## 14. Calidad tecnica

Fortalezas:

- separacion modular razonable;
- TypeScript y Zod;
- 96 tests unitarios/contractuales pasan;
- buenas restricciones de no auto-envio;
- logs especializados para IA, tags, variables, automatizaciones e integraciones;
- deploy y healthcheck documentados.

Deuda:

- React Hook Form esta declarado pero no se usa;
- shadcn/ui es una implementacion minima propia, no una libreria de componentes amplia;
- errores de Supabase se convierten en codigos genericos y ocultan causa real;
- muchas operaciones secundarias ignoran `error`;
- acciones multipaso no usan transacciones/RPC;
- no hay repositorio/data layer consistente;
- los documentos de validacion declaran completitud superior a la evidencia actual;
- hay texto con encoding mojibake visible en varios archivos;
- la busqueda del Inbox se filtra en memoria sobre solo 50 conversaciones;
- Realtime refresca toda la ruta.

## 15. Roadmap priorizado hacia un MVP funcional equivalente

### P0 - Recuperar integridad operativa

Objetivo: completar un flujo CRM real sin errores SQL.

1. Reemplazar triggers genericos por funciones especificas por tabla.
2. Validar inserts/updates de leads, conversations, messages, lead_tags, variable values, automation_actions y webchat_widgets.
3. Crear tests SQL reales con dos organizaciones.
4. Ejecutar flujo remoto: lead -> conversation -> message -> Inbox.
5. Corregir manejo de errores para mostrar causa y correlation ID.

Criterio de salida: todos los CRUD centrales funcionan en Supabase remoto y cross-tenant es rechazado.

### P1 - Completar el nucleo comercial

1. Implementar Pipeline Kanban y persistencia de etapas.
2. Agregar timeline unificado a lead/contact.
3. Completar archive/delete segun politica de retencion.
4. Agregar deduplicacion y merge.
5. Completar dashboard KPI.
6. Mejorar Inbox movil, paginacion y unread.
7. Completar auditoria de login, CRM y mensajes.

Criterio de salida: un agente puede gestionar el ciclo de venta diario sin salir del CRM.

### P1 - Canales reales

1. Validar WhatsApp sandbox end-to-end.
2. Descargar media de Meta y guardar en Supabase Storage.
3. Renderizar imagen, audio, documento y ubicacion.
4. Implementar templates y ventana de 24 horas.
5. Corregir WebChat end-to-end.
6. Agregar identidad del visitante, token firmado y actualizacion periodica.
7. Probar widget desde un dominio externo permitido.

Criterio de salida: mensajes reales entran, aparecen y se responden desde Inbox con estados correctos.

### P2 - IA productiva

1. Integrar SmartTagClassifier con OpenAI y salida estructurada.
2. Integrar VariableExtractor con OpenAI y JSON Schema.
3. Incorporar tags y variables al contexto del AIOrchestrator.
4. Agregar guardrails, timeout, retries y trazabilidad.
5. Implementar metricas de tokens/costo/latencia.
6. Conectar asistente a WebChat en modo sugerencia.
7. Mantener confirmacion humana antes de todo envio.

Criterio de salida: clasificacion, extraccion y sugerencias usan IA real, son auditables y permiten revision.

### P2 - Automatizaciones confiables

1. Crear outbox/eventos para triggers CRM.
2. Programar runs de forma idempotente.
3. Implementar locking, retries y dead-letter.
4. Propagar errores de cada accion.
5. Habilitar send_message solo con doble control de estado y entorno.
6. Crear editor visual de condiciones/acciones.

Criterio de salida: una regla activa reacciona una sola vez al evento correcto y deja evidencia completa.

### P3 - Integraciones y tools

1. Implementar credential references reales o Supabase Vault.
2. Bloquear SSRF y restringir destinos.
3. Validar request/response con schemas.
4. Habilitar tool calling con allowlist y aprobacion humana.
5. Sustituir rate limit en memoria por mecanismo persistente.
6. Completar lifecycle de Google Sheets e integrations.

Criterio de salida: una tool puede probarse, aprobarse y ejecutarse desde IA sin exponer secretos.

### P3 - QA productiva

1. E2E autenticado contra Supabase local real.
2. Tests de RLS con dos usuarios y dos organizaciones.
3. E2E de CRUDs y canales.
4. Pruebas de migracion desde cero.
5. Pruebas de rollback.
6. Ejecutar QA en CI fuera de OneDrive.
7. Alinear documentacion de fases con evidencia automatizada.

Criterio de salida: CI valida build, migraciones, RLS y recorridos principales sin fakes.

### P4 - Escala y operacion

1. Observabilidad centralizada.
2. Alertas para webhooks, cron, IA y tools.
3. SLOs, backups y restauracion probada.
4. Retencion y privacidad de datos.
5. Gestion de usuarios/invitaciones.
6. Configuracion de organizacion y dominios.

## 16. Orden recomendado de ejecucion

1. Triggers e integridad SQL.
2. E2E real CRM + RLS.
3. Pipeline, dashboard e Inbox.
4. WhatsApp y WebChat reales.
5. Smart Tags y Variables con IA real.
6. Automatizaciones por eventos.
7. Tools con credenciales seguras.
8. Hardening, observabilidad y deploy definitivo.

## 17. Veredicto

El proyecto no es un conjunto de placeholders: contiene una cantidad significativa de codigo util y una arquitectura aprovechable. Auth, onboarding, modelado, pantallas, validaciones y servicios base representan trabajo real.

Tampoco puede considerarse hoy un MVP productivo completo. El bloqueo SQL afecta el corazon conversacional, varias funciones denominadas IA son heuristicas demo, los E2E principales no usan infraestructura real y faltan capacidades centrales del specification, especialmente Pipeline, media, automatizaciones por eventos y herramientas ejecutadas por IA.

La ruta mas eficiente no es agregar modulos nuevos. Es estabilizar primero el recorrido real lead -> conversation -> message -> Inbox y usarlo como columna vertebral para canales, IA y automatizaciones.

## 18. Actualizacion FASE 13

Estado: resuelto en codigo y validado localmente el 2026-06-20. La migracion remota queda pendiente de `npx supabase db push`.

Puntos resueltos:

- triggers SQL genericos reemplazados por validadores especificos por tabla;
- eliminado el acceso invalido a `NEW.user_id`, `NEW.conversation_id`, `NEW.owner_id` y `NEW.webchat_widget_id` desde tablas que no poseen esas columnas;
- descubiertos y agregados los privilegios SQL faltantes para `authenticated`, manteniendo RLS;
- 20 pruebas PostgreSQL reales pasan con dos organizaciones;
- migraciones y seed aplican desde cero sin omitir el CRM core;
- Leads, Contacts, Conversations, Messages, Assistants, Smart Tags y Variables disponen de archivo no destructivo;
- Messages dispone de edicion manual desde Inbox;
- listados, detalles y operaciones activas excluyen registros archivados;
- errores de Supabase se traducen a mensajes visibles y seguros;
- auditoria agregada a create/update/archive del CRM core y Assistants;
- build bajo OneDrive corregido limpiando de forma segura solo `apps/web/.next`.

Estado revisado de los hallazgos:

| Hallazgo original | Estado FASE 13 |
|---|---|
| Triggers SQL bloquean operaciones centrales | Resuelto localmente |
| RLS solo cubierto por contratos de texto | Mejorado: prueba PostgreSQL real con dos tenants |
| CRUD sin delete/archive | Resuelto para los siete modulos priorizados |
| Errores genericos sin causa util | Resuelto para CRUD priorizados |
| Seed omite CRM core | Resuelto |
| Build OneDrive falla por `readlink` | Resuelto |
| Pipeline/Kanban | Pendiente, fuera de FASE 13 |
| Smart Tags y Variables con IA demo | Pendiente, fuera de FASE 13 |
| Automatizaciones por eventos y send_message real | Pendiente, fuera de FASE 13 |

## 19. Actualizacion FASE 14

Estado: recuperacion funcional validada el 2026-06-21.

Resuelto:

- dashboard fuera del shell CRM;
- tarjetas KPI sin navegacion;
- contador de assistants hardcodeado;
- ausencia total de menu movil;
- formularios prioritarios sin feedback pendiente;
- Custom Connect invalido cuando description estaba vacia;
- errores ignorados en escrituras hijas de Automations e Integrations;
- posible Integration huerfana;
- `next dev` afectado por `.next` corrupto en OneDrive;
- ausencia de un E2E autenticado con PostgreSQL real.

El recorrido Playwright real pasa para Login, Onboarding, Dashboard, Leads, Contacts, Inbox, Messages, Assistants, Smart Tags, Variables, Automations e Integrations.
