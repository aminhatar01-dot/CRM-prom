# FASE 25 - Auditoria productiva final

Fecha de auditoria: 2026-06-28  
Alcance: revision estatica del repositorio, migraciones, rutas, servicios, pruebas y documentacion.  
Restricciones respetadas: no se modifico logica, no se crearon migraciones y no se consulto ni altero produccion.

## 1. Dictamen ejecutivo

CRM PRO AI ya no es un prototipo visual. El nucleo CRM, WhatsApp directo, Inbox, IA controlada, RAG, automatizaciones y cotizaciones tienen implementaciones reales y persistencia multi-tenant. Sin embargo, el producto aun no esta listo para venderse como SaaS autoservicio general sin acompanamiento.

**Completitud funcional del MVP tecnico: 81%.**  
**Preparacion para pilotos comerciales asistidos: 78%.**  
**Preparacion para SaaS autoservicio comercial: 61%.**

La diferencia no esta principalmente en el CRM. Esta en el plano comercial y operativo: no existen creditos de IA, planes, facturacion, recuperacion de contrasena visible, gestion completa de equipo, observabilidad centralizada, trabajos distribuidos con reintentos, gestion legal de datos ni onboarding autonomo de WhatsApp para cada cliente.

### Decision de lanzamiento

- **Se puede vender ahora:** piloto asistido y limitado, con alta manual, una cuenta WhatsApp directa administrada, limites contractuales, monitoreo humano y facturacion manual.
- **No se debe vender aun:** SaaS autoservicio masivo, multi-cuenta WhatsApp sin intervencion, omnicanal social, SLA fuerte, creditos prepagos ni publicacion automatica de Ads.
- **Siguiente fase recomendada:** FASE 26 - Control comercial de IA: ledger, creditos, planes, limites y panel de consumo. Debe preceder a nuevas integraciones y a la automatizacion de cobros.

## 2. Metodo y evidencia

La auditoria reviso:

- 22 migraciones SQL y 45 tablas detectadas.
- 43 pantallas de aplicacion y 9 endpoints API.
- 63 archivos de pruebas unitarias, de contrato o E2E.
- Acciones de servidor de CRM, onboarding, automatizaciones e integraciones.
- Motores de WhatsApp, IA, RAG, WebChat, cotizaciones y automatizaciones.
- RLS, funciones de pertenencia, validadores multi-tenant y Storage.
- Variables de entorno y limites de exposicion entre servidor y navegador.

El informe anterior `AUDIT_REPORT.md` fue usado solo como antecedente. Sus hallazgos de FASE 13 son historicos: los triggers genericos, el archivado CRUD y gran parte de los modulos que entonces faltaban fueron corregidos en fases posteriores.

No se hizo smoke contra produccion ni se usaron secretos. Por eso, los estados externos de Meta, OpenAI, Vercel y Supabase deben interpretarse segun la implementacion y la evidencia operativa documentada, no como una comprobacion en vivo de esta auditoria.

## 3. Mapa de completitud

