-- Development seed. Replace the UUIDs after creating local Supabase auth users.
-- RLS remains enabled; run seeds locally with service role context.

insert into public.organizations (id, name, slug)
values ('00000000-0000-4000-8000-000000000001', 'Demo CRM PRO AI', 'demo-crm-pro-ai')
on conflict (id) do nothing;

insert into public.pipelines (id, organization_id, name)
values (
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000001',
  'Pipeline Comercial'
)
on conflict (id) do nothing;

insert into public.pipeline_stages (organization_id, pipeline_id, name, position)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 'Nuevo', 1),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 'Calificado', 2),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 'Ganado', 3)
on conflict do nothing;

insert into public.tags (organization_id, name, color, is_ai_generated)
values
  ('00000000-0000-4000-8000-000000000001', 'Alta intención', '#0f766e', true),
  ('00000000-0000-4000-8000-000000000001', 'Presupuesto pendiente', '#b45309', true)
on conflict do nothing;
