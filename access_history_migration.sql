alter table if exists public.verifiers
  add column if not exists is_active boolean not null default true;

alter table if exists public.verifiers
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.access_history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('university', 'verifier')),
  entity_id text,
  entity_key text not null,
  action text not null check (action in ('access_added', 'access_removed', 'access_restored')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists access_history_entity_type_idx
  on public.access_history (entity_type);

create index if not exists access_history_entity_key_idx
  on public.access_history (entity_key);

create index if not exists access_history_created_at_idx
  on public.access_history (created_at desc);

create index if not exists verifiers_active_idx
  on public.verifiers (is_active);

create index if not exists verifiers_email_idx
  on public.verifiers (lower(email));