| Area | Estado | Completitud | Observacion |
|---|---|---:|---|
| Auth y workspace inicial | Funcional con faltantes | 82% | Login, callback, onboarding y RPC inicial existen; falta recuperacion de contrasena y ciclo completo de cuenta |
| Multi-tenant y RLS | Funcional, requiere prueba adversarial | 88% | Las 45 tablas detectadas habilitan RLS; hay validadores de integridad y politicas por membresia |
| Leads, contactos y pipeline | Listo para piloto | 92% | CRUD real, archivado y Kanban persistente |
| Inbox y conversaciones | Listo para piloto | 90% | Conversaciones, mensajes, Realtime, drafts y respuesta manual |
| WhatsApp Cloud API directa | Operativa | 88% | Webhook firmado, inbound, outbound y estados; alta de cliente aun asistida |
| WebChat | Parcial | 66% | Widget y endpoints reales; identidad y rate limit no son robustos para escala |
| Asistentes, router e IA | Funcional con riesgo de costo | 85% | OpenAI real, demo controlado, contexto CRM, routing y logs; sin creditos ni presupuesto |
| Base de conocimiento y RAG | Funcional | 84% | Documentos, imports, chunks, embeddings y busqueda tenant-safe |
| Smart Tags y Variables | Funcional | 86% | CRUD, asignacion/extraccion, logs y automatizaciones |
| Automatizaciones | Funcional con deuda operativa | 75% | Eventos reales, condiciones, acciones, idempotencia y autoenvio controlado; reintentos/colas insuficientes |
| Cotizaciones | Funcional para flujo asistido | 80% | CRUD, catalogo, pagina publica y acciones conversacionales; falta ciclo comercial/fiscal avanzado |
| Onboarding inteligente | Funcional guiado | 82% | Wizard, plantillas, estado y preview; varios pasos siguen dependiendo de servicios externos/manuales |
| Integraciones | Parcial | 45% | Custom Connect y Sheets publico; sin OAuth general ni catalogo amplio de proveedores |
| Roles y equipo | Parcial | 40% | Roles y navegacion existen; no hay administracion completa de invitaciones/equipo |
| Observabilidad y operaciones | Parcial | 42% | Health/System Status/auditoria; sin APM, alertas, DLQ ni consola operativa integral |
| Planes, creditos y billing | No implementado | 5% | Solo documentacion de limites/billing; no existe control de consumo comercial |
| Legal, privacidad y soporte | No implementado | 10% | Faltan terminos, privacidad, retencion, exportacion/borrado y proceso de soporte |

## 4. Onboarding y multi-tenant

### Lo que funciona

- Registro/login por Supabase y callback SSR.
- Creacion atomica de organizacion y primer owner mediante RPC.
- Wizard de nueve pasos con perfil de negocio, casos de uso, asistentes, estilo, conocimiento, WhatsApp, automatizaciones, simulacion y checklist.
- Plantillas de asistentes y reglas iniciales editables.
- Estado de configuracion con porcentaje, pendientes y recomendaciones.
- Consultas de negocio filtradas por `organization_id` y RLS.
- Triggers de integridad que validan referencias entre entidades de la misma organizacion.

### Lo que esta parcial

- Conectar WhatsApp propio no es completamente autoservicio: Embedded Signup existe, pero el camino validado actualmente es Cloud API directa con configuracion externa asistida.
- La carga de conocimiento esta implementada, pero no hay cuota de archivos, almacenamiento ni embeddings por plan.
- La prueba guiada ayuda a previsualizar routing, pero no sustituye una prueba real E2E con cuenta externa.
- El sistema obtiene una organizacion activa; no hay selector y administracion madura para usuarios pertenecientes a varias organizaciones.

### Lo que falta

- Invitar, reenviar invitacion, revocar y administrar miembros desde UI.
- Recuperacion de contrasena completa y visible.
- Transferencia de ownership, baja de usuario y cierre/eliminacion de workspace.
- Aceptacion versionada de terminos y privacidad.
- Provisionamiento de plan, creditos y limites al crear una organizacion.
- E2E adversarial con dos tenants reales que intente leer y mutar datos cruzados.

## 5. Seguridad

### Controles comprobados en codigo

- Las 45 tablas creadas por migraciones tienen `ENABLE ROW LEVEL SECURITY`.
- Las entidades privadas usan `organization_id`, politicas por membresia/admin y validadores tenant-specific.
- `SUPABASE_SERVICE_ROLE_KEY`, OpenAI y credenciales de WhatsApp se consumen en codigo server-side.
- No se detectaron secretos declarados como `NEXT_PUBLIC_*`.
- El webhook de WhatsApp verifica `x-hub-signature-256` con App Secret.
- El cron requiere `CRON_SECRET` por Authorization o header dedicado.
- Los chunks y embeddings no se conceden al rol authenticated; la busqueda RAG exige service role.
- Automatizaciones usan claves de idempotencia y bloqueos para outbound, loops, contexto insuficiente, ventana WhatsApp y rate limits.
- Hay auditoria en operaciones centrales y logs especificos de IA, WhatsApp, integraciones y automatizaciones.

### Riesgos y faltantes

