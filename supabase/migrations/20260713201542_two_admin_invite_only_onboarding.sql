alter table public.profiles
  add column if not exists welcome_seen_at timestamptz;

drop index if exists public.profiles_single_owner;

alter table public.profiles
  drop constraint if exists profiles_owner_identity_check;

alter table public.profiles
  drop constraint if exists profiles_owner_role_check;

alter table public.profiles
  add constraint profiles_owner_role_check
  check (not is_owner or (role = 'staff' and status = 'active'));

create or replace function public.get_my_profile_onboarding()
returns table (
  username text,
  display_name text,
  role text,
  status text,
  is_owner boolean,
  welcome_seen_at timestamptz
)
language sql
security invoker
set search_path = public
as $$
  select p.username, p.display_name, p.role, p.status, p.is_owner, p.welcome_seen_at
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function private.acknowledge_my_welcome_impl()
returns table (welcome_seen_at timestamptz)
language sql
security definer
set search_path = public, auth
as $$
  update public.profiles
  set welcome_seen_at = coalesce(profiles.welcome_seen_at, now()),
      updated_at = now()
  where id = auth.uid()
  returning profiles.welcome_seen_at;
$$;

create or replace function public.acknowledge_my_welcome()
returns table (welcome_seen_at timestamptz)
language sql
security invoker
set search_path = private, public
as $$
  select * from private.acknowledge_my_welcome_impl();
$$;

revoke all on function public.get_my_profile_onboarding() from public, anon;
revoke all on function public.acknowledge_my_welcome() from public, anon;
revoke all on function private.acknowledge_my_welcome_impl() from public, anon;
grant execute on function public.get_my_profile_onboarding() to authenticated, service_role;
grant execute on function public.acknowledge_my_welcome() to authenticated, service_role;
grant execute on function private.acknowledge_my_welcome_impl() to authenticated, service_role;
