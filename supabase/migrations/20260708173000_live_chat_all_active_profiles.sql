alter table public.live_chat_messages
  drop constraint if exists live_chat_messages_sender_role_check;

alter table public.live_chat_messages
  add constraint live_chat_messages_sender_role_check
  check (sender_role in ('staff', 'student', 'guardian', 'system'));

create schema if not exists private;

create or replace function private.is_active_live_chat_profile()
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
      and role in ('staff', 'student', 'guardian')
      and status = 'active'
  );
$$;

revoke all on function private.is_active_live_chat_profile() from public;
grant usage on schema private to authenticated;
grant execute on function private.is_active_live_chat_profile() to authenticated;
grant execute on function private.is_active_live_chat_profile() to service_role;

drop policy if exists "Active staff can read live chat messages" on public.live_chat_messages;
drop policy if exists "Active profiles can read live chat messages" on public.live_chat_messages;
create policy "Active profiles can read live chat messages"
  on public.live_chat_messages
  for select
  to authenticated
  using (private.is_active_live_chat_profile());

drop policy if exists "Active staff can send live chat messages" on public.live_chat_messages;
drop policy if exists "Active profiles can send live chat messages" on public.live_chat_messages;
create policy "Active profiles can send live chat messages"
  on public.live_chat_messages
  for insert
  to authenticated
  with check (
    private.is_active_live_chat_profile()
    and sender_user_id = (select auth.uid())
    and sender_role in ('staff', 'student', 'guardian')
    and sender_role = (
      select role
      from public.profiles
      where id = (select auth.uid())
        and status = 'active'
    )
    and message_kind = 'user'
    and length(trim(body)) between 1 and 500
    and sender_name = (
      select display_name
      from public.profiles
      where id = (select auth.uid())
        and role in ('staff', 'student', 'guardian')
        and status = 'active'
    )
  );