1. **Custom Connect presenta riesgo SSRF alto.** Acepta una URL arbitraria y ejecuta `fetch` server-side sin bloqueo explicito de localhost, metadata cloud, IP privadas ni resolucion DNS segura.
2. **Rate limits no distribuidos.** Integraciones y WebChat usan memoria del proceso; en Vercel pueden reiniciarse o repartirse entre instancias.
3. **Credenciales de integraciones incompletas.** Existen `credentials_ref`/`integration_secrets`, pero no un vault general con rotacion, revocacion y cifrado por proveedor demostrado.
4. **Politicas funcionales, permisos gruesos.** Owner/admin/agent controlan navegacion, pero falta una matriz granular por accion y recurso; varias tablas CRM permiten escritura a cualquier miembro.
5. **Storage requiere endurecimiento y pruebas.** El bucket de imports es privado, pero deben probarse rutas, MIME, tamano, antivirus y borrado tenant-safe. No hay pipeline antimalware.
6. **Logs sin politica comercial de retencion.** No hay redaccion central de PII, expiracion ni exportacion/borrado por solicitud.
7. **Sin CSP/headers de seguridad documentados como contrato.** Deben auditarse CSP, HSTS, frame-ancestors, Referrer-Policy y Permissions-Policy en despliegue.
8. **Sin escaneo continuo.** Falta SAST/dependency audit/secret scanning como gate de CI documentado.

### Estado RLS

La cobertura declarativa es alta, pero “RLS habilitado” no equivale por si solo a aislamiento probado. Antes de vender autoservicio deben ejecutarse contratos contra una base staging con owner, admin, agent y usuario externo, cubriendo SELECT/INSERT/UPDATE/DELETE en cada tabla critica y RPC.

## 6. Automatizaciones

### Triggers realmente conectados

- `message_received` y `conversation_created`: despachados desde webhook WhatsApp real.
- `lead_created` y `lead_status_changed`: despachados desde acciones CRM.
- `smart_tag_assigned`: despachado desde acciones de Smart Tags.
- `variable_updated`: despachado desde acciones de Variables.
- `manual`: ejecutable desde UI/accion de servidor.
- `inactivity`: modelado y programable, pero su madurez depende del cron y no tiene una cola durable dedicada.

### Acciones reales disponibles

- Crear tarea interna.
- Aplicar Smart Tag.
- Extraer/actualizar Variable.
- Cambiar estado del lead.
- Crear actividad e historial.
- Notificar internamente.
- Pausar IA.
- Generar borrador IA.
- Enviar mensaje bajo reglas de autoenvio.
- Crear y operar cotizaciones.

### Protecciones existentes

- Reglas desactivadas por defecto salvo activacion explicita.
- `auto_send=false` como postura segura.
- Un run por clave idempotente evento/regla.
- No dispara respuesta por mensajes outbound/propios.
- Ventana WhatsApp de 24 horas.
- Limites por mensaje, conversacion y organizacion.
- Escalamiento por intencion sensible, contexto/RAG insuficiente o pausa humana.
- Draft pendiente como fallback cuando el autoenvio no es seguro.

### Deuda para uso comercial

- No hay cola durable ni `dead_letter_queue` para reintentos con backoff.
- El cron procesa pendientes, pero falta lease distribuido, timeout de run, watchdog y recuperacion de ejecuciones `running` abandonadas.
- No hay versionado de reglas ni rollback de configuracion.
- Falta un constructor visual mas expresivo para AND/OR, ventanas horarias y ramas.
- No hay limites por plan ni costo estimado antes de acciones IA.
- Los errores son visibles en logs, pero falta alertado proactivo y agrupacion por causa.
- La suite QA conserva un runner historico simulado en `packages/automation`; el motor productivo esta en `apps/web/src/lib/automation/real-engine.ts`. Deben converger para evitar contratos divergentes.
- Acciones comercialmente utiles pendientes: email, calendario/turno, webhook firmado con reintentos, cambio de responsable, SLA/escalamiento temporal y sincronizacion de ecommerce.

## 7. Integraciones actuales

| Integracion | Estado | OAuth | Credenciales | Limites/observaciones |
|---|---|---|---|---|
| WhatsApp Cloud API directa | Real y operativa | Token Meta manual/system user | Server env + settings tenant | El alta de cada cliente requiere proceso externo asistido |
| Meta Embedded Signup | Implementada, no validada como alta comercial general | Si | Token cifrado/referencia server-side | Depende de configuracion y aprobacion de Meta Technology Provider |
| WebChat | Real | No aplica | Token publico por widget | Rate limit en memoria; endurecer identidad y abuso |
| Custom Connect | Real en modo manual/test | No | Headers/config actuales | Riesgo SSRF; sin OAuth, vault, refresh ni retries |
| Google Sheets | Real para hoja publica CSV | No | URL publica/API key ref incompleta | Sin OAuth, escritura, sync incremental ni webhooks |
| Herramientas IA | Preparadas/listadas | No | Segun integracion | No se ejecutan automaticamente en conversaciones reales, por diseno seguro |

