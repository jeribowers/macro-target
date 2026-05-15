-- Retain Daily Log rows in Supabase for 30 rolling days (UTC calendar).
-- Deletes ONLY log_entries and daily_activity_levels (per-day activity).
-- Food Library (public.foods) and other tables are never modified by this migration.
-- Ongoing cleanup: clients call public.purge_expired_daily_logs_for_user() after sign-in.

-- One-time cleanup for all existing rows (runs as migration owner).
delete from public.log_entries
where log_date < (current_timestamp at time zone 'UTC')::date - 30;

delete from public.daily_activity_levels
where log_date < (current_timestamp at time zone 'UTC')::date - 30;

create or replace function public.purge_expired_daily_logs_for_user()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cutoff date := (current_timestamp at time zone 'UTC')::date - 30;
begin
  if uid is null then
    return;
  end if;

  delete from public.log_entries
  where user_id = uid and log_date < cutoff;

  delete from public.daily_activity_levels
  where user_id = uid and log_date < cutoff;
end;
$$;

comment on function public.purge_expired_daily_logs_for_user() is
  'Removes Daily Log entries and per-day activity only (log_entries, daily_activity_levels). Does not touch foods / Food Library.';

revoke all on function public.purge_expired_daily_logs_for_user() from public;
grant execute on function public.purge_expired_daily_logs_for_user() to authenticated;
