# Configuración Supabase

Project Ref: `widehqbtmqiebaowidav`

URL: `https://widehqbtmqiebaowidav.supabase.co`

## Migraciones

Aplicar las migraciones desde la raíz:

```bash
supabase link --project-ref widehqbtmqiebaowidav
supabase db push
```

## Auth

En Supabase Auth configurar las URLs permitidas:

- `http://localhost:3000/auth/callback`
- `https://crm-prom.vercel.app/auth/callback`

En Supabase Dashboard > Authentication > URL Configuration:

- Site URL: `https://crm-prom.vercel.app`
- Redirect URLs:
  - `https://crm-prom.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback`

En Vercel configurar:

```bash
NEXT_PUBLIC_APP_URL=https://crm-prom.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://widehqbtmqiebaowidav.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-o-publishable-key>
```

El magic link debe abrirse en el mismo navegador donde se solicito para conservar el verificador PKCE. Si el enlace expiro o ya fue usado, solicitar uno nuevo y esperar al menos 60 segundos antes de repetir.

## Login con contrasena

La pantalla `/login` tambien usa `supabase.auth.signInWithPassword`.

En Supabase Dashboard:

1. Abrir Authentication > Providers > Email.
2. Mantener Email habilitado.
3. Crear un usuario de prueba desde Authentication > Users con email y contrasena, o asignar una contrasena mediante un flujo de recuperacion.
4. Confirmar el email si el proyecto exige confirmacion.

Los usuarios creados solamente mediante magic link no reciben una contrasena automaticamente.

## RLS

Todas las tablas operativas tienen RLS activado. El patrón usado es:

- `select`: permitido a miembros de la organización.
- `insert/update/delete`: permitido a miembros o administradores según sensibilidad.
- `ai_assistants`, `automation_*`, `external_tools` y configuración de pipeline:
  escritura restringida a `owner` o `admin`.

## Storage

La migración crea el bucket privado `crm-pro-ai-assets`. Las políticas específicas de
archivos por carpeta de organización se implementarán cuando se construyan cargas de
archivos en una fase posterior.
