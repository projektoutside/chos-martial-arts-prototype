create table public.private_chat_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 80),
  creator_id uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.private_chat_room_members (
  room_id uuid not null references public.private_chat_rooms(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  joined_at timestamptz not null default now(),
  primary key (room_id, profile_id)
);

create table public.private_chat_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.private_chat_rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id),
  sender_name text not null,
  sender_role text not null check (sender_role in ('staff', 'student', 'guardian')),
  sender_avatar_path text,
  body text not null check (length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);

create index private_chat_room_members_profile_idx on public.private_chat_room_members (profile_id, room_id);
create index private_chat_messages_room_created_idx on public.private_chat_messages (room_id, created_at desc);

create trigger set_private_chat_rooms_updated_at
  before update on public.private_chat_rooms
  for each row execute function public.set_updated_at();

create or replace function private.is_private_chat_member(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.private_chat_room_members
    where room_id = target_room_id
      and profile_id = (select auth.uid())
  );
$$;

create or replace function private.is_private_chat_creator(target_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.private_chat_rooms
    where id = target_room_id
      and creator_id = (select auth.uid())
  );
$$;

create or replace function private.protect_private_chat_creator()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.creator_id <> old.creator_id then
    raise exception 'The room creator cannot be changed.';
  end if;
  return new;
end;
$$;

create trigger protect_private_chat_creator
  before update on public.private_chat_rooms
  for each row execute function private.protect_private_chat_creator();

create or replace function private.require_active_private_chat_profile(profile_uuid uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.profiles
    where id = profile_uuid and status = 'active' and role in ('staff', 'student', 'guardian')
  ) then
    raise exception 'Only active Cho''s accounts can join private rooms.';
  end if;
end;
$$;

create or replace function public.list_private_chat_invitees()
returns table (id uuid, display_name text, role text)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select profiles.id, profiles.display_name, profiles.role
  from public.profiles
  where profiles.status = 'active'
    and profiles.role in ('staff', 'student', 'guardian')
    and profiles.id <> (select auth.uid())
    and private.is_active_live_chat_profile()
  order by lower(profiles.display_name), profiles.id;
$$;

