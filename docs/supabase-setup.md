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
- `https://<tu-dominio-vercel>/auth/callback`

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
