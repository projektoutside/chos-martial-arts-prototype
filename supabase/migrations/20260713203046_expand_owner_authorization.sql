alter table public.profiles
  drop constraint if exists profiles_owner_is_manager;

create or replace function private.is_manager_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_owner is true
      and role = 'staff'
      and status = 'active'
  );
$$;

revoke all on function private.is_manager_owner() from public, anon;
grant execute on function private.is_manager_owner() to authenticated, service_role;
