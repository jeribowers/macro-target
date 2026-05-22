-- Cap feedback submissions at 2 per user per rolling 24 hours.
-- Enforced via a BEFORE INSERT trigger so the limit can't be bypassed from the client.

create or replace function public.enforce_feedback_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
begin
  if new.user_id is null then
    return new;
  end if;

  select count(*) into recent_count
  from public.feedback
  where user_id = new.user_id
    and created_at > now() - interval '24 hours';

  if recent_count >= 2 then
    raise exception 'You can send up to 2 feedback messages per day. Please try again tomorrow.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists feedback_rate_limit on public.feedback;
create trigger feedback_rate_limit
  before insert on public.feedback
  for each row
  execute function public.enforce_feedback_rate_limit();
