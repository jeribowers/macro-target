-- Per-day activity level for macro targets (independent of user_settings default).

create table if not exists public.daily_activity_levels (
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  activity_level text not null default 'medium',
  updated_at timestamptz not null default now(),
  primary key (user_id, log_date),
  constraint daily_activity_levels_level_check
    check (activity_level in ('low', 'medium', 'high'))
);

create index if not exists daily_activity_levels_user_date_idx
  on public.daily_activity_levels (user_id, log_date desc);

alter table public.daily_activity_levels enable row level security;

drop policy if exists "daily_activity_levels_select_own" on public.daily_activity_levels;
create policy "daily_activity_levels_select_own"
  on public.daily_activity_levels for select
  using (auth.uid() = user_id);

drop policy if exists "daily_activity_levels_insert_own" on public.daily_activity_levels;
create policy "daily_activity_levels_insert_own"
  on public.daily_activity_levels for insert
  with check (auth.uid() = user_id);

drop policy if exists "daily_activity_levels_update_own" on public.daily_activity_levels;
create policy "daily_activity_levels_update_own"
  on public.daily_activity_levels for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "daily_activity_levels_delete_own" on public.daily_activity_levels;
create policy "daily_activity_levels_delete_own"
  on public.daily_activity_levels for delete
  using (auth.uid() = user_id);
