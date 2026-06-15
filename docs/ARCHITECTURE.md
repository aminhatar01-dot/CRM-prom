# Arquitectura

CRM PRO AI es un SaaS multi tenant en monorepo.

## Capas

- `apps/web`: Next.js 15 App Router, Supabase SSR, Server Actions y UI Tailwind.
- `packages/ui`: componentes shadcn/ui locales.
- `packages/database`: schemas Zod y contratos de validacion.
- `packages/types`: tipos compartidos.
- `packages/ai`, `packages/integrations`, `packages/automation`: contratos para fases siguientes.
- `supabase`: migraciones, RLS, Realtime y seeds.

## Seguridad multi tenant

Todas las entidades operativas incluyen `organization_id`. Las consultas de UI tambien filtran por organizacion, pero la garantia real esta en RLS:

- `is_org_member(organization_id)` para lectura/escritura operativa.
- `is_org_admin(organization_id)` para configuracion sensible.
- No se usa service role key en frontend.

## FASE 2

La fase 2 agrega el nucleo conversacional:

- CRM Core: leads y contactos.
- Inbox: conversaciones y mensajes.
- Realtime: refresco de UI ante cambios en `conversations`, `messages` y `leads`.
- Server Actions: validan con Zod y escriben usando la sesion del usuario.

WhatsApp real e IA real quedan preparados, pero no implementados en esta fase.
