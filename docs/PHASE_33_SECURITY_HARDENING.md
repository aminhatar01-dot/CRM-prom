# FASE 33 — Security Hardening para v1.0

**Fecha:** 2026-06-30  
**Rama:** `feature/phase-26-ai-credits`  
**Tests:** 592 pasando (65 archivos)  
**Build:** ✅ OK | Deploy check: 12 PASS, 2 WARN, 0 FAIL

---

## Objetivo

Resolver los riesgos P0/P1 de seguridad detectados en la FASE 32 antes de exponer el producto al público. Esta fase no agrega funciones comerciales — endurece la postura de seguridad del sistema existente.

---

## 1. Protección SSRF (Server-Side Request Forgery)

### Problema anterior

`CustomConnectExecutor` aceptaba cualquier URL y ejecutaba `fetch` server-side sin validación. Un atacante podía configurar un tool con `url: "http://169.254.169.254/latest/meta-data/"` y extraer credenciales de infraestructura cloud (AWS IMDS, GCP metadata, Azure IMDS).

`import-service.ts` tenía protección básica pero incompleta: faltaban CGNAT, IPv4-mapped IPv6, rango `0.0.0.0/8`, y cloud metadata IPs explícitas.

### Solución implementada

#### `packages/integrations/src/ssrf-guard.ts` (nuevo)

Guard SSRF centralizado con las siguientes protecciones:

| Bloqueo | Rango/Valor | Motivo |
|---|---|---|
| Loopback IPv4 | `127.0.0.0/8` | Procesos locales |
| Loopback IPv6 | `::1`, `0:0:0:0:0:0:0:1` | Procesos locales |
| Unspecified | `0.0.0.0/8`, `::` | Interfaces no específicas |
| RFC1918 | `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` | Redes privadas |
| Link-local + IMDS | `169.254.0.0/16` | Cloud metadata (AWS/GCP/Azure) |
| CGNAT | `100.64.0.0/10` | Carrier-Grade NAT |
| ULA IPv6 | `fc00::/7` | Redes privadas IPv6 |
| Link-local IPv6 | `fe80::/10` | Link-local IPv6 |
| IPv4-mapped IPv6 | `::ffff:x.x.x.x` con IP privada | Bypass de filtros IPv4 |
| Cloud metadata explícita | `169.254.169.254`, `100.100.100.200` | AWS/Azure, Alibaba Cloud |
| Protocolos bloqueados | `file:`, `ftp:`, `gopher:`, `data:`, `javascript:`, `vbscript:` | Protocolos no HTTP |
| Credenciales en URL | `user:pass@host` | Credential injection |

La función `assertSafeUrl(url)` resuelve DNS y valida **todas** las IPs devueltas (A + AAAA), no solo una. Esto bloquea ataques de DNS rebinding.

#### `packages/integrations/src/custom-connect-executor.ts` (modificado)

- Llama `assertSafeUrl(tool.url)` antes de cualquier llamada `fetch`.
- Usa `redirect: "manual"` para no seguir redirects automáticamente.
- Valida el `Location` header de redirects con `assertSafeUrl` antes de permitirlos.
- Limita la respuesta a `MAX_SSRF_RESPONSE_BYTES` (10 MB).

#### `apps/web/src/lib/knowledge/import-service.ts` (reforzado)

- `isPrivateAddress()` ampliada con CGNAT, IPv4-mapped IPv6, cloud metadata IPs explícitas, y rango `0.0.0.0/8`.
- `assertPublicUrl()` corregida: maneja NXDOMAIN con mensaje de error claro, verifica que `addresses.length > 0`.
- Añadida validación de null bytes y path separators en nombres de archivo.
- Nueva función `sanitizeFileName()` exportada para uso en acciones de upload.

### Tests SSRF

`packages/integrations/src/ssrf-guard.test.ts` — 20 tests nuevos:

- Todos los rangos privados bloqueados
- DNS rebinding bloqueado (hostname resuelve a IP privada)
- IPv4-mapped IPv6 para IPs privadas bloqueado
- Protocolos no HTTP bloqueados
- Credenciales en URL bloqueadas
- NXDOMAIN manejado
- URL pública permitida
- Verifica que `assertSafeUrl` retorna el URL parseado en caso exitoso

---

## 2. Fix Mercado Pago — Verificación de firma

### Problema anterior

`verifyMercadoPagoSignature` en `providers.ts` usaba `Date.now()` para construir el manifest de verificación. Esto nunca coincidía con el timestamp del header `x-signature` de Mercado Pago, haciendo que **toda verificación de firma MP fallara en producción**.

### Solución

El header `x-signature` de MP tiene formato: `ts=1699994916,v1=<hex>`

El manifest se construye según la documentación oficial de MP:
```
id:{data.id};request-id:{x-request-id};ts:{ts};
```

