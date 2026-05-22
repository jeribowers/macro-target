-- Drop the legacy allow-list table. Sign-in is now open to any Google account;
-- abuse is handled via Supabase auth bans + per-table rate limits.

drop table if exists public.allowed_users cascade;
