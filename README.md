# CRM PRO AI

SaaS CRM multi tenant construido con Next.js 15, Supabase y OpenAI.

## FASE 1

- Monorepo con `apps/web` y paquetes compartidos.
- Supabase Auth con SSR.
- Organizaciones y membresias multi tenant.
- Dashboard inicial protegido.
- Migraciones SQL con RLS para la base del CRM.

## FASE 2

- Leads: listado, creacion, edicion, detalle, estado, responsable, busqueda y filtros.
- Contactos: CRUD base, detalle y conversion desde lead.
- Conversaciones: asociadas a lead/contacto, canal, estado, responsable y estado IA.
- Mensajes: historial por conversacion y envio manual.
- Inbox base tipo WhatsApp Web con filtros y Supabase Realtime.
- Seeds demo para CRM conversacional.

## Validacion

```bash
npm run lint
npm run build
npm run test
```

Consulta [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATABASE.md](docs/DATABASE.md), [docs/ROADMAP.md](docs/ROADMAP.md), [docs/PHASE_2_VALIDATION.md](docs/PHASE_2_VALIDATION.md) y [docs/supabase-setup.md](docs/supabase-setup.md).
