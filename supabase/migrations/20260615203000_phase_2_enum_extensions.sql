alter type public.organization_role add value if not exists 'agent';

alter type public.lead_status add value if not exists 'nuevo';
alter type public.lead_status add value if not exists 'contactado';
alter type public.lead_status add value if not exists 'interesado';
alter type public.lead_status add value if not exists 'propuesta';
alter type public.lead_status add value if not exists 'ganado';
alter type public.lead_status add value if not exists 'perdido';

alter type public.conversation_channel add value if not exists 'manual';
