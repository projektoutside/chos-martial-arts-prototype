-- Shared instructional content is available to every active signed-in member.
-- Operational, customer, student, order, messaging, and configuration records
-- remain staff-only even when a non-staff client queries the Data API directly.
drop policy if exists "Active profiles can read app state" on public.app_state_items;

create policy "Authorized profiles can read app state"
  on public.app_state_items
  for select
  to authenticated
  using (
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
  );
