-- Idempotent demo seed compatible with the current remote schema.
-- It never creates auth users, memberships, secrets, or real outbound events.
-- Leads, conversations, messages, lead_tags, automation_actions and webchat_widgets
-- are excluded because their current generic integrity triggers reference fields
-- that are not available on every attached table.

insert into public.organizations (id, name, slug)
values (
  '00000000-0000-4000-8000-000000000001',
  'Demo CRM PRO AI',
  'demo-crm-pro-ai'
)
on conflict (id) do update
set name = excluded.name,
    slug = excluded.slug;

insert into public.pipelines (id, organization_id, name)
values (
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000001',
  'Pipeline Comercial'
)
on conflict (id) do update
set name = excluded.name;

insert into public.pipeline_stages (id, organization_id, pipeline_id, name, position)
values
  (
    '00000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000010',
    'Nuevo',
    1
  ),
  (
    '00000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000010',
    'Calificado',
    2
  ),
  (
    '00000000-0000-4000-8000-000000000013',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000010',
    'Ganado',
    3
  )
on conflict (id) do update
set name = excluded.name,
    position = excluded.position;

insert into public.tags (
  id,
  organization_id,
  name,
  color,
  is_ai_generated,
  description,
  classification_prompt,
  active,
  auto_pause_assistant,
  notify_team
)
values
  (
    '00000000-0000-4000-8000-000000000501',
    '00000000-0000-4000-8000-000000000001',
    'Alta intencion',
    '#0f766e',
    true,
    'Lead con senales claras de compra o avance comercial.',
    'Clasificar cuando el cliente pide demo, precios, propuesta o quiere avanzar.',
    true,
    false,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000502',
    '00000000-0000-4000-8000-000000000001',
    'Presupuesto pendiente',
    '#b45309',
    true,
    'Conversacion donde falta confirmar presupuesto.',
    'Clasificar cuando el cliente menciona presupuesto, precio, costo o financiacion.',
    true,
    true,
    false
  )
on conflict (id) do update
set name = excluded.name,
    color = excluded.color,
    description = excluded.description,
    classification_prompt = excluded.classification_prompt,
    active = excluded.active,
    auto_pause_assistant = excluded.auto_pause_assistant,
    notify_team = excluded.notify_team;

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
  (
    '00000000-0000-4000-8000-000000000201',
    '00000000-0000-4000-8000-000000000001',
    'Felipe Norte',
    'Felipe',
    'Norte',
    'felipe@example.com',
    '+5491100000011',
    'Norte CRM',
    'Buenos Aires',
    'Contacto activo.'
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    '00000000-0000-4000-8000-000000000001',
    'Gabriela Sur',
    'Gabriela',
    'Sur',
    'gabriela@example.com',
    '+5491100000012',
    'Sur Leads',
    'Cordoba',
    'Prefiere WhatsApp.'
  )
on conflict (id) do update
set full_name = excluded.full_name,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    email = excluded.email,
    phone = excluded.phone,
    company = excluded.company,
    location = excluded.location,
    notes = excluded.notes;

insert into public.whatsapp_channel_settings (
  id,
  organization_id,
  phone_number_id,
  business_account_id,
  display_phone_number,
  webhook_verify_token_hint,
  enabled
)
values (
  '00000000-0000-4000-8000-000000000321',
  '00000000-0000-4000-8000-000000000001',
  'demo-phone-number-id',
  'demo-business-account-id',
  '+54 9 11 0000-0000',
  'demo-only',
  false
)
on conflict (id) do update
set display_phone_number = excluded.display_phone_number,
    webhook_verify_token_hint = excluded.webhook_verify_token_hint,
    enabled = false;

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
  'Actua como asesor comercial de CRM PRO AI. Responde con claridad y sin inventar informacion.',
  'Calificar al lead y proponer el siguiente paso.',
  'friendly',
  '["No enviar mensajes automaticamente"]'::jsonb,
  'Un asesor del equipo va a ayudarte en breve.',
  true,
  true,
  'manual',
  false
)
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    prompt = excluded.prompt,
    objective = excluded.objective,
    tone = excluded.tone,
    rules = excluded.rules,
    fallback_message = excluded.fallback_message,
    active = excluded.active,
    enabled = excluded.enabled,
    channel_id = excluded.channel_id,
    auto_reply_enabled = false;

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
values (
  '00000000-0000-4000-8000-000000000701',
  '00000000-0000-4000-8000-000000000001',
  'Seguimiento demo manual',
  'Regla demo desactivada; no ejecuta mensajes reales.',
  'manual',
  'draft',
  false,
  '{}'::jsonb,
  '{}'::jsonb
)
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    trigger_type = excluded.trigger_type,
    status = 'draft',
    enabled = false,
    trigger_config = excluded.trigger_config,
    conditions = excluded.conditions;

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
  options,
  auto_extract_enabled
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
    '[]'::jsonb,
    false
  ),
  (
    '00000000-0000-4000-8000-000000000602',
    '00000000-0000-4000-8000-000000000001',
    'Interes',
    'interes',
    'Interes comercial declarado.',
    'option',
    'Extraer interes si el cliente menciona CRM, WhatsApp o IA.',
    true,
    false,
    '["CRM", "WhatsApp", "IA"]'::jsonb,
    false
  )
on conflict (id) do update
set name = excluded.name,
    key = excluded.key,
    description = excluded.description,
    type = excluded.type,
    extraction_prompt = excluded.extraction_prompt,
    active = excluded.active,
    required = excluded.required,
    options = excluded.options,
    auto_extract_enabled = false;

insert into public.integrations (
  id,
  organization_id,
  name,
  description,
  kind,
  active,
  config
)
values (
  '00000000-0000-4000-8000-000000000901',
  '00000000-0000-4000-8000-000000000001',
  'Custom Connect Demo',
  'Herramienta HTTP mock para pruebas manuales.',
  'custom_connect',
  true,
  '{}'::jsonb
)
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    kind = excluded.kind,
    active = excluded.active,
    config = excluded.config;

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
values (
  '00000000-0000-4000-8000-000000000911',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000901',
  'Buscar CRM externo demo',
  'Devuelve una respuesta mock sin salir a internet.',
  'custom_connect',
  'POST',
  'mock://success',
  '{}'::jsonb,
  '{"query":"string"}'::jsonb,
  '{"ok":"boolean"}'::jsonb,
  true,
  3000,
  '{}'::jsonb
)
on conflict (id) do update
set name = excluded.name,
    description = excluded.description,
    method = excluded.method,
    url = excluded.url,
    headers_schema = excluded.headers_schema,
    body_schema = excluded.body_schema,
    response_schema = excluded.response_schema,
    active = excluded.active,
    timeout_ms = excluded.timeout_ms,
    config = excluded.config;
