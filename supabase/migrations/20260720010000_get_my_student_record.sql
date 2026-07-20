begin;

create or replace function public.set_app_state_items_updated_by()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_by = coalesce(auth.uid(), new.updated_by);
  return new;
end;
$function$;

drop policy if exists "Active profiles can read app state" on public.app_state_items;
drop policy if exists "Authorized profiles can read app state" on public.app_state_items;
create policy "Authorized profiles can read app state"
  on public.app_state_items
  for select
  to authenticated
  using (
    (
      key = 'chos.operations.students.v1'
      and exists (
        select 1
        from public.profiles
        where profiles.id = (select auth.uid())
          and profiles.status = 'active'
          and profiles.role = 'staff'
          and (profiles.is_owner or 'students' = any(coalesce(profiles.access, '{}'::text[])))
      )
    )
    or (
      key <> 'chos.operations.students.v1'
      and (
        private.is_active_staff()
        or (
          key in (
            'chos.operations.classes.v1',
            'chos.operations.schedule.v1',
            'chos.operations.events.v1',
            'chos.operations.merchandise.v1',
            'chos.operations.videoFolders.v1',
            'chos.operations.videos.v1',
            'chos.operations.studyGuideFolders.v1',
            'chos.operations.studyGuideMaterials.v1'
          )
          and exists (
            select 1
            from public.profiles
            where profiles.id = (select auth.uid())
              and profiles.status = 'active'
          )
        )
      )
    )
  );

drop policy if exists "Active staff can create app state" on public.app_state_items;
create policy "Active staff can create app state"
  on public.app_state_items
  for insert
  to authenticated
  with check (private.is_active_staff() and key <> 'chos.operations.students.v1');

drop policy if exists "Active staff can update app state" on public.app_state_items;
create policy "Active staff can update app state"
  on public.app_state_items
  for update
  to authenticated
  using (private.is_active_staff() and key <> 'chos.operations.students.v1')
  with check (private.is_active_staff() and key <> 'chos.operations.students.v1');

drop policy if exists "Owner manager can delete app state" on public.app_state_items;
create policy "Owner manager can delete app state"
  on public.app_state_items
  for delete
  to authenticated
  using (private.is_manager_owner() and key <> 'chos.operations.students.v1');

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
      and lower(coalesce(nullif(trim(student_record->>'status'), ''), 'active')) <> 'inactive'
    limit 1
  );
$function$;

revoke all on function public.get_my_student_record() from public;
revoke all on function public.get_my_student_record() from anon;
grant execute on function public.get_my_student_record() to authenticated;

comment on function public.get_my_student_record() is
  'Returns only the active student record linked to the authenticated student profile.';

create or replace function public.mutate_student_roster(
  p_upserts jsonb default '[]'::jsonb,
  p_delete_ids text[] default '{}'::text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor uuid := auth.uid();
  v_students jsonb;
  v_student jsonb;
  v_position integer;
begin
  if v_actor is null or not exists (
    select 1
    from public.profiles
    where profiles.id = v_actor
      and profiles.role = 'staff'
      and profiles.status = 'active'
      and (profiles.is_owner or 'students' = any(coalesce(profiles.access, '{}'::text[])))
  ) then
    raise insufficient_privilege using message = 'Active staff access is required to update the student roster.';
  end if;
  if jsonb_typeof(coalesce(p_upserts, '[]'::jsonb)) <> 'array' then
    raise exception 'Student roster upserts must be an array.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_upserts, '[]'::jsonb)) as candidate(student_record)
    where jsonb_typeof(candidate.student_record) <> 'object'
      or nullif(trim(candidate.student_record->>'id'), '') is null
  ) then
    raise exception 'Every student roster upsert must have an id.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_upserts, '[]'::jsonb)) as candidate(student_record)
    group by candidate.student_record->>'id'
    having count(*) > 1
  ) then
    raise exception 'Student roster upserts contain duplicate ids.';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_delete_ids, '{}'::text[])) as deleted_id(student_id)
    where nullif(trim(deleted_id.student_id), '') is null
  ) then
    raise exception 'Student roster delete ids cannot be null or blank.';
  end if;

  insert into public.app_state_items (key, value, created_by, updated_by)
  values ('chos.operations.students.v1', '[]'::jsonb, v_actor, v_actor)
  on conflict (key) do nothing;

  select app_state_items.value
    into v_students
    from public.app_state_items as app_state_items
    where app_state_items.key = 'chos.operations.students.v1'
    for update;

  if jsonb_typeof(v_students) <> 'array' then
    raise exception 'Student roster state is not an array.';
  end if;

  select coalesce(jsonb_agg(existing.student_record order by existing.position), '[]'::jsonb)
    into v_students
    from jsonb_array_elements(v_students) with ordinality as existing(student_record, position)
    where not coalesce(existing.student_record->>'id' = any(coalesce(p_delete_ids, '{}'::text[])), false);

  for v_student in
    select candidate.student_record
    from jsonb_array_elements(coalesce(p_upserts, '[]'::jsonb)) as candidate(student_record)
  loop
    select existing.position::integer - 1
      into v_position
      from jsonb_array_elements(v_students) with ordinality as existing(student_record, position)
      where existing.student_record->>'id' = v_student->>'id'
      limit 1;
    if v_position is null then
      v_students := jsonb_build_array(v_student) || v_students;
    else
      v_students := jsonb_set(v_students, array[v_position::text], v_student, false);
    end if;
    v_position := null;
  end loop;

  update public.app_state_items
    set value = v_students,
        updated_by = v_actor
    where key = 'chos.operations.students.v1';
  return v_students;
