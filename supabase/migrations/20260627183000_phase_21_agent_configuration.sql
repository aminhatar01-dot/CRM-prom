alter table public.ai_assistants
  add column if not exists agent_config jsonb not null default '{}'::jsonb,
  add column if not exists playbooks jsonb not null default '[]'::jsonb;

alter table public.ai_assistants
  drop constraint if exists ai_assistants_agent_config_object,
  add constraint ai_assistants_agent_config_object check (jsonb_typeof(agent_config) = 'object'),
  drop constraint if exists ai_assistants_playbooks_array,
  add constraint ai_assistants_playbooks_array check (jsonb_typeof(playbooks) = 'array');

update public.ai_assistants
set agent_config = jsonb_build_object(
  'agent_name', name,
  'role', coalesce(nullif(description, ''), 'asesor comercial'),
  'industry', '',
  'business_description', coalesce(description, ''),
  'sells', '',
  'services', '',
  'products', '',
  'primary_goal', coalesce(objective, 'Responder consultas y ayudar al cliente.'),
  'formality', case tone when 'friendly' then 'close' when 'warm' then 'close' else 'professional' end,
  'response_length', 'normal',
  'emoji_usage', 'low',
  'commercial_pace', 'consultative',
  'communication_style', 'friendly',
  'always_ask', '[]'::jsonb,
  'never_invent', coalesce(rules, '[]'::jsonb),
  'human_topics', '[]'::jsonb,
  'create_task_when', '[]'::jsonb,
  'create_opportunity_when', '[]'::jsonb,
  'create_appointment_when', '[]'::jsonb,
  'pause_ai_when', '[]'::jsonb,
  'auto_reply_when', '[]'::jsonb,
  'draft_only_when', '[]'::jsonb,
  'knowledge_topics', '[]'::jsonb
)
where agent_config = '{}'::jsonb;

comment on column public.ai_assistants.agent_config is
  'Phase 21 visual configuration used server-side to generate the internal assistant prompt.';
comment on column public.ai_assistants.playbooks is
  'Tenant-editable conversation playbooks. They do not activate automations by themselves.';
