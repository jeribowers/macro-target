-- User profile (personalization targets) stored as jsonb on user_settings.
alter table public.user_settings
  add column if not exists user_profile jsonb;
