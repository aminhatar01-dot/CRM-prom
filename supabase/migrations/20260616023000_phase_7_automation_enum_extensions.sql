alter type public.automation_trigger_type add value if not exists 'lead_created';
alter type public.automation_trigger_type add value if not exists 'message_received';
alter type public.automation_trigger_type add value if not exists 'smart_tag_assigned';
alter type public.automation_trigger_type add value if not exists 'variable_updated';
alter type public.automation_trigger_type add value if not exists 'manual';

alter type public.automation_action_type add value if not exists 'assign_smart_tag';
alter type public.automation_action_type add value if not exists 'update_variable';
alter type public.automation_action_type add value if not exists 'notify_internal';
