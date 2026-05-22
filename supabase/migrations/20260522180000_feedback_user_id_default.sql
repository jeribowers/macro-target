-- Auto-populate feedback.user_id from the authenticated session.
-- Client no longer needs to send user_id; the DB fills it in from auth.uid(),
-- which guarantees it matches the value the RLS insert policy checks against.

alter table public.feedback alter column user_id set default auth.uid();
