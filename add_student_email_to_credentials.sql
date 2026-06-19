alter table if exists public.credentials
  add column if not exists student_email text;

create index if not exists credentials_student_email_idx
  on public.credentials (lower(student_email));
