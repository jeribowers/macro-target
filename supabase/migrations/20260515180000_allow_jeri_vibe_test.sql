insert into public.allowed_users (email)
values ('jeri.vibe.test@gmail.com')
on conflict (email) do nothing;