No existen implementaciones funcionales actuales de Instagram DM, Facebook Pages, Messenger, TikTok, Mercado Libre, Tienda Nube, Shopify, WooCommerce, Gmail, Google Calendar, Meta Ads ni Google Ads. No deben presentarse comercialmente como “proximamente conectado” sin alcance y dependencia de aprobacion claramente visibles.

## 8. Arquitectura objetivo de integraciones por cliente

Cada proveedor debe usar una conexion propiedad de una organizacion, nunca una cuenta global compartida.

### Modelo recomendado

- `integration_connections`: organizacion, proveedor, estado, cuenta externa, scopes, expiracion, error seguro y timestamps.
- `integration_credentials`: solo referencia a vault/cifrado server-side; nunca devolver secreto al navegador.
- `oauth_states`: state, PKCE, organizacion, usuario, redirect y expiracion de un solo uso.
- `integration_webhook_events`: payload normalizado, firma, proveedor, external_id e idempotencia.
- `integration_sync_jobs`: cursor, lease, intentos, proxima ejecucion y estado.
- `integration_dead_letters`: errores agotados, replay manual y auditoria.
- Adaptadores por proveedor con interfaz comun: connect, refresh, disconnect, verify, webhook, pull y push.
- Desconexion real: revocar token cuando el proveedor lo permita, borrar/cancelar credencial y detener jobs.

### Priorizacion sugerida

1. **Google Calendar y Gmail:** valor transversal para seguimiento, reuniones y notificaciones; OAuth conocido y alcance acotable.
2. **Un conector comercial segun mercado inicial:** Mercado Libre/Tienda Nube para LatAm o Shopify/WooCommerce para ecommerce internacional. Elegir uno, no cuatro a la vez.
3. **Instagram/Messenger/Facebook:** alto valor conversacional, pero sujetos a App Review, permisos y politicas Meta.
4. **Meta Ads y Google Ads lectura:** primero metricas y atribucion, sin publicar.
5. **TikTok y escritura de Ads:** despues de observabilidad, aprobaciones y modelo comercial.

### Estado esperado por conexion

`disconnected`, `connecting`, `connected`, `degraded`, `expired`, `revoked`, `error`. La UI debe mostrar ultimo sync, permisos, cuenta conectada, vencimiento, error accionable y boton desconectar.

## 9. Ads y campanas

### Arquitectura segura

1. Conectar cuenta publicitaria por OAuth tenant-specific.
2. Importar cuentas, campanas, ad sets, anuncios, gasto, impresiones, clics, leads y conversiones mediante jobs incrementales.
3. Normalizar metricas en un modelo comun sin perder payload original.
4. Vincular `utm_*`, click IDs y formularios lead-ad con leads CRM.
5. Permitir a IA generar brief, copies, variantes y sugerencias usando Base de Conocimiento.
6. Guardar toda propuesta como `draft` con presupuesto, audiencia, creatividad y advertencias.
7. Exigir aprobacion humana con rol owner/admin antes de cualquier mutacion externa.
8. Registrar diff, aprobador, presupuesto, respuesta del proveedor y rollback disponible.

### Guardas obligatorias

- La IA nunca publica, aumenta presupuesto ni pausa campanas por si sola.
- Presupuesto diario y total requieren moneda y confirmacion explicita.
- Doble confirmacion para aumentos sobre umbral.
- Idempotencia por operacion externa.
- Previsualizacion exacta antes de publicar.
- Rate limits, retries y reconciliacion con estado remoto.
- Separar permisos read-only de campaign management.

### Fases Ads

- Ads A: lectura y dashboard de metricas.
- Ads B: atribucion de leads y recomendaciones IA.
- Ads C: creacion asistida en borrador.
- Ads D: publicacion humana auditada.

