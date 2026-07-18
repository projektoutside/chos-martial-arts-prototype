create table if not exists public.user_onboarding_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seen_feature_ids text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_onboarding_progress_feature_count check (cardinality(seen_feature_ids) <= 500)
);

revoke all on public.user_onboarding_progress from anon;
revoke all on public.user_onboarding_progress from authenticated;
grant select, insert, update on public.user_onboarding_progress to authenticated;
grant all on public.user_onboarding_progress to service_role;

alter table public.user_onboarding_progress enable row level security;

drop policy if exists "Users can read their onboarding progress" on public.user_onboarding_progress;
create policy "Users can read their onboarding progress"
  on public.user_onboarding_progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their onboarding progress" on public.user_onboarding_progress;
create policy "Users can create their onboarding progress"
  on public.user_onboarding_progress
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their onboarding progress" on public.user_onboarding_progress;
create policy "Users can update their onboarding progress"
  on public.user_onboarding_progress
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
