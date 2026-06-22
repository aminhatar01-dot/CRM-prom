# FASE 19 - Base de conocimiento y RAG por organizacion

Fecha: 2026-06-22

## Objetivo

Cada organizacion puede administrar documentos internos y usarlos como evidencia
para las sugerencias del `AIOrchestrator`. El flujo es RAG: indexacion previa,
recuperacion semantica por consulta y generacion con fuentes internas.

No existe envio automatico nuevo. Inbox sigue exigiendo revision humana.

## Flujo

1. Un owner o admin crea un documento en `/knowledge`.
2. El servidor divide el contenido en chunks solapados.
3. `OpenAIEmbeddingClient` genera embeddings de 1536 dimensiones.
4. Los chunks y vectores se guardan en Supabase con `organization_id`.
5. Al sugerir una respuesta, se construye una consulta con:
   - entrada del operador;
   - ultimos mensajes inbound;
   - empresa y notas del lead/contacto.
6. `match_knowledge_chunks` recupera hasta cinco chunks del tenant.
7. El `AIOrchestrator` recibe contenido, titulo, categoria y similitud.
8. Inbox y las pruebas del asistente muestran las fuentes internas usadas.

OpenAI documenta `text-embedding-3-small` con vectores de 1536 dimensiones y
recomienda similitud coseno para busqueda. Referencias:

- https://developers.openai.com/api/docs/guides/embeddings
- https://developers.openai.com/api/reference/resources/embeddings/methods/create/

## Modelo de datos

### `knowledge_documents`

- `organization_id`
- `title`
- `content`
- `category`
- `active`
- `source_type`: `manual`, `pdf`, `docx`, `txt`
- `source_file_name` y `storage_path`, reservados para carga futura
- `indexing_status`: `pending`, `indexing`, `indexed`, `failed`
- `indexing_error`
- `content_hash`
- `chunk_count`
- `embedding_model`
- `indexed_at`
- `archived_at`

### `knowledge_chunks`

- `organization_id`
- `document_id`
- `chunk_index`
- `content`
- `token_estimate`
- `metadata`
- `embedding vector(1536)`

La integridad tenant usa una funcion trigger exclusiva de esta tabla. No se
comparte una funcion generica que lea columnas inexistentes.

## Seguridad

- `knowledge_documents` tiene RLS de lectura para miembros y escritura para
  owner/admin.
- `knowledge_chunks` no concede permisos a `anon` ni `authenticated`.
- Los embeddings no se consultan desde componentes cliente.
- La busqueda se ejecuta por `match_knowledge_chunks`, `security definer`,
  concedida solo a `service_role`.
- El RPC siempre filtra `chunk.organization_id = p_organization_id`.
- Documentos inactivos, archivados o no indexados nunca se recuperan.
- La service role permanece en `apps/web/src/lib/supabase/admin.ts`, solo
  server-side.

## Anti-alucinacion

El prompt del orquestador establece:

- usar exclusivamente la base interna para datos propios del negocio;
- no inventar productos, precios, politicas, horarios ni disponibilidad;
- expresar incertidumbre y proponer validacion humana cuando no haya evidencia;
- no mostrar IDs internos ni scores al cliente.

La interfaz muestra un aviso interno cuando la recuperacion no devuelve
informacion suficiente.

## UI

`/knowledge` permite:

- listar documentos;
- crear contenido manual;
- editar y reindexar;
- activar o desactivar su uso por IA;
- archivar;
- revisar chunks, modelo, fecha, error y estado de indexacion.

Los archivos PDF, DOCX y TXT no se cargan todavia. El esquema ya contiene
`source_type`, `source_file_name` y `storage_path` para incorporarlos sin
redisenar las tablas.

## Variables

```env
OPENAI_API_KEY=
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
AI_DEMO_MODE=true
SUPABASE_SERVICE_ROLE_KEY=
```

`OPENAI_EMBEDDING_MODEL` es opcional porque tiene el default
`text-embedding-3-small`. En produccion real, `AI_DEMO_MODE=false` reutiliza la
misma `OPENAI_API_KEY` ya configurada.

El modo demo genera vectores deterministas locales para desarrollo y smoke, sin
contactar OpenAI.

## Migracion

```text
supabase/migrations/20260622213000_phase_19_knowledge_base_rag.sql
```

La migracion crea la extension `vector`, tablas, indices HNSW, RLS, grants,
trigger de integridad y RPC de busqueda.

Fue aplicada al proyecto Supabase remoto enlazado sin reset.

## Pruebas

- chunking, solapamiento e indices estables;
- validacion Zod del documento;
- embeddings demo deterministas;
- endpoint OpenAI mockeado;
- similitud coseno;
- fuentes RAG en `AIOrchestrator`;
- respuesta marcada sin evidencia;
- contrato RLS y aislamiento multi tenant;
- acceso directo a chunks bloqueado;
- smoke remoto con documento y vector temporales, busqueda y limpieza.

Smoke remoto:

```powershell
$env:NODE_TLS_REJECT_UNAUTHORIZED='0' # solo si este equipo presenta el error TLS local conocido
npm run qa:knowledge:remote
```

En un entorno sin el problema de certificados, ejecutar solo
`npm run qa:knowledge:remote`.

## Operacion

1. Abrir `Base de conocimiento`.
2. Crear un documento con al menos 20 caracteres.
3. Confirmar estado `indexed`.
4. Abrir una conversacion relacionada con el contenido.
5. Usar `Sugerir respuesta con IA`.
6. Revisar el borrador y las fuentes internas.
7. Aprobar manualmente solo si el contenido es correcto.

## Pendiente

- parser y carga de PDF, DOCX y TXT mediante Supabase Storage;
- reindexacion asincrona para documentos muy grandes;
- administracion de versiones;
- metricas de precision y feedback sobre resultados;
- filtros avanzados por categoria o asistente.