## 10. Costos de IA y sistema de creditos

### Estado actual

Los logs de IA pueden guardar modelo, tokens y metadata de ejecucion, pero no existe saldo, precio, reserva transaccional, plan ni bloqueo por fondos. Un cliente puede generar costo sin una barrera comercial cuantificable.

### Modelo propuesto

#### `plans`

- `id`, `name`, `currency`, `monthly_credits`, limites de miembros/documentos/conversaciones.
- Modelos permitidos y features habilitadas.
- `active`, version y fecha de vigencia.

#### `organization_subscriptions`

- `organization_id`, `plan_id`, estado, periodo, renovacion y proveedor de pago opcional.
- En la primera etapa puede administrarse manualmente.

#### `ai_credit_wallets`

- Un saldo por organizacion y moneda de credito.
- `available`, `reserved`, `low_balance_threshold`, `updated_at`.
- Actualizaciones solo mediante funciones transaccionales server-side.

#### `ai_usage_ledger`

- `organization_id`, `assistant_id`, `conversation_id`, `user_id`.
- Operacion: reply, classification, extraction, embedding, routing, quote u otra.
- Modelo, `input_tokens`, `output_tokens`, unidades, costo proveedor estimado y creditos debitados.
- Snapshot de tarifa/modelo para auditoria historica.
- `idempotency_key`, estado reserve/settled/released/refunded y timestamps.
- Metadata segura sin prompt completo ni secretos.

#### `credit_packages` y `credit_adjustments`

- Paquetes vendibles, vigencia y cantidad.
- Ajustes manuales con motivo, actor y auditoria inmutable.

### Flujo transaccional obligatorio

1. Estimar maximo de creditos antes de llamar al proveedor.
2. Reservar saldo en una transaccion con lock y clave idempotente.
3. Si no hay saldo: no llamar a OpenAI; crear estado bloqueado y aviso accionable.
4. Ejecutar la operacion.
5. Liquidar consumo real con tokens reportados y liberar excedente.
6. Reembolsar reserva ante error no facturable.
7. Emitir alerta de saldo bajo y mostrar desglose en panel.

El modo demo/admin debe ser explicito, limitado y auditado. Nunca debe ser un fallback silencioso para una organizacion comercial sin saldo.

### Panel de consumo

- Saldo, reservado, consumo del periodo y proyeccion.
- Uso por asistente, operacion, modelo y conversacion.
- Alertas, top consumidores y exportacion CSV.
- Historial de cargas/ajustes.
- Limite duro y limite de advertencia configurables.

### Facturacion

- **Inicio:** factura y acreditacion manual con registro de actor y comprobante externo.
- **Despues:** Mercado Pago para foco LatAm o Stripe para internacional. El webhook de pago debe ser firmado, idempotente y acreditar mediante ledger, nunca mediante update directo del saldo.

## 11. Preparacion comercial

| Necesidad | Estado | Bloqueante para piloto | Bloqueante para autoservicio |
|---|---|---:|---:|
| Emails transaccionales propios | Solo Supabase Auth/base | No | Si |
| Recuperacion de contrasena | Callback soporta recovery, falta flujo visible completo | No con soporte | Si |
| Gestion de equipo | Schema/roles, sin UI completa | No para un usuario | Si |
| Permisos granulares | Basicos owner/admin/agent | No con alcance contractual | Si |
| Planes y limites | Ausentes | Si para escala | Si |
| Creditos IA | Ausentes | Si para controlar margen | Si |
| Facturacion | Ausente | No si es manual | Si |
| Terminos/privacidad | Ausentes | Si para clientes reales | Si |
| Monitoreo/APM | Health y System Status | Recomendado | Si |
| Backups/restore drill | Dependencia Supabase, sin evidencia de simulacro | Si | Si |
| Error tracking y alertas | Logs de dominio, sin agregador | Recomendado | Si |
| Documentacion cliente | Documentacion tecnica amplia | Parcial | Si |
| Soporte y SLA | No definido | Si | Si |
| Panel admin interno | Ausente | No con SQL/manual controlado | Si |

Tambien se detectaron cadenas con mojibake visible en pantallas recientes (por ejemplo “configuraciÃ³n” y el separador del dashboard). Es deuda de calidad percibida y debe corregirse antes de una demo comercial formal.

