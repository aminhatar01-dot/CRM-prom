create or replace function public.create_initial_organization(
  p_name text,
  p_slug text
)
returns table (
  organization_id uuid,
  organization_slug text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  created_organization_id uuid;
  normalized_name text := btrim(p_name);
  normalized_slug text := lower(btrim(p_slug));
begin
  if current_user_id is null then
    raise exception using
      errcode = '42501',
      message = 'Authentication required';
  end if;

  if char_length(normalized_name) < 2 or char_length(normalized_name) > 80 then
    raise exception using
      errcode = '22023',
      message = 'Organization name must contain between 2 and 80 characters';
  end if;

  if char_length(normalized_slug) < 2
    or char_length(normalized_slug) > 60
    or normalized_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid organization slug';
  end if;

  if exists (
    select 1
    from public.organization_members
    where user_id = current_user_id
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'User already belongs to an organization';
  end if;

  insert into public.organizations (name, slug)
  values (normalized_name, normalized_slug)
  returning id into created_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (created_organization_id, current_user_id, 'owner');

  return query
  select created_organization_id, normalized_slug;
exception
  when unique_violation then
    raise exception using
      errcode = '23505',
      message = 'Organization slug already exists',
      detail = normalized_slug;
end;
$$;

revoke all on function public.create_initial_organization(text, text) from public;
grant execute on function public.create_initial_organization(text, text) to authenticated;
