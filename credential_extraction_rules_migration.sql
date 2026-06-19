create table if not exists credential_extraction_rules (
    id uuid primary key default gen_random_uuid(),
    university_wallet text not null,
    field_name text not null,
    aliases jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (university_wallet, field_name),
    constraint credential_extraction_rules_field_check
        check (field_name in ('student_name', 'register_number', 'degree', 'branch', 'issue_date'))
);

create index if not exists credential_extraction_rules_wallet_idx
    on credential_extraction_rules (university_wallet);

alter table credential_extraction_rules enable row level security;

-- Backend uses the service role key, so API access is controlled by Express auth.
-- Add stricter Supabase policies later if this table is ever accessed directly from the browser.
