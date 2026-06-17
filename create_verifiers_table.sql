create table if not exists public.verifiers (
  id uuid primary key default gen_random_uuid(),
  organization_name text not null,
  email text not null unique,
  password_hash text not null,
  is_active boolean not null default true,
  password_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists verifiers_email_idx on public.verifiers (lower(email));
create index if not exists verifiers_active_idx on public.verifiers (is_active);
