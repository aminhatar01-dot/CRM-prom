# Arquitectura técnica

CRM PRO AI usa un monorepo npm con una aplicación principal y paquetes de dominio.

## Estructura

- `apps/web`: Next.js 15 App Router, Supabase SSR, Tailwind y shadcn/ui local.
- `packages/ui`: componentes base reutilizables.
- `packages/types`: tipos compartidos del dominio.
- `packages/database`: validaciones y contratos de persistencia.
- `packages/ai`: contratos para asistentes configurables.
- `packages/integrations`: contratos para herramientas externas.
- `packages/automation`: contratos para reglas y acciones.
- `supabase`: configuración, migraciones y seeds.

## Multi tenant

La frontera tenant se modela con `organizations` y `organization_members`.
Todas las tablas operativas del CRM tienen `organization_id` obligatorio y políticas
RLS basadas en `auth.uid()`.

Las funciones SQL `is_org_member` e `is_org_admin` centralizan la autorización. La UI
no debe confiar en filtros de cliente como mecanismo de seguridad; los filtros mejoran
la ergonomía, pero RLS es la garantía.

## FASE 1

La primera fase entrega:

- Login con Supabase Auth mediante magic link.
- Creación de organización inicial.
- Dashboard protegido por sesión.
- Métricas iniciales por organización.
- Tablas base para CRM, inbox, IA, tags, automatizaciones e integraciones.

## Variables de entorno

Usar `apps/web/.env.example` como referencia. Los secrets no se versionan y deben
configurarse en Vercel y Supabase.

## Deploy

En Vercel Free:

- Framework: Next.js.
- Root Directory: raiz del repositorio (`.`).
- Install Command: `npm install`.
- Build Command: `npm run build --workspace @crm-pro-ai/web`.
- Output Directory: `apps/web/.next`.
- Configuracion versionada en `vercel.json`.

Configurar:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL`
- `OPENAI_API_KEY`