Cambios:
1. Parsear `ts` y `v1` del header `x-signature` (no usar `Date.now()`).
2. Parsear `data.id` del body JSON del request (no usar `xRequestId`).
3. Comparación exacta `expectedHex === v1` (antes usaba `.includes()` que es vulnerable a falsos positivos).

---

## 3. Headers de Seguridad HTTP

### `apps/web/next.config.ts` (modificado)

Headers aplicados a **todas** las rutas:

| Header | Valor | Propósito |
|---|---|---|
| `X-Content-Type-Options` | `nosniff` | Bloquea MIME-type sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limita info del referrer a terceros |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Restringe acceso a hardware sensible |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Fuerza HTTPS por 1 año |
| `Content-Security-Policy` | Ver abajo | Restringe origen de recursos |
| `X-Frame-Options` | `SAMEORIGIN` | Bloquea clickjacking (rutas no-API) |

**CSP configurada:**
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://connect.facebook.net;
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https:;
font-src 'self' data:;
connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.openai.com https://graph.facebook.com https://api.mercadopago.com;
frame-src 'self' https://www.facebook.com;
frame-ancestors 'self';
```

**Nota sobre webchat:** `X-Frame-Options: SAMEORIGIN` no se aplica a las rutas `/api/webchat/*` ni `/widget/*` para no interferir con el embedding del widget en sitios de clientes.

`unsafe-inline` y `unsafe-eval` en `script-src` son necesarios para Next.js 15 sin nonces. Una mejora futura (post-v1.0) es implementar CSP con nonces via middleware.

---

## 4. Rate Limiting Distribuido para Integraciones

### Problema anterior

`apps/web/src/lib/integrations/rate-limit.ts` usaba un `Map` en memoria del proceso Node.js. En Vercel con múltiples instancias serverless, cada instancia tenía su propio contador — el rate limit era efectivamente inoperante con escala.

### Solución

`apps/web/src/lib/integrations/executor.ts` ahora usa `checkDistributedRateLimit` de FASE 28:
- Usa `rate_limit_buckets` en PostgreSQL via `check_rate_limit` RPC.
- Límite: 60 calls/minuto por organización (bucket `integration_tools`).
- Persiste entre instancias serverless.
- El mock de tests añade stub de `rpc` que devuelve `true`.

El módulo `rate-limit.ts` antiguo permanece para uso en tests y otros contextos.

---

## 5. Upload Security

### `apps/web/src/lib/security/upload-guard.ts` (nuevo)

Guard centralizado para validación de uploads con tres tipos de configuración:

| Tipo | Max size | Extensiones | MIME types |
|---|---|---|---|
| `image` | 5 MB | jpg, jpeg, png, gif, webp | image/jpeg, image/png, image/gif, image/webp |
| `document` | 20 MB | pdf, docx, xlsx, txt, csv | PDF, Office, text |
| `knowledge` | 10 MB | pdf, docx, xlsx, txt, csv | PDF, Office, text, CSV |

**Extensiones bloqueadas explícitamente:** `.exe`, `.bat`, `.cmd`, `.sh`, `.bash`, `.zsh`, `.ps1`, `.psm1`, `.psd1`, `.com`, `.scr`, `.vbs`, `.vbe`, `.js`, `.jse`, `.wsf`, `.wsh`, `.msi`, `.msp`, `.jar`, `.py`, `.rb`, `.pl`, `.php`, `.asp`, `.aspx`, `.cgi`, `.dmg`, `.app`, `.deb`, `.rpm`, `.apk`.

**`sanitizeFileName(name)`:** elimina path separators (`/`, `\`), null bytes (`\0`), y caracteres peligrosos en Windows (`:`, `*`, `?`, `"`, `<`, `>`, `|`). Limita a 200 caracteres.

**Nota sobre antivirus:** No se implementó antivirus externo en esta fase (requeriría un proveedor externo como VirusTotal o ClamAV). La interfaz está preparada para añadir un paso de escaneo antes de `processKnowledgeImport` en una fase futura.

---

## 6. Retención de PII — Base inicial

### `apps/web/src/app/actions/privacy.ts` (nuevo)

Acciones server-side para cumplimiento básico de privacidad:

| Acción | Descripción |
|---|---|
| `exportOrgData()` | Retorna JSON con todos los datos de la org: leads, contactos, conversaciones, conocimiento, asistentes, automatizaciones, tags, variables. Registra en `event_logs`. |
| `requestDataDeletion(reason?)` | Registra solicitud de eliminación en `event_logs` con severidad `warning`. Un admin o job futuro procesa la eliminación real. |
| `anonymizeContact(contactId)` | Borra PII de un contacto específico: pone nombre a `[eliminado]`, borra email, teléfono y notas. Registra en `event_logs`. |

**Seguridad:**
- Todas las acciones requieren usuario autenticado vía `requireUser()`.
- Todas las queries filtran por `organization_id` del usuario activo.
- Todas las operaciones de admin usan `createAdminClient()`.
- Todos los eventos se registran en `event_logs` via `logEvent()`.

**Pendiente para FASE 35 (Legal completo):**
- Tabla `data_deletion_requests` para trazabilidad de solicitudes.
- Cron job que procesa solicitudes pendientes (anonimización completa).
- Exportación de datos en formato ZIP/PDF.
- Política de retención configurable por organización.
- Aceptación versionada de términos de servicio.

---

## 7. Seguridad de Webhooks — Estado actual

Los webhooks existentes ya tenían controles adecuados, verificados en esta auditoría:

| Endpoint | Firma | Idempotencia | Rate limit | Log sin secretos |
|---|---|---|---|---|
| `/api/webhooks/whatsapp` | ✅ HMAC-SHA256 (`x-hub-signature-256`) | ✅ DB dedup | ✅ Por org | ✅ |
| `/api/webhooks/billing/stripe` | ✅ HMAC-SHA256 (`stripe-signature`) | ✅ `external_id` único | ✅ por IP/org | ✅ |
| `/api/webhooks/billing/mercado-pago` | ✅ HMAC-SHA256 (fix aplicado esta fase) | ✅ `external_id` único | ✅ | ✅ |
| `/api/integrations/google/callback` | ✅ CSRF via `oauth_states` (PKCE + nonce) | N/A | N/A | ✅ |
| `/api/cron/*` | ✅ `CRON_SECRET` en `Authorization` | N/A | N/A | ✅ |

---

## 8. Archivos modificados / creados

| Archivo | Acción | Descripción |
|---|---|---|
| `packages/integrations/src/ssrf-guard.ts` | Nuevo | Guard SSRF centralizado |
| `packages/integrations/src/ssrf-guard.test.ts` | Nuevo | 20 tests SSRF |
| `packages/integrations/src/custom-connect-executor.ts` | Modificado | SSRF guard + redirect validation |
| `apps/web/src/lib/knowledge/import-service.ts` | Modificado | SSRF reforzado + sanitización de filename |
| `apps/web/src/lib/billing/providers.ts` | Modificado | Fix MP signature verification |
| `apps/web/next.config.ts` | Modificado | Security headers HTTP |
| `apps/web/src/lib/integrations/executor.ts` | Modificado | Rate limit distribuido |
| `apps/web/src/lib/integrations/executor.test.ts` | Modificado | Stub de rpc para tests |
| `apps/web/src/lib/security/upload-guard.ts` | Nuevo | Upload validation centralizado |
| `apps/web/src/app/actions/privacy.ts` | Nuevo | Acciones de privacidad y PII |
| `packages/database/src/phase33-contract.test.ts` | Nuevo | 32 contract tests de seguridad |
| `docs/PHASE_33_SECURITY_HARDENING.md` | Nuevo | Esta documentación |

---

## 9. Pendientes de fases futuras

### FASE 35 — Legal completo
- Páginas `/terms` y `/privacy`.
- Checkbox de aceptación de términos en registro.
- Tabla `data_deletion_requests` y workflow completo de LGPD/GDPR.
- Cron de limpieza de `event_logs` > 90 días.

### Post-v1.0
- CSP con nonces via middleware Next.js (eliminar `unsafe-inline`).
- Antivirus en uploads (integración con ClamAV o VirusTotal API).
- Escaneo de dependencias en CI (`npm audit` como gate).
- E2E adversarial de dos tenants intentando acceso cruzado.
- Penetration test formal antes de escalar a >100 clientes.
- Rotación documentada de tokens OAuth (Google).

---

## 10. Validaciones ejecutadas

| Comando | Resultado |
|---|---|
| `npm run lint` | ✅ 0 errores, 0 warnings |
| `npm run build` | ✅ OK — 46+ páginas generadas |
| `npm run test` | ✅ 592 tests, 65 archivos, 0 fallos |
| `npm run deploy:check` | ✅ 12 PASS, 2 WARN (env locales), 0 FAIL |

---

## 11. No se rompió

| Módulo | Estado |
|---|---|
| WhatsApp webhook + envío | ✅ Sin cambios |
| Inbox / Realtime | ✅ Sin cambios |
| IA / Asistentes / RAG | ✅ Sin cambios |
| Importaciones de conocimiento | ✅ SSRF reforzado — funcionalidad preservada |
| Google OAuth + tools | ✅ Sin cambios |
| Créditos IA / Ledger | ✅ Sin cambios |
| Billing (manual + webhooks) | ✅ MP signature corregida |
| Panel admin | ✅ Sin cambios |
| Job queue | ✅ Sin cambios |
| Integration Hub | ✅ Rate limit migrado, Custom Connect protegido |
| WebChat widget embed | ✅ `X-Frame-Options` excluido de rutas webchat/widget |
