create table public.user_onboarding_feature_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_id text not null,
  seen_at timestamptz not null default now(),
  primary key (user_id, feature_id),
  constraint user_onboarding_feature_progress_id_valid check (feature_id ~ '^[a-z0-9][a-z0-9._-]{2,119}$')
);

insert into public.user_onboarding_feature_progress (user_id, feature_id, seen_at)
select progress.user_id, feature.feature_id, progress.updated_at
from public.user_onboarding_progress as progress
cross join lateral unnest(progress.seen_feature_ids) as feature(feature_id)
on conflict (user_id, feature_id) do nothing;

drop table public.user_onboarding_progress;
alter table public.user_onboarding_feature_progress rename to user_onboarding_progress;

revoke all on public.user_onboarding_progress from anon;
revoke all on public.user_onboarding_progress from authenticated;
grant select, insert on public.user_onboarding_progress to authenticated;
grant all on public.user_onboarding_progress to service_role;

alter table public.user_onboarding_progress enable row level security;

create policy "Users can read their onboarding progress"
  on public.user_onboarding_progress
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can create their onboarding progress"
  on public.user_onboarding_progress
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);
