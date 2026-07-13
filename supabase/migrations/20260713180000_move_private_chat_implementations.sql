begin;

alter function public.list_private_chat_invitees() set schema private;
alter function public.list_private_chat_rooms() set schema private;
alter function public.create_private_chat_room(text, uuid[]) set schema private;
alter function public.update_private_chat_room(uuid, text, uuid[]) set schema private;
alter function public.delete_private_chat_room(uuid) set schema private;
alter function public.leave_private_chat_room(uuid) set schema private;

create function public.list_private_chat_invitees()
returns table (id uuid, display_name text, role text)
language sql stable security invoker
set search_path = public, private, pg_temp
as $$ select * from private.list_private_chat_invitees(); $$;

create function public.list_private_chat_rooms()
returns table (id uuid, name text, creator_id uuid, created_at timestamptz, updated_at timestamptz, members jsonb)
language sql stable security invoker
set search_path = public, private, pg_temp
as $$ select * from private.list_private_chat_rooms(); $$;

create function public.create_private_chat_room(room_name text, invited_profile_ids uuid[])
returns uuid
language sql volatile security invoker
set search_path = public, private, pg_temp
as $$ select private.create_private_chat_room(room_name, invited_profile_ids); $$;

create function public.update_private_chat_room(room_id uuid, room_name text, invited_profile_ids uuid[])
returns void
language sql volatile security invoker
set search_path = public, private, pg_temp
as $$ select private.update_private_chat_room(room_id, room_name, invited_profile_ids); $$;

create function public.delete_private_chat_room(room_id uuid)
returns void
language sql volatile security invoker
set search_path = public, private, pg_temp
as $$ select private.delete_private_chat_room(room_id); $$;

create function public.leave_private_chat_room(room_id uuid)
returns void
language sql volatile security invoker
set search_path = public, private, pg_temp
as $$ select private.leave_private_chat_room(room_id); $$;

revoke all on function public.list_private_chat_invitees() from public, anon;
revoke all on function public.list_private_chat_rooms() from public, anon;
revoke all on function public.create_private_chat_room(text, uuid[]) from public, anon;
revoke all on function public.update_private_chat_room(uuid, text, uuid[]) from public, anon;
revoke all on function public.delete_private_chat_room(uuid) from public, anon;
revoke all on function public.leave_private_chat_room(uuid) from public, anon;

grant execute on function public.list_private_chat_invitees() to authenticated, service_role;
grant execute on function public.list_private_chat_rooms() to authenticated, service_role;
grant execute on function public.create_private_chat_room(text, uuid[]) to authenticated, service_role;
grant execute on function public.update_private_chat_room(uuid, text, uuid[]) to authenticated, service_role;
grant execute on function public.delete_private_chat_room(uuid) to authenticated, service_role;
grant execute on function public.leave_private_chat_room(uuid) to authenticated, service_role;

revoke all on function private.list_private_chat_invitees() from public, anon;
revoke all on function private.list_private_chat_rooms() from public, anon;
revoke all on function private.create_private_chat_room(text, uuid[]) from public, anon;
revoke all on function private.update_private_chat_room(uuid, text, uuid[]) from public, anon;
revoke all on function private.delete_private_chat_room(uuid) from public, anon;
revoke all on function private.leave_private_chat_room(uuid) from public, anon;

grant execute on function private.list_private_chat_invitees() to authenticated, service_role;
grant execute on function private.list_private_chat_rooms() to authenticated, service_role;
grant execute on function private.create_private_chat_room(text, uuid[]) to authenticated, service_role;
grant execute on function private.update_private_chat_room(uuid, text, uuid[]) to authenticated, service_role;
grant execute on function private.delete_private_chat_room(uuid) to authenticated, service_role;
grant execute on function private.leave_private_chat_room(uuid) to authenticated, service_role;

commit;
