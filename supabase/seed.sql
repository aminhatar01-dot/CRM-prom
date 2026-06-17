-- Development seed. Replace the UUIDs after creating local Supabase auth users.
-- RLS remains enabled; run seeds locally with service role context.

insert into public.organizations (id, name, slug)
values ('00000000-0000-4000-8000-000000000001', 'Demo CRM PRO AI', 'demo-crm-pro-ai')
on conflict (id) do nothing;

insert into public.automation_rules (
  id,
  organization_id,
  name,
  description,
  trigger_type,
  status,
  enabled,
  trigger_config,
  conditions
)
values
  (
    '00000000-0000-4000-8000-000000000701',
    '00000000-0000-4000-8000-000000000001',
    'Seguimiento demo para nuevos leads',
    'Crea una tarea interna cuando un lead nuevo requiera seguimiento.',
    'lead_created',
    'draft',
    false,
    '{}',
    '{"lead_status":"nuevo"}'
  ),
  (
    '00000000-0000-4000-8000-000000000702',
    '00000000-0000-4000-8000-000000000001',
    'Pausar IA por tag sensible',
    'Ejemplo de automatizacion manual que pausa IA y notifica al equipo.',
    'manual',
    'draft',
    false,
    '{}',
    '{}'
  )
on conflict (id) do nothing;

insert into public.automation_actions (
  organization_id,
  rule_id,
  action_type,
  config,
  enabled,
  position
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000701',
    'create_task',
    '{"title":"Contactar nuevo lead","description":"Revisar datos del lead y responder manualmente."}',
    true,
    1
  ),
  (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000702',
    'pause_ai',
    '{}',
    true,
    1
  )
on conflict do nothing;

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

update public.tags
set
  description = 'Lead con señales claras de compra o avance comercial.',
  classification_prompt = 'Clasificar cuando el cliente pide demo, precios, propuesta o quiere avanzar.',
  active = true,
  auto_pause_assistant = false,
  notify_team = true
where organization_id = '00000000-0000-4000-8000-000000000001'
  and name = 'Alta intención';

update public.tags
set
  description = 'Conversacion donde falta confirmar presupuesto.',
  classification_prompt = 'Clasificar cuando el cliente menciona presupuesto, precio, costo o financiacion.',
  active = true,
  auto_pause_assistant = true,
  notify_team = false
where organization_id = '00000000-0000-4000-8000-000000000001'
  and name = 'Presupuesto pendiente';

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

insert into public.whatsapp_channel_settings (
  organization_id,
  phone_number_id,
  business_account_id,
  display_phone_number,
  webhook_verify_token_hint,
  enabled
)
values (
  '00000000-0000-4000-8000-000000000001',
  'demo-phone-number-id',
  'demo-business-account-id',
  '+54 9 11 0000-0000',
  'demo-token-hint',
  false
)
on conflict (organization_id, phone_number_id) do nothing;

insert into public.ai_assistants (
  id,
  organization_id,
  name,
  description,
  prompt,
  objective,
  tone,
  rules,
  fallback_message,
  active,
  enabled,
  channel_id,
  auto_reply_enabled
)
values (
  '00000000-0000-4000-8000-000000000401',
  '00000000-0000-4000-8000-000000000001',
  'Asistente Comercial Demo',
  'Sugiere respuestas comerciales para conversaciones entrantes.',
  'Actua como asesor comercial de CRM PRO AI. Responde de forma clara, breve y orientada a avanzar la oportunidad.',
  'Calificar al lead y proponer el siguiente paso sin inventar informacion.',
  'friendly',
  '["No prometas integraciones no configuradas", "Pide datos faltantes de manera natural"]',
  'Un asesor del equipo va a ayudarte en breve.',
  true,
  true,
  'whatsapp',
  false
)
on conflict (id) do nothing;

insert into public.webchat_widgets (
  id,
  organization_id,
  name,
  public_token,
  primary_color,
  initial_message,
  position,
  active,
  allowed_domains,
  assistant_id
)
values (
  '00000000-0000-4000-8000-000000000801',
  '00000000-0000-4000-8000-000000000001',
  'Demo WebChat CRM PRO AI',
  'wchat_demo_local_token_00000000000000000001',
  '#0f766e',
  'Hola, somos CRM PRO AI. Como podemos ayudarte?',
  'bottom-right',
  true,
  array['localhost', '127.0.0.1'],
  '00000000-0000-4000-8000-000000000401'
)
on conflict (id) do nothing;

insert into public.integrations (
  id,
  organization_id,
  name,
  description,
  kind,
  active,
  config
)
values
  (
    '00000000-0000-4000-8000-000000000901',
    '00000000-0000-4000-8000-000000000001',
    'Custom Connect Demo',
    'Herramienta HTTP mock para pruebas manuales.',
    'custom_connect',
    true,
    '{}'
  ),
  (
    '00000000-0000-4000-8000-000000000902',
    '00000000-0000-4000-8000-000000000001',
    'Google Sheets Demo',
    'Busqueda demo de filas sin OAuth.',
    'google_sheets',
    true,
    '{"spreadsheet_url":"demo://leads"}'
  )
on conflict (id) do nothing;

insert into public.integration_tools (
  id,
  organization_id,
  integration_id,
  name,
  description,
  type,
  method,
  url,
  headers_schema,
  body_schema,
  response_schema,
  active,
  timeout_ms,
  config
)
values
  (
    '00000000-0000-4000-8000-000000000911',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000901',
    'Buscar CRM externo demo',
    'Devuelve respuesta mock para validar Custom Connect.',
    'custom_connect',
    'POST',
    'mock://success',
    '{}',
    '{"query":"string"}',
    '{"ok":"boolean"}',
    true,
    3000,
    '{}'
  ),
  (
    '00000000-0000-4000-8000-000000000912',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000902',
    'Buscar Google Sheets demo',
    'Busca filas por texto en modo demo.',
    'google_sheets',
    null,
    null,
    '{}',
    '{"query":"string"}',
    '{"rows":"array"}',
    true,
    3000,
    '{"spreadsheet_url":"demo://leads"}'
  )
on conflict (id) do nothing;

insert into public.google_sheets_connections (
  id,
  organization_id,
  integration_id,
  spreadsheet_url,
  sheet_name,
  active
)
values (
  '00000000-0000-4000-8000-000000000921',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000902',
  'demo://leads',
  null,
  true
)
on conflict (organization_id, integration_id) do nothing;

insert into public.variables (
  id,
  organization_id,
  name,
  key,
  description,
  type,
  extraction_prompt,
  active,
  required,
  options
)
values
  (
    '00000000-0000-4000-8000-000000000601',
    '00000000-0000-4000-8000-000000000001',
    'Presupuesto',
    'presupuesto',
    'Presupuesto informado por el lead.',
    'price',
    'Extraer monto, precio o presupuesto mencionado por el cliente.',
    true,
    false,
    '[]'
  ),
  (
    '00000000-0000-4000-8000-000000000602',
    '00000000-0000-4000-8000-000000000001',
    'Email',
    'email',
    'Email principal del lead.',
    'text',
    'Extraer email de contacto del cliente.',
    true,
    false,
    '[]'
  ),
  (
    '00000000-0000-4000-8000-000000000603',
    '00000000-0000-4000-8000-000000000001',
    'Interes',
    'interes',
    'Interes comercial declarado.',
    'option',
    'Extraer interes del cliente si menciona CRM, WhatsApp o IA.',
    true,
    false,
    '["CRM", "WhatsApp", "IA"]'
  )
on conflict (id) do nothing;
