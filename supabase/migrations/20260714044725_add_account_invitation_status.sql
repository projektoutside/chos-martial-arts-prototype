alter table public.profiles
  add column if not exists invitation_status text not null default 'accepted',
  add column if not exists invited_at timestamptz,
  add column if not exists invitation_accepted_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_invitation_status_check;

alter table public.profiles
  add constraint profiles_invitation_status_check
  check (invitation_status in ('pending', 'accepted'));

comment on column public.profiles.invitation_status is
  'Invite lifecycle. Existing and legacy provisioned accounts default to accepted; emailed invitations start pending.';

create or replace function private.accept_profile_invitation_on_auth_confirmation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email_confirmed_at is not null
     and old.email_confirmed_at is null then
    update public.profiles
    set invitation_status = 'accepted',
        invitation_accepted_at = coalesce(invitation_accepted_at, new.email_confirmed_at)
    where id = new.id
      and invitation_status = 'pending';
  end if;
  return new;
end;
$$;

revoke all on function private.accept_profile_invitation_on_auth_confirmation() from public, anon, authenticated;

drop trigger if exists accept_profile_invitation_on_auth_confirmation on auth.users;
create trigger accept_profile_invitation_on_auth_confirmation
  after update of email_confirmed_at on auth.users
  for each row
  execute function private.accept_profile_invitation_on_auth_confirmation();
