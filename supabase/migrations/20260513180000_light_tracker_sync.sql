-- Light tracker cloud sync: tables, columns, and RLS for personal Google sign-in.
-- Safe to re-run when tables already exist from an older schema.

create table if not exists public.allowed_users (
  email text primary key
);

create table if not exists public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null
);

alter table public.foods add column if not exists external_id text;
alter table public.foods add column if not exists unit text default 'g';
alter table public.foods add column if not exists default_grams numeric default 100;
alter table public.foods add column if not exists serving_size numeric;
alter table public.foods add column if not exists serving_unit text;
alter table public.foods add column if not exists default_serving_size numeric;
alter table public.foods add column if not exists cal100 numeric default 0;
alter table public.foods add column if not exists prot100 numeric default 0;
alter table public.foods add column if not exists carb100 numeric default 0;
alter table public.foods add column if not exists fat100 numeric default 0;
alter table public.foods add column if not exists calories numeric default 0;
alter table public.foods add column if not exists carbs_g numeric default 0;
alter table public.foods add column if not exists protein_g numeric default 0;
alter table public.foods add column if not exists fat_g numeric default 0;
alter table public.foods add column if not exists created_at timestamptz default now();
alter table public.foods add column if not exists updated_at timestamptz default now();

update public.foods set unit = 'g' where unit is null;
update public.foods set default_grams = 100 where default_grams is null;
update public.foods set cal100 = 0 where cal100 is null;
update public.foods set prot100 = 0 where prot100 is null;
update public.foods set carb100 = 0 where carb100 is null;
update public.foods set fat100 = 0 where fat100 is null;
update public.foods set created_at = now() where created_at is null;
update public.foods set updated_at = now() where updated_at is null;
update public.foods set calories = coalesce(calories, cal100, 0) where calories is null;
update public.foods set carbs_g = coalesce(carbs_g, carb100, 0) where carbs_g is null;
update public.foods set protein_g = coalesce(protein_g, prot100, 0) where protein_g is null;
update public.foods set fat_g = coalesce(fat_g, fat100, 0) where fat_g is null;

create unique index if not exists foods_user_external_id_idx
  on public.foods (user_id, external_id)
  where external_id is not null;

create table if not exists public.log_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  meal text not null,
  name text not null
);

alter table public.log_entries add column if not exists food_external_id text;
alter table public.log_entries add column if not exists quantity numeric;
alter table public.log_entries add column if not exists unit text;
alter table public.log_entries add column if not exists grams numeric;
alter table public.log_entries add column if not exists calories numeric default 0;
alter table public.log_entries add column if not exists protein numeric default 0;
alter table public.log_entries add column if not exists carbs numeric default 0;
alter table public.log_entries add column if not exists fat numeric default 0;
alter table public.log_entries add column if not exists created_at timestamptz default now();
alter table public.log_entries add column if not exists updated_at timestamptz default now();

update public.log_entries set calories = 0 where calories is null;
update public.log_entries set protein = 0 where protein is null;
update public.log_entries set carbs = 0 where carbs is null;
update public.log_entries set fat = 0 where fat is null;
update public.log_entries set created_at = now() where created_at is null;
update public.log_entries set updated_at = now() where updated_at is null;

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
