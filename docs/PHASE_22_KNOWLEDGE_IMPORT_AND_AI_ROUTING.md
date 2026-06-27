# FASE 22 - Knowledge Import y Routing Inteligente

## Fuentes soportadas

- CSV
- Excel XLSX
- PDF
- Word DOCX
- TXT
- Google Sheets con enlace publico
- URL HTTP/HTTPS publica
- Texto manual existente

Los archivos admiten hasta 10 MB. Se validan extension y MIME; macros y ejecutables no estan permitidos. Los originales quedan en el bucket privado `knowledge-imports`. Las URLs se validan contra redes locales/privadas y tienen timeout, limite de redirecciones y limite de contenido.

## Importar una lista de precios

1. Abrir **Base de conocimiento > Importar conocimiento**.
2. Elegir CSV o Excel XLSX y seleccionar el archivo.
3. Indicar nombre y categoria, por ejemplo `catalogo`.
4. Dejar el mapeo vacio para detectar automaticamente producto, servicio, precio, stock, categoria, descripcion, codigo, SKU, moneda y disponibilidad.
5. Si un encabezado es propio, escribir su nombre exacto en el mapeo correspondiente.
6. Importar. La fuente mostrara estado, errores, documentos y chunks.

Reindexar vuelve a leer el archivo original almacenado. La version anterior permanece activa hasta que la nueva version fue extraida e indexada correctamente.

## Google Sheets

La hoja debe ser visible mediante enlace publico. Copiar la URL completa en **Google Sheets publico**. El sistema obtiene el CSV oficial de la hoja y aplica la misma deteccion/mapeo de catalogos. No requiere OAuth para este MVP.

## PDF, Word, TXT y URL

- PDF: extrae texto por pagina.
- DOCX: extrae texto del documento sin macros.
- TXT: normaliza texto UTF-8.
- URL: elimina scripts, estilos, navegacion y pie antes de indexar el contenido principal.

Todo el texto reutiliza el chunking, embeddings y busqueda semantica existentes.

## Varios asistentes

En **Asistentes > Configuracion del Agente**, cada asistente define:

- canal;
- intencion principal;
- temas atendidos;
- temas excluidos;
- categorias de conocimiento prioritarias;
- prioridad de routing de 0 a 100;
- si es el asistente por defecto;
- tono, reglas, auto respuesta y escalamiento ya existentes.

Solo puede quedar un asistente por defecto por organizacion cuando se guarda desde la UI.

## Router

El router se ejecuta antes de generar una respuesta cuando la automatizacion usa `auto_route=true` o Inbox no recibe un asistente explicito. Puntua:

1. compatibilidad de canal;
2. intencion funcional detectada;
3. coincidencia con temas configurados;
4. temas excluidos;
5. categorias de conocimiento relevantes;
6. ultimo asistente exitoso de la conversacion;
7. prioridad y asistente por defecto.

Un `assistant_id` explicito sigue funcionando como override. La decision queda en `ai_logs.metadata.assistant_routing` y en el draft de automatizacion.

## Pruebas multi-rubro

- **Ferreteria:** configurar temas `tornillos`, `herramientas`, `stock`, `precios`; importar catalogo y preguntar precio/stock.
- **Automoviles:** configurar modelos, financiacion y prueba de manejo; importar catalogo XLSX.
- **Gimnasio:** separar ventas de membresias y soporte de socios.
- **Ecommerce:** separar cotizaciones, soporte, cobranzas y postventa.

Verificar en logs que `assistant_routing.assistantId` corresponda al asistente esperado. Cambiar de un tema de ventas a un reclamo debe seleccionar soporte si sus temas estan configurados.

## Seguridad

- Todas las fuentes incluyen `organization_id` y RLS.
- Un trigger impide relacionar documentos con imports de otra organizacion.
- Los embeddings permanecen accesibles solo por service role.
- Storage es privado y las operaciones se ejecutan server-side.
- No se modificaron webhook, Graph API, tokens ni recepcion WhatsApp.
