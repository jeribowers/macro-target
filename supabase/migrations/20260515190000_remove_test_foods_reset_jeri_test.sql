-- Remove stray "test" foods from all accounts.
delete from public.foods
where lower(trim(coalesce(external_id, ''))) = 'test'
   or lower(trim(name)) = 'test';

-- Reset jeri.vibe.test@gmail.com so they can experience first-time onboarding again.
do $$
declare
  uid uuid;
begin
  select id into uid
  from auth.users
  where lower(email) = lower('jeri.vibe.test@gmail.com');

  if uid is null then
    raise notice 'User jeri.vibe.test@gmail.com not found in auth.users';
    return;
  end if;

  delete from public.log_entries where user_id = uid;
  delete from public.daily_activity_levels where user_id = uid;
  delete from public.foods where user_id = uid;
  delete from public.user_settings where user_id = uid;
end $$;
