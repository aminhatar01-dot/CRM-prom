# WebChat

FASE 8 agrega un widget embebible para conectar sitios externos con CRM PRO AI.

## Script publico

```html
<script
  src="https://tu-app.vercel.app/widget/crm-pro-ai-widget.js"
  data-widget-token="wchat_xxx"
  async
></script>
```

En local se puede usar:

```html
<script
  src="http://localhost:3000/widget/crm-pro-ai-widget.js"
  data-widget-token="wchat_demo_local_token_00000000000000000001"
  async
></script>
```

## Endpoints publicos

- `POST /api/webchat/start`
- `POST /api/webchat/message`
- `GET /api/webchat/history`

Todos requieren `token` del widget. Los endpoints validan dominio permitido, rate limit basico y widget activo.

## Persistencia

El WebChat crea o actualiza:

- `leads` cuando no existe contacto conocido.
- `contacts` cuando existe contacto por email o telefono.
- `conversations` con `channel='webchat'`.
- `messages` entrantes y salientes.

El mensaje inicial del widget se guarda como mensaje saliente de tipo `system`.

## Configuracion

Panel:

```text
Settings > Channels > WebChat
```

Campos:

- nombre del widget
- token publico
- color principal
- mensaje inicial
- posicion
- activo/inactivo
- dominios permitidos
- asistente asociado

## Seguridad

- `webchat_widgets.public_token` identifica el widget publico.
- `allowed_domains` bloquea origenes no autorizados.
- `SUPABASE_SERVICE_ROLE_KEY` se usa solo en Route Handlers server-side.
- RLS permanece activo para tablas privadas.
- `webchat_widget_id` en conversaciones permite validar ownership del historial.
- No hay respuestas automaticas de IA en esta fase.
