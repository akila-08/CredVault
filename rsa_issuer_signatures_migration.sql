-- Per-university RSA public keys for verifying certificate hash signatures.
alter table public.issuer_registry1
  add column if not exists rsa_public_key text;
