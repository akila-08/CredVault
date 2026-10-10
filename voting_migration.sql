create table if not exists public.issuer_registry1 (
  id uuid primary key default gen_random_uuid(), name text not null,
  wallet_address text not null unique, contact_email text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','removed')),
  proposal_id bigint, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.issuer_proposals1 (
  proposal_id bigint primary key, candidate_wallet text not null, is_removal boolean not null default false,
  proposer_wallet text not null, status text not null default 'open' check (status in ('open','approved','rejected')),
  approvals int not null default 0, rejections int not null default 0, required int not null,
  total_validators int not null, created_tx_hash text, resolved_tx_hash text,
  created_at timestamptz not null default now(), resolved_at timestamptz
);
create table if not exists public.issuer_votes1 (
  id uuid primary key default gen_random_uuid(), proposal_id bigint not null references public.issuer_proposals1(proposal_id) on delete cascade,
  validator_wallet text not null, approve boolean not null, tx_hash text not null,
  created_at timestamptz not null default now(), unique (proposal_id, validator_wallet)
);
create table if not exists public.validators1 (
  wallet_address text primary key, label text, created_at timestamptz not null default now()
);
create index if not exists issuer_proposals1_candidate_idx on public.issuer_proposals1 (candidate_wallet);
create index if not exists issuer_proposals1_status_idx on public.issuer_proposals1 (status);
create index if not exists issuer_votes1_proposal_idx on public.issuer_votes1 (proposal_id);
