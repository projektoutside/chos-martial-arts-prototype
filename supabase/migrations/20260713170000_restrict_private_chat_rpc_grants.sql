revoke all on function public.list_private_chat_invitees() from anon;
revoke all on function public.list_private_chat_rooms() from anon;
revoke all on function public.create_private_chat_room(text, uuid[]) from anon;
revoke all on function public.update_private_chat_room(uuid, text, uuid[]) from anon;
revoke all on function public.delete_private_chat_room(uuid) from anon;
revoke all on function public.leave_private_chat_room(uuid) from anon;
