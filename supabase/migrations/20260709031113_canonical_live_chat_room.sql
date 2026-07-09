update public.live_chat_messages
set room_key = 'chos-room'
where room_key = 'manager-global';

alter table public.live_chat_messages
  alter column room_key set default 'chos-room';

alter table public.live_chat_messages
  drop constraint if exists live_chat_messages_room_key_check;

alter table public.live_chat_messages
  add constraint live_chat_messages_room_key_check
  check (room_key = 'chos-room');

create or replace function private.normalize_live_chat_room_key()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.room_key is null
    or btrim(new.room_key) = ''
    or new.room_key = 'manager-global'
  then
    new.room_key := 'chos-room';
  end if;

  return new;
end;
$$;

revoke all on function private.normalize_live_chat_room_key() from public;

drop trigger if exists normalize_live_chat_room_key_before_insert on public.live_chat_messages;
create trigger normalize_live_chat_room_key_before_insert
  before insert on public.live_chat_messages
  for each row
  execute function private.normalize_live_chat_room_key();
