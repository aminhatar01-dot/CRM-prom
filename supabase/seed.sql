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

insert into public.leads (
  id,
  organization_id,
  title,
  first_name,
  last_name,
  email,
  phone,
  company,
  source,
  status,
  notes
)
values
  ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'Ana Torres', 'Ana', 'Torres', 'ana@example.com', '+5491100000001', 'Torres Propiedades', 'webchat', 'nuevo', 'Busca automatizar respuestas iniciales.'),
  ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'Bruno Diaz', 'Bruno', 'Diaz', 'bruno@example.com', '+5491100000002', 'Diaz Brokers', 'whatsapp', 'contactado', 'Pidio demo para su equipo.'),
  ('00000000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'Carla Ruiz', 'Carla', 'Ruiz', 'carla@example.com', '+5491100000003', 'Ruiz Studio', 'manual', 'interesado', 'Interesada en inbox omnicanal.'),
  ('00000000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', 'Diego Marin', 'Diego', 'Marin', 'diego@example.com', '+5491100000004', 'Marin Ventas', 'referido', 'propuesta', 'Enviar propuesta esta semana.'),
  ('00000000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 'Elena Paz', 'Elena', 'Paz', 'elena@example.com', '+5491100000005', 'Paz Real Estate', 'whatsapp', 'ganado', 'Cliente listo para onboarding.')
on conflict (id) do nothing;

insert into public.contacts (
  id,
  organization_id,
  full_name,
  first_name,
  last_name,
  email,
  phone,
  company,
  location,
  notes
)
values
  ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', 'Felipe Norte', 'Felipe', 'Norte', 'felipe@example.com', '+5491100000011', 'Norte CRM', 'Buenos Aires', 'Contacto activo.'),
  ('00000000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', 'Gabriela Sur', 'Gabriela', 'Sur', 'gabriela@example.com', '+5491100000012', 'Sur Leads', 'Cordoba', 'Prefiere WhatsApp.'),
  ('00000000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000001', 'Hector Rio', 'Hector', 'Rio', 'hector@example.com', '+5491100000013', 'Rio Growth', 'Rosario', 'Cliente de prueba.')
on conflict (id) do nothing;

insert into public.conversations (
  id,
  organization_id,
  lead_id,
  contact_id,
  channel,
  status,
  ai_status,
  last_message_at
)
values
  ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000101', null, 'webchat', 'abierta', 'active', now() - interval '50 minutes'),
  ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000102', null, 'whatsapp', 'pendiente', 'human', now() - interval '40 minutes'),
  ('00000000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000001', null, '00000000-0000-4000-8000-000000000201', 'manual', 'abierta', 'paused', now() - interval '30 minutes'),
  ('00000000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000001', null, '00000000-0000-4000-8000-000000000202', 'whatsapp', 'cerrada', 'human', now() - interval '20 minutes'),
  ('00000000-0000-4000-8000-000000000305', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000103', null, 'manual', 'abierta', 'active', now() - interval '10 minutes')
on conflict (id) do nothing;

insert into public.messages (
  organization_id,
  conversation_id,
  direction,
  sender_type,
  body,
  channel,
  status,
  metadata,
  created_at
)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000301', 'inbound', 'contact', 'Hola, quiero conocer el CRM.', 'webchat', 'read', '{}', now() - interval '55 minutes'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000301', 'outbound', 'user', 'Claro, te puedo ayudar. Cuantos agentes tiene tu equipo?', 'webchat', 'sent', '{}', now() - interval '50 minutes'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000302', 'inbound', 'contact', 'Me pasas una demo por WhatsApp?', 'whatsapp', 'delivered', '{}', now() - interval '40 minutes'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000303', 'outbound', 'user', 'Retomo la conversacion y dejo IA pausada.', 'manual', 'sent', '{}', now() - interval '30 minutes'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000304', 'inbound', 'contact', 'Gracias, lo revisamos luego.', 'whatsapp', 'read', '{}', now() - interval '20 minutes'),
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000305', 'inbound', 'contact', 'Necesito integrar mis leads.', 'manual', 'pending', '{}', now() - interval '10 minutes');
