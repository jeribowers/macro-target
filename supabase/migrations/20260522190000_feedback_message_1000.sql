-- Lower the feedback message length cap to match the client (1000 chars).

alter table public.feedback
  drop constraint if exists feedback_message_length;

alter table public.feedback
  add constraint feedback_message_length
  check (char_length(message) between 1 and 1000);