end;
$function$;

revoke all on function public.mutate_student_roster(jsonb, text[]) from public;
revoke all on function public.mutate_student_roster(jsonb, text[]) from anon;
grant execute on function public.mutate_student_roster(jsonb, text[]) to authenticated;

comment on function public.mutate_student_roster(jsonb, text[]) is
  'Applies per-student upserts and deletions under a row lock so stale clients cannot replace the whole roster.';

create or replace function public.provision_managed_account(
  p_profile jsonb,
  p_audit jsonb,
  p_student_record jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_role text := p_profile->>'role';
  v_student_id text := nullif(trim(p_profile->>'student_id'), '');
  v_students jsonb;
begin
  if v_role not in ('staff', 'student', 'guardian') then
    raise exception 'Unsupported managed account role.';
  end if;
  if (v_role = 'student') <> (p_student_record is not null) then
    raise exception 'Student profile and roster record must be provisioned together.';
  end if;
  if v_role = 'student' and (
    v_student_id is null
    or jsonb_typeof(p_student_record) <> 'object'
    or p_student_record->>'id' <> v_student_id
    or lower(coalesce(nullif(trim(p_student_record->>'status'), ''), 'active')) = 'inactive'
  ) then
    raise exception 'Managed student roster record is invalid.';
  end if;

  insert into public.profiles (
    id, username, auth_email, contact_email, display_name, role, status,
    is_owner, welcome_seen_at, invitation_status, invited_at,
    invitation_accepted_at, phone, title, notes, access, student_id, created_by
  ) values (
    (p_profile->>'id')::uuid,
    p_profile->>'username',
    p_profile->>'auth_email',
    nullif(p_profile->>'contact_email', ''),
    p_profile->>'display_name',
    v_role,
    p_profile->>'status',
    false,
    null,
    'pending',
    (p_profile->>'invited_at')::timestamptz,
    null,
    nullif(p_profile->>'phone', ''),
    nullif(p_profile->>'title', ''),
    nullif(p_profile->>'notes', ''),
    array(select jsonb_array_elements_text(coalesce(p_profile->'access', '[]'::jsonb))),
    v_student_id,
    nullif(p_profile->>'created_by', '')::uuid
  );

  insert into public.account_creation_audit (
    created_by, created_user_id, created_username, created_auth_email,
    created_contact_email, created_role, request_ip, user_agent
  ) values (
    nullif(p_audit->>'created_by', '')::uuid,
    nullif(p_audit->>'created_user_id', '')::uuid,
    p_audit->>'created_username',
    p_audit->>'created_auth_email',
    nullif(p_audit->>'created_contact_email', ''),
    p_audit->>'created_role',
    nullif(p_audit->>'request_ip', ''),
    nullif(p_audit->>'user_agent', '')
  );

  if p_student_record is not null then
    insert into public.app_state_items (key, value, created_by, updated_by)
    values ('chos.operations.students.v1', '[]'::jsonb, nullif(p_profile->>'created_by', '')::uuid, nullif(p_profile->>'created_by', '')::uuid)
    on conflict (key) do nothing;

    select app_state_items.value
      into v_students
      from public.app_state_items as app_state_items
      where app_state_items.key = 'chos.operations.students.v1'
      for update;

    if jsonb_typeof(v_students) <> 'array' then
      raise exception 'Student roster state is not an array.';
    end if;
    if exists (select 1 from jsonb_array_elements(v_students) as existing where existing->>'id' = v_student_id) then
      raise exception 'A student roster record with that id already exists.';
    end if;

    update public.app_state_items
      set value = jsonb_build_array(p_student_record) || v_students,
          updated_by = nullif(p_profile->>'created_by', '')::uuid
      where key = 'chos.operations.students.v1';
  end if;
end;
$function$;

revoke all on function public.provision_managed_account(jsonb, jsonb, jsonb) from public;
revoke all on function public.provision_managed_account(jsonb, jsonb, jsonb) from anon;
revoke all on function public.provision_managed_account(jsonb, jsonb, jsonb) from authenticated;
grant execute on function public.provision_managed_account(jsonb, jsonb, jsonb) to service_role;

comment on function public.provision_managed_account(jsonb, jsonb, jsonb) is
  'Atomically creates a managed profile, audit record, and linked active student roster record for service-role account provisioning.';

commit;
