-- Own feedback identity fields in the database.
-- Clients may request email sharing, but cannot choose user_id or email.

create or replace function public.prepare_feedback_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.user_id := auth.uid();

  if new.share_email = true then
    new.email := nullif(auth.jwt() ->> 'email', '');
  else
    new.email := null;
  end if;

  return new;
end;
$$;

revoke all on function public.prepare_feedback_insert() from public;

drop trigger if exists feedback_prepare_insert on public.feedback;
create trigger feedback_prepare_insert
  before insert on public.feedback
  for each row
  execute function public.prepare_feedback_insert();
