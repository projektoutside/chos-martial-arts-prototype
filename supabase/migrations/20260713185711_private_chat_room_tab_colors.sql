begin;

alter table public.private_chat_rooms
  add column if not exists tab_color text not null default '#8a63f2';

alter table public.private_chat_rooms
  add constraint private_chat_rooms_tab_color_allowed
  check (tab_color = any (array[
    '#8a63f2', '#c94b62', '#2ea66f', '#2f80c9',
    '#c58a2a', '#c25b91', '#218f91', '#66758f'
  ]));

drop function public.list_private_chat_rooms();
drop function public.create_private_chat_room(text, uuid[]);
drop function public.update_private_chat_room(uuid, text, uuid[]);
drop function private.list_private_chat_rooms();
drop function private.create_private_chat_room(text, uuid[]);
drop function private.update_private_chat_room(uuid, text, uuid[]);

create function private.list_private_chat_rooms()
returns table (
  id uuid,
  name text,
  tab_color text,
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
    rooms.tab_color,
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

create function private.create_private_chat_room(room_name text, invited_profile_ids uuid[], room_tab_color text)
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
  if room_tab_color is null or room_tab_color <> all (array[
    '#8a63f2', '#c94b62', '#2ea66f', '#2f80c9',
    '#c58a2a', '#c25b91', '#218f91', '#66758f'
  ]) then
    raise exception 'Choose an approved room tab color.';
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

  insert into public.private_chat_rooms (name, creator_id, tab_color)
  values (trim(room_name), current_profile_id, room_tab_color)
  returning id into created_room_id;

  insert into public.private_chat_room_members (room_id, profile_id)
  select created_room_id, member_id
  from unnest(array_append(normalized_invitees, current_profile_id)) member_id;

  insert into public.private_chat_access_events (profile_id, room_id, event_type)
  select member_id, created_room_id, 'created'
  from unnest(array_append(normalized_invitees, current_profile_id)) member_id;

  return created_room_id;
end;
$$;

create function private.update_private_chat_room(room_id uuid, room_name text, invited_profile_ids uuid[], room_tab_color text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  current_profile_id uuid := (select auth.uid());
  invited_profile_id uuid;
  normalized_invitees uuid[];
  previous_member_ids uuid[];
begin
  if not private.is_private_chat_creator(room_id) then
    raise exception 'Only the room creator can manage this room.';
  end if;
  if length(trim(coalesce(room_name, ''))) not between 1 and 80 then
    raise exception 'Room names must be between 1 and 80 characters.';
  end if;
  if room_tab_color is null or room_tab_color <> all (array[
    '#8a63f2', '#c94b62', '#2ea66f', '#2f80c9',
    '#c58a2a', '#c25b91', '#218f91', '#66758f'
  ]) then
    raise exception 'Choose an approved room tab color.';
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

  select coalesce(array_agg(profile_id), '{}'::uuid[]) into previous_member_ids
  from public.private_chat_room_members where private_chat_room_members.room_id = update_private_chat_room.room_id;

  update public.private_chat_rooms
  set name = trim(room_name), tab_color = room_tab_color
  where id = room_id;
  delete from public.private_chat_room_members
  where private_chat_room_members.room_id = update_private_chat_room.room_id
    and profile_id <> current_profile_id;
  insert into public.private_chat_room_members (room_id, profile_id)
  select update_private_chat_room.room_id, member_id from unnest(normalized_invitees) member_id;

  insert into public.private_chat_access_events (profile_id, room_id, event_type)
  select member_id, update_private_chat_room.room_id,
    case when member_id = any(array_append(normalized_invitees, current_profile_id)) then 'membership_changed' else 'removed' end
  from unnest(previous_member_ids || array_append(normalized_invitees, current_profile_id)) member_id
  group by member_id;
end;
$$;

create function public.list_private_chat_rooms()
returns table (id uuid, name text, tab_color text, creator_id uuid, created_at timestamptz, updated_at timestamptz, members jsonb)
language sql stable security invoker
set search_path = public, private, pg_temp
as $$ select * from private.list_private_chat_rooms(); $$;

create function public.create_private_chat_room(room_name text, invited_profile_ids uuid[], room_tab_color text)
returns uuid
language sql volatile security invoker
set search_path = public, private, pg_temp
as $$ select private.create_private_chat_room(room_name, invited_profile_ids, room_tab_color); $$;

create function public.update_private_chat_room(room_id uuid, room_name text, invited_profile_ids uuid[], room_tab_color text)
returns void
language sql volatile security invoker
set search_path = public, private, pg_temp
as $$ select private.update_private_chat_room(room_id, room_name, invited_profile_ids, room_tab_color); $$;

revoke all on function public.list_private_chat_rooms() from public, anon;
revoke all on function public.create_private_chat_room(text, uuid[], text) from public, anon;
revoke all on function public.update_private_chat_room(uuid, text, uuid[], text) from public, anon;
grant execute on function public.list_private_chat_rooms() to authenticated, service_role;
grant execute on function public.create_private_chat_room(text, uuid[], text) to authenticated, service_role;
grant execute on function public.update_private_chat_room(uuid, text, uuid[], text) to authenticated, service_role;

revoke all on function private.list_private_chat_rooms() from public, anon;
revoke all on function private.create_private_chat_room(text, uuid[], text) from public, anon;
revoke all on function private.update_private_chat_room(uuid, text, uuid[], text) from public, anon;
grant execute on function private.list_private_chat_rooms() to authenticated, service_role;
grant execute on function private.create_private_chat_room(text, uuid[], text) to authenticated, service_role;
grant execute on function private.update_private_chat_room(uuid, text, uuid[], text) to authenticated, service_role;

do $$
begin
  assert to_regprocedure('public.create_private_chat_room(text,uuid[],text)') is not null;
  assert to_regprocedure('public.update_private_chat_room(uuid,text,uuid[],text)') is not null;
  assert to_regprocedure('public.create_private_chat_room(text,uuid[])') is null;
  assert to_regprocedure('public.update_private_chat_room(uuid,text,uuid[])') is null;
end $$;

commit;
