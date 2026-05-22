-- In-app feedback collected from the "Send Feedback" modal.
-- Only the owner (service role / dashboard) can read; users can only insert their own row.

create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  message text not null,
  recommend boolean,
  share_email boolean not null default false,
  email text,
  app_version text,
  user_agent text,
  created_at timestamptz not null default now(),
  constraint feedback_message_length check (char_length(message) between 1 and 2000),
  constraint feedback_email_only_when_shared check (
    (share_email = true and email is not null and char_length(email) <= 320)
    or (share_email = false and email is null)
  )
);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

alter table public.feedback enable row level security;

drop policy if exists "feedback_insert_self" on public.feedback;
create policy "feedback_insert_self"
  on public.feedback for insert
  to authenticated
  with check (auth.uid() = user_id);

-- No SELECT / UPDATE / DELETE policies: feedback is read-only via service role
-- (Supabase dashboard / SQL editor). Clients can never read or modify rows.
