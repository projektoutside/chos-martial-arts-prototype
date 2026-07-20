begin;

create or replace function public.get_my_student_record()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select (
    select student_record
    from public.profiles as profiles
    join public.app_state_items as app_state_items
      on app_state_items.key = 'chos.operations.students.v1'
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(app_state_items.value) = 'array' then app_state_items.value
        else '[]'::jsonb
      end
    ) as student_record
    where auth.uid() is not null
      and profiles.id = auth.uid()
      and profiles.status = 'active'
      and profiles.role = 'student'
      and nullif(trim(profiles.student_id), '') is not null
      and student_record->>'id' = profiles.student_id
    limit 1
  );
$function$;

revoke all on function public.get_my_student_record() from public;
revoke all on function public.get_my_student_record() from anon;
grant execute on function public.get_my_student_record() to authenticated;

comment on function public.get_my_student_record() is
  'Returns only the active student record linked to the authenticated student profile.';

commit;