## 12. Pruebas y confianza de entrega

### Cobertura existente

- Unit tests y schemas para CRM, IA, variables, Smart Tags, integraciones y seguridad.
- Contratos de migraciones/RLS.
- Playwright para login, smoke de rutas, Pipeline, IA demo, FASE 14 y WhatsApp signup.
- Healthcheck, webhook verify y rechazo de WebChat malformado.
- Smoke remoto especifico de conocimiento disponible como script.

### Limitaciones

- El Playwright general usa Supabase local ficticio y se concentra en redirects/endpoints, no en un flujo autenticado completo.
- `mvp-full-flow.test.ts` es una simulacion en memoria y usa AI demo, Custom Connect mock y runner legado; no prueba persistencia integral.
- No hay suite automatizada que conecte WhatsApp/Meta/OpenAI reales en staging de forma segura.
- No hay prueba E2E de dos tenants intentando operaciones cruzadas en todas las entidades.
- No hay pruebas de expiracion/refresh/revocacion de credenciales de proveedores.
- Solo Pipeline tiene `loading.tsx`; faltan limites globales coherentes de loading/error/not-found para rutas de negocio.

### Suite E2E productiva propuesta

Ejecutarla en staging aislado, con cuentas y numeros de prueba:

1. Crear usuario A, recuperar contrasena, crear organizacion y completar onboarding.
2. Invitar agente, validar permisos y revocarlo.
3. Importar catalogo, esperar indexacion y verificar RAG con fuente.
4. Crear asistente y regla en modo borrador.
5. Conectar WhatsApp de prueba y validar firma/webhook.
6. Recibir mensaje, crear contacto/conversacion, responder con IA y confirmar `sent/delivered`.
7. Generar cotizacion con precio real, aprobarla y abrir token publico.
8. Ejecutar automatizacion, idempotencia, retry y fallback humano.
9. Consumir creditos, verificar ledger, saldo bajo y bloqueo sin llamada IA.
10. Crear tenant B e intentar leer/mutar todos los IDs del tenant A.
11. Conectar y desconectar una integracion, revocar token y verificar que jobs se detengan.
12. Validar exportacion/borrado/retencion y restore desde backup.

## 13. Riesgos criticos priorizados

### P0 - Antes de cobrar a clientes

1. Consumo OpenAI sin creditos ni limite economico transaccional.
2. Falta de terminos, privacidad, politica de datos y consentimiento.
3. Custom Connect puede alcanzar destinos internos si no se agrega proteccion SSRF.
4. Sin proceso probado de backup/restore y respuesta a incidentes.
5. Alta WhatsApp por cliente no es todavia autoservicio estable.

### P1 - Antes de autoservicio

1. Gestion de equipo, invitaciones, recovery y ciclo de cuenta.
2. Observabilidad central, alertas, correlacion y consola admin.
3. Rate limits distribuidos y jobs durables con retries/DLQ.
4. Permisos granulares y E2E multi-tenant adversarial.
5. Cuotas de Storage, conocimiento, mensajes y automatizaciones.

### P2 - Para expansion

1. OAuth/vault comun de integraciones.
2. Gmail/Calendar y un conector ecommerce/marketplace.
3. Ads lectura y atribucion.
4. Billing automatizado.
5. Omnicanal social adicional.

## 14. Roadmap de cierre

### FASE 26 - Control comercial de IA y planes

- Ledger inmutable, wallets, reservas/liquidacion y bloqueo antes de OpenAI.
- Planes, paquetes, limites tenant, alertas y panel de consumo.
- Alta manual de saldo y admin interno minimo.
- Migracion backfill sin afectar operaciones existentes.

**Motivo:** protege margen y permite medir costo real antes de sumar volumen o integraciones.

### FASE 27 - Cuenta, equipo y cumplimiento

- Recovery, invitaciones, roles granulares, ownership y baja.
- Terminos, privacidad, consentimiento, retencion, exportacion y borrado.
- Email transaccional configurable.

### FASE 28 - Operacion confiable

- Cola durable, retries, DLQ, leases y replay.
- Rate limiting distribuido.
- Observabilidad, alertas, backups y simulacro de restore.
- SSRF, headers, upload hardening y CI de seguridad.

