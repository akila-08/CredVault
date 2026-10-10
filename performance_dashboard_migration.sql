-- Persist admin dashboard gas and search benchmark runs.
create table if not exists public.performance_runs (
  id uuid primary key default gen_random_uuid(),
  run_type text not null check (run_type in ('gas', 'search')),
  sample_count integer not null default 0,
  metrics jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists performance_runs_created_at_idx
  on public.performance_runs (created_at desc);

alter table public.performance_runs enable row level security;
