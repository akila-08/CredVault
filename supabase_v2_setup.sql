-- CredVault V2 bootstrap schema for a fresh Supabase project.
-- Backend access uses SUPABASE_SERVICE_ROLE_KEY; RLS blocks direct anon access.

create table if not exists public.credentials (
  id uuid primary key default gen_random_uuid(),
  document_hash text not null unique,
  credential_hash text not null unique,
  student_name text not null,
  student_email text not null,
  register_number text not null,
  degree text not null,
  branch text not null,
  institution text not null,
  university_wallet text not null,
  issue_date date not null,
  student_wallet text not null,
  tx_hash text not null,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'REVOKED')),
  certificate_url text not null,
  created_at timestamptz not null default now()
);
create index if not exists credentials_student_email_idx on public.credentials (lower(student_email));
create index if not exists credentials_student_wallet_idx on public.credentials (student_wallet);
create index if not exists credentials_university_wallet_idx on public.credentials (university_wallet);

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

create table if not exists public.access_history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('university', 'verifier')),
  entity_id text,
  entity_key text not null,
  action text not null check (action in ('access_added', 'access_removed', 'access_restored')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists access_history_entity_type_idx on public.access_history (entity_type);
create index if not exists access_history_entity_key_idx on public.access_history (entity_key);
create index if not exists access_history_created_at_idx on public.access_history (created_at desc);

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  credential_id uuid not null references public.credentials(id) on delete cascade,
  student_email text not null,
  verifier_email text,
  verifier_name text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'expired')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists verification_requests_student_email_idx on public.verification_requests (lower(student_email));
create index if not exists verification_requests_verifier_email_idx on public.verification_requests (lower(verifier_email));
create index if not exists verification_requests_credential_id_idx on public.verification_requests (credential_id);
create index if not exists verification_requests_status_idx on public.verification_requests (status);

create table if not exists public.issuer_registry1 (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  wallet_address text not null unique check (wallet_address = lower(wallet_address)),
  contact_email text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'removed')),
  proposal_id bigint,
  rsa_public_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.issuer_proposals1 (
  proposal_id bigint primary key,
  candidate_wallet text not null,
  is_removal boolean not null default false,
  proposer_wallet text not null,
  status text not null default 'open' check (status in ('open', 'approved', 'rejected')),
  approvals integer not null default 0,
  rejections integer not null default 0,
  required integer not null,
  total_validators integer not null,
  created_tx_hash text,
  resolved_tx_hash text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists issuer_proposals1_candidate_idx on public.issuer_proposals1 (candidate_wallet);
create index if not exists issuer_proposals1_status_idx on public.issuer_proposals1 (status);

create table if not exists public.issuer_votes1 (
  id uuid primary key default gen_random_uuid(),
  proposal_id bigint not null references public.issuer_proposals1(proposal_id) on delete cascade,
  validator_wallet text not null,
  approve boolean not null,
  tx_hash text not null,
  created_at timestamptz not null default now(),
  unique (proposal_id, validator_wallet)
);
create index if not exists issuer_votes1_proposal_idx on public.issuer_votes1 (proposal_id);

create table if not exists public.validators1 (
  wallet_address text primary key check (wallet_address = lower(wallet_address)),
  label text,
  created_at timestamptz not null default now()
);

alter table public.credentials enable row level security;
alter table public.verifiers enable row level security;
alter table public.access_history enable row level security;
alter table public.verification_requests enable row level security;
alter table public.issuer_registry1 enable row level security;
alter table public.issuer_proposals1 enable row level security;
alter table public.issuer_votes1 enable row level security;
alter table public.validators1 enable row level security;

-- The Student Portal reads a student's credential rows with their Supabase Auth session.
drop policy if exists credentials_student_read on public.credentials;
create policy credentials_student_read on public.credentials
  for select to authenticated
  using (lower(student_email) = lower((select auth.jwt() ->> 'email')));