### FASE 29 - Integraciones fundacionales

- OAuth framework, vault, estados y desconexion.
- Gmail + Calendar.
- Un proveedor ecommerce/marketplace elegido por mercado objetivo.

### FASE 30 - Billing

- Checkout, webhooks firmados e idempotentes.
- Facturas/recibos y conciliacion.
- Mercado Pago o Stripe conectado al ledger ya estable.

### FASE 31 - Ads y omnicanal

- Ads read-only, atribucion y sugerencias.
- Borradores con aprobacion humana.
- Canales sociales segun permisos y demanda comercial validada.

## 15. Oferta comercial recomendada hoy

### Producto vendible

“CRM conversacional con WhatsApp e IA, implementado y acompanado”:

- Un workspace por cliente.
- Un numero WhatsApp conectado con asistencia.
- Leads, contactos, Pipeline, Inbox y respuesta manual.
- Asistente IA con Base de Conocimiento.
- Modo borrador o auto-respuesta controlada.
- Smart Tags, Variables, automatizaciones acotadas y cotizaciones.
- Limite de uso acordado y controlado manualmente.
- Setup, capacitacion y soporte incluidos.

### Promesas que deben evitarse

- Alta 100% autoservicio de WhatsApp para cualquier cliente.
- Uso ilimitado de IA.
- Integraciones omnicanal o Ads que aun no existen.
- Facturacion automatica, creditos prepagos o SLA empresarial.
- Cumplimiento regulatorio universal.
- Automatizaciones “infalibles” sin supervision.

## 16. Checklist de salida a piloto

- [ ] Definir contrato, terminos, privacidad y politica de retencion.
- [ ] Definir limite manual de IA y revisar consumo diario por cliente.
- [ ] Corregir mojibake y ejecutar smoke visual desktop/mobile.
- [ ] Deshabilitar Custom Connect para clientes o aplicar allowlist SSRF antes del piloto.
- [ ] Probar backup y restauracion en staging.
- [ ] Crear playbook de incidentes y canal de soporte.
- [ ] Ejecutar E2E de dos tenants.
- [ ] Validar webhook WhatsApp, token, estados y numero de cada cliente.
- [ ] Confirmar asistentes, knowledge, reglas y autoenvio por conversacion.
- [ ] Definir responsable humano y mecanismo de pausa.
- [ ] Configurar monitoreo de errores y alertas basicas.
- [ ] Documentar limites del piloto y funciones no incluidas.

## 17. Conclusion

El producto tiene un nucleo valioso y demostrablemente conectado. La ruta mas corta a ingresos no es agregar Instagram, Ads o cinco ecommerce: es convertir el uso actual en una unidad controlable, cobrable y operable.

**Orden recomendado:** creditos IA y planes -> cuenta/equipo/legal -> confiabilidad y seguridad -> framework OAuth e integraciones -> billing automatico -> Ads/omnicanal.

Implementar facturacion antes del ledger obligaria a cobrar un producto cuyo costo no puede cortarse ni reconciliarse. Implementar integraciones antes del control comercial aumenta superficie, soporte y costo sin resolver el riesgo central. Por eso, **creditos IA debe ser la proxima fase**; inicialmente con facturacion manual, y luego Mercado Pago o Stripe sobre ese mismo ledger.

## 18. Validacion ejecutada

| Comando | Resultado |
|---|---|
| `npm run lint` | OK, sin warnings de ESLint |
| `npm run build` | OK, 43 paginas generadas |
| `npm run test` | OK, 57 archivos y 188 tests |
| `npm run validate` | OK, lint + build + tests repetidos correctamente |
| `npm run deploy:check` | OK, 12 checks aprobados, 2 advertencias locales, 0 fallos |

Advertencias no bloqueantes observadas:

- Next.js informa que `@supabase/supabase-js` usa `process.version` en el bundle de middleware Edge. El build termina correctamente, pero conviene vigilar compatibilidad en upgrades.
- El chequeo local no encontro `NEXT_PUBLIC_SUPABASE_ANON_KEY` y omitio probar la conexion Supabase. Esto describe el entorno local de auditoria, no confirma una ausencia en Vercel.
- Webpack aviso sobre serializacion de strings grandes en cache; es una consideracion de rendimiento de build, no un error de aplicacion.
