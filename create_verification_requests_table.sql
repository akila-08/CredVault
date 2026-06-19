alter table if exists public.credentials
  add column if not exists student_email text;

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null,
  student_email text not null,
  verifier_email text,
  verifier_name text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  created_at timestamp not null default now(),
  completed_at timestamp null
);

create index if not exists verification_requests_student_email_idx
  on public.verification_requests (lower(student_email));

create index if not exists verification_requests_verifier_email_idx
  on public.verification_requests (lower(verifier_email));

create index if not exists verification_requests_credential_id_idx
  on public.verification_requests (credential_id);

create index if not exists verification_requests_status_idx
  on public.verification_requests (status);
