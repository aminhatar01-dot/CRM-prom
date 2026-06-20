begin;

create extension if not exists pgtap with schema extensions;

select plan(20);

select has_column('public', 'leads', 'archived_at', 'leads supports non-destructive archive');
select has_column('public', 'messages', 'archived_at', 'messages supports non-destructive archive');
select has_function('public', 'validate_lead_tenant', array[]::text[], 'lead validator is table-specific');
select has_function('public', 'validate_message_tenant', array[]::text[], 'message validator is table-specific');
select has_function('public', 'validate_webchat_widget_tenant', array[]::text[], 'webchat validator is table-specific');
select has_function('public', 'validate_automation_action_tenant', array[]::text[], 'automation validator is table-specific');

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'phase13-a@example.com',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'phase13-b@example.com',
    '',
    now(),
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.organizations (id, name, slug)
values
  ('20000000-0000-4000-8000-000000000001', 'Phase 13 A', 'phase-13-a'),
  ('20000000-0000-4000-8000-000000000002', 'Phase 13 B', 'phase-13-b');

insert into public.organization_members (organization_id, user_id, role)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'owner'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'owner');

select lives_ok(
  $$
    insert into public.contacts (
      id, organization_id, first_name, full_name, email, owner_id
    ) values (
      '30000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'Contacto A',
      'Contacto A',
      'contact-a@example.com',
      '10000000-0000-4000-8000-000000000001'
    )
  $$,
  'contact insert accepts fields that exist on contacts'
);

select lives_ok(
  $$
    insert into public.leads (
      id, organization_id, title, first_name, status, owner_id
    ) values (
      '40000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'Lead A',
      'Lead A',
      'nuevo',
      '10000000-0000-4000-8000-000000000001'
    )
  $$,
  'lead insert no longer reads conversation_id'
);

select lives_ok(
  $$
    insert into public.conversations (
      id, organization_id, lead_id, channel, status, ai_status, owner_id
    ) values (
      '50000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001',
      'manual',
      'abierta',
      'human',
      '10000000-0000-4000-8000-000000000001'
    )
  $$,
  'conversation insert validates its own references'
);

select lives_ok(
  $$
    insert into public.messages (
      id, organization_id, conversation_id, direction, sender_type, sender_user_id,
      body, channel, status
    ) values (
      '60000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      '50000000-0000-4000-8000-000000000001',
      'outbound',
      'user',
      '10000000-0000-4000-8000-000000000001',
      'Mensaje de prueba',
      'manual',
      'sent'
    )
  $$,
  'message insert validates conversation and sender'
);

insert into public.ai_assistants (
  id, organization_id, name, prompt, rules, goals, tone, fallback_message, enabled, active
)
values (
  '70000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Assistant A',
  'Prompt suficientemente largo para la prueba Phase 13.',
  '[]'::jsonb,
  '[]'::jsonb,
  'professional',
  'Fallback',
  true,
  true
);

select lives_ok(
  $$
    insert into public.webchat_widgets (
      id, organization_id, name, assistant_id, active
    ) values (
      '80000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'Widget A',
      '70000000-0000-4000-8000-000000000001',
      false
    )
  $$,
  'webchat widget insert no longer reads webchat_widget_id'
);

insert into public.automation_rules (
  id, organization_id, name, trigger_type, config, enabled, status
)
values (
  '90000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Automation A',
  'manual',
  '{}'::jsonb,
  false,
  'draft'
);

select lives_ok(
  $$
    insert into public.automation_actions (
      organization_id, rule_id, action_type, config, position, enabled
    ) values (
      '20000000-0000-4000-8000-000000000001',
      '90000000-0000-4000-8000-000000000001',
      'create_task',
      '{"title":"Follow up"}'::jsonb,
      1,
      true
    )
  $$,
  'automation action insert no longer reads user_id'
);

insert into public.tags (
  id, organization_id, name, color, classification_prompt, active
)
values (
  '91000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Phase 13 Tag',
  '#0f766e',
  'Clasificar la conversacion de prueba Phase 13.',
  true
);

select lives_ok(
  $$
    insert into public.lead_tags (organization_id, lead_id, tag_id)
    values (
      '20000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001',
      '91000000-0000-4000-8000-000000000001'
    )
  $$,
  'smart tag assignment validates lead and tag without missing fields'
);

insert into public.variables (
  id, organization_id, name, key, type, extraction_prompt, active
)
values (
  '92000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Phase 13 Budget',
  'phase_13_budget',
  'price',
  'Extraer el presupuesto de la conversacion Phase 13.',
  true
);

select lives_ok(
  $$
    insert into public.lead_variables (
      organization_id, lead_id, variable_id, value, confidence, source_message_id
    ) values (
      '20000000-0000-4000-8000-000000000001',
      '40000000-0000-4000-8000-000000000001',
      '92000000-0000-4000-8000-000000000001',
      '2500'::jsonb,
      0.9,
      '60000000-0000-4000-8000-000000000001'
    )
  $$,
  'lead variable validates variable lead and source message'
);

insert into public.integrations (
  id, organization_id, name, kind, active
)
values (
  '93000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'Phase 13 Integration',
  'custom_connect',
  false
);

select lives_ok(
  $$
    insert into public.integration_tools (
      organization_id, integration_id, name, type, method, url, active
    ) values (
      '20000000-0000-4000-8000-000000000001',
      '93000000-0000-4000-8000-000000000001',
      'Phase 13 Tool',
      'custom_connect',
      'POST',
      'mock://success',
      false
    )
  $$,
  'integration tool validates its integration without polymorphic NEW access'
);

insert into public.contacts (id, organization_id, first_name, full_name)
values (
  '30000000-0000-4000-8000-000000000002',
  '20000000-0000-4000-8000-000000000002',
  'Contacto B',
  'Contacto B'
);

select throws_ok(
  $$
    update public.leads
    set contact_id = '30000000-0000-4000-8000-000000000002'
    where id = '40000000-0000-4000-8000-000000000001'
  $$,
  '23514',
  'contact_id must belong to the same organization',
  'lead rejects a cross-tenant contact'
);

select throws_ok(
  $$
    insert into public.conversations (
      organization_id, contact_id, channel, status, ai_status
    ) values (
      '20000000-0000-4000-8000-000000000001',
      '30000000-0000-4000-8000-000000000002',
      'manual',
      'abierta',
      'human'
    )
  $$,
  '23514',
  'contact_id must belong to the same organization',
  'conversation rejects a cross-tenant contact'
);

select lives_ok(
  $$
    update public.messages
    set archived_at = now()
    where id = '60000000-0000-4000-8000-000000000001'
  $$,
  'message can be archived without deletion'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select is(
  (select count(*)::integer from public.leads),
  1,
  'RLS exposes only the current organization leads'
);

select is(
  (select count(*)::integer from public.contacts),
  1,
  'RLS exposes only the current organization contacts'
);

reset role;

select * from finish();
rollback;
