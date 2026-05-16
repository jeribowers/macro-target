insert into public.allowed_users (email)
values ('hweissenbuehler@fordham.edu')
on conflict (email) do nothing;
