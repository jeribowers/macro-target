-- Light tracker cloud sync: tables, columns, and RLS for personal Google sign-in.

create table if not exists public.allowed_users (
  email text primary key
);

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  external_id text,
  name text not null,
  unit text not null default 'g',
  default_grams numeric not null default 100,
  serving_size numeric,
  serving_unit text,
  default_serving_size numeric,
  cal100 numeric not null default 0,
  prot100 numeric not null default 0,
  carb100 numeric not null default 0,
  fat100 numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists foods_user_external_id_idx
  on public.foods (user_id, external_id)
  where external_id is not null;

create table if not exists public.log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  meal text not null,
  name text not null,
  food_external_id text,
  quantity numeric,
  unit text,
  grams numeric,
  calories numeric not null default 0,
  protein numeric not null default 0,
  carbs numeric not null default 0,
  fat numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists log_entries_user_date_idx
  on public.log_entries (user_id, log_date);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  activity_level text not null default 'medium',
  updated_at timestamptz not null default now()
);

alter table public.foods enable row level security;
alter table public.log_entries enable row level security;
alter table public.user_settings enable row level security;
alter table public.allowed_users enable row level security;

drop policy if exists "foods_select_own" on public.foods;
create policy "foods_select_own"
  on public.foods for select
  using (auth.uid() = user_id);

drop policy if exists "foods_insert_own" on public.foods;
create policy "foods_insert_own"
  on public.foods for insert
  with check (auth.uid() = user_id);

drop policy if exists "foods_update_own" on public.foods;
create policy "foods_update_own"
  on public.foods for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "foods_delete_own" on public.foods;
create policy "foods_delete_own"
  on public.foods for delete
  using (auth.uid() = user_id);

drop policy if exists "log_entries_select_own" on public.log_entries;
create policy "log_entries_select_own"
  on public.log_entries for select
  using (auth.uid() = user_id);

drop policy if exists "log_entries_insert_own" on public.log_entries;
create policy "log_entries_insert_own"
  on public.log_entries for insert
  with check (auth.uid() = user_id);

drop policy if exists "log_entries_update_own" on public.log_entries;
create policy "log_entries_update_own"
  on public.log_entries for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "log_entries_delete_own" on public.log_entries;
create policy "log_entries_delete_own"
  on public.log_entries for delete
  using (auth.uid() = user_id);

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
  on public.user_settings for select
  using (auth.uid() = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own"
  on public.user_settings for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own"
  on public.user_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "allowed_users_select_authenticated" on public.allowed_users;
create policy "allowed_users_select_authenticated"
  on public.allowed_users for select
  to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));