create or replace function public.list_private_chat_rooms()
returns table (
  id uuid,
  name text,
  creator_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  members jsonb
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    rooms.id,
    rooms.name,
    rooms.creator_id,
    rooms.created_at,
    rooms.updated_at,
    coalesce(jsonb_agg(jsonb_build_object(
      'profile_id', profiles.id,
      'display_name', profiles.display_name,
      'role', profiles.role,
      'joined_at', memberships.joined_at
    ) order by lower(profiles.display_name)), '[]'::jsonb) as members
  from public.private_chat_rooms rooms
  join public.private_chat_room_members own_membership
    on own_membership.room_id = rooms.id and own_membership.profile_id = (select auth.uid())
  join public.private_chat_room_members memberships on memberships.room_id = rooms.id
  join public.profiles profiles on profiles.id = memberships.profile_id
  where private.is_active_live_chat_profile()
  group by rooms.id
  order by rooms.updated_at desc, rooms.id;
$$;

create or replace function public.create_private_chat_room(room_name text, invited_profile_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_profile_id uuid := (select auth.uid());
  created_room_id uuid;
  invited_profile_id uuid;
  normalized_invitees uuid[];
begin
  perform private.require_active_private_chat_profile(current_profile_id);
  if length(trim(coalesce(room_name, ''))) not between 1 and 80 then
    raise exception 'Room names must be between 1 and 80 characters.';
  end if;

  select coalesce(array_agg(distinct candidate), '{}'::uuid[])
    into normalized_invitees
  from unnest(coalesce(invited_profile_ids, '{}'::uuid[])) candidate
  where candidate <> current_profile_id;

  if cardinality(normalized_invitees) < 1 then
    raise exception 'Invite at least one person to create a private room.';
  end if;
  foreach invited_profile_id in array normalized_invitees loop
    perform private.require_active_private_chat_profile(invited_profile_id);
  end loop;

  insert into public.private_chat_rooms (name, creator_id)
  values (trim(room_name), current_profile_id)
  returning id into created_room_id;

  insert into public.private_chat_room_members (room_id, profile_id)
  select created_room_id, member_id
  from unnest(array_append(normalized_invitees, current_profile_id)) member_id;

  return created_room_id;
end;
$$;

create or replace function public.update_private_chat_room(room_id uuid, room_name text, invited_profile_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_profile_id uuid := (select auth.uid());
  invited_profile_id uuid;
  normalized_invitees uuid[];
begin
  if not private.is_private_chat_creator(room_id) then
    raise exception 'Only the room creator can manage this room.';
  end if;
  if length(trim(coalesce(room_name, ''))) not between 1 and 80 then
    raise exception 'Room names must be between 1 and 80 characters.';
  end if;

  select coalesce(array_agg(distinct candidate), '{}'::uuid[])
    into normalized_invitees
  from unnest(coalesce(invited_profile_ids, '{}'::uuid[])) candidate
  where candidate <> current_profile_id;
  if cardinality(normalized_invitees) < 1 then
    raise exception 'A private room must include at least one invited member.';
  end if;
  foreach invited_profile_id in array normalized_invitees loop
    perform private.require_active_private_chat_profile(invited_profile_id);
  end loop;

  update public.private_chat_rooms set name = trim(room_name) where id = room_id;
  delete from public.private_chat_room_members
  where private_chat_room_members.room_id = update_private_chat_room.room_id
    and profile_id <> current_profile_id;
  insert into public.private_chat_room_members (room_id, profile_id)
  select update_private_chat_room.room_id, member_id from unnest(normalized_invitees) member_id;
end;
$$;

create or replace function public.delete_private_chat_room(room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not private.is_private_chat_creator(room_id) then
    raise exception 'Only the room creator can delete this room.';
  end if;
  delete from public.private_chat_rooms where id = room_id;
end;
$$;

create or replace function public.leave_private_chat_room(room_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if private.is_private_chat_creator(room_id) then
    raise exception 'Room creators must delete their room instead of leaving it.';
  end if;
  delete from public.private_chat_room_members
  where private_chat_room_members.room_id = leave_private_chat_room.room_id
    and profile_id = (select auth.uid());
  if not found then
    raise exception 'You are not a member of this room.';
  end if;
end;
$$;

alter table public.private_chat_rooms enable row level security;
alter table public.private_chat_room_members enable row level security;
alter table public.private_chat_messages enable row level security;

create policy "Members can read private chat rooms"
  on public.private_chat_rooms for select to authenticated
  using (private.is_private_chat_member(id));
create policy "Members can read private chat memberships"
  on public.private_chat_room_members for select to authenticated
  using (private.is_private_chat_member(room_id));
create policy "Members can read private chat messages"
  on public.private_chat_messages for select to authenticated
  using (private.is_private_chat_member(room_id));
create policy "Members can send private chat messages"
  on public.private_chat_messages for insert to authenticated
  with check (
    private.is_active_live_chat_profile()
    and private.is_private_chat_member(room_id)
    and sender_id = (select auth.uid())
    and sender_name = (select display_name from public.profiles where id = (select auth.uid()) and status = 'active')
    and sender_role = (select role from public.profiles where id = (select auth.uid()) and status = 'active')
  );

revoke all on public.private_chat_rooms from anon, authenticated;
revoke all on public.private_chat_room_members from anon, authenticated;
revoke all on public.private_chat_messages from anon, authenticated;
grant select on public.private_chat_rooms, public.private_chat_room_members to authenticated;
grant select, insert on public.private_chat_messages to authenticated;
grant all on public.private_chat_rooms, public.private_chat_room_members, public.private_chat_messages to service_role;

revoke all on function private.is_private_chat_member(uuid) from public;
revoke all on function private.is_private_chat_creator(uuid) from public;
revoke all on function private.require_active_private_chat_profile(uuid) from public;
revoke all on function public.list_private_chat_invitees() from public;
revoke all on function public.list_private_chat_rooms() from public;
revoke all on function public.create_private_chat_room(text, uuid[]) from public;
revoke all on function public.update_private_chat_room(uuid, text, uuid[]) from public;
revoke all on function public.delete_private_chat_room(uuid) from public;
revoke all on function public.leave_private_chat_room(uuid) from public;

grant execute on function private.is_private_chat_member(uuid) to authenticated, service_role;
grant execute on function private.is_private_chat_creator(uuid) to authenticated, service_role;
grant execute on function public.list_private_chat_invitees() to authenticated, service_role;
grant execute on function public.list_private_chat_rooms() to authenticated, service_role;
grant execute on function public.create_private_chat_room(text, uuid[]) to authenticated, service_role;
grant execute on function public.update_private_chat_room(uuid, text, uuid[]) to authenticated, service_role;
grant execute on function public.delete_private_chat_room(uuid) to authenticated, service_role;
grant execute on function public.leave_private_chat_room(uuid) to authenticated, service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'private_chat_rooms'
  ) then
    alter publication supabase_realtime add table public.private_chat_rooms;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'private_chat_room_members'
  ) then
    alter publication supabase_realtime add table public.private_chat_room_members;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'private_chat_messages'
  ) then
    alter publication supabase_realtime add table public.private_chat_messages;
  end if;
end $$;

do $$
begin
  assert to_regclass('public.private_chat_rooms') is not null;
  assert to_regclass('public.private_chat_room_members') is not null;
  assert to_regclass('public.private_chat_messages') is not null;
  assert to_regprocedure('public.create_private_chat_room(text,uuid[])') is not null;
  assert to_regprocedure('public.update_private_chat_room(uuid,text,uuid[])') is not null;
  assert to_regprocedure('public.delete_private_chat_room(uuid)') is not null;
  assert to_regprocedure('public.leave_private_chat_room(uuid)') is not null;
end $$;
