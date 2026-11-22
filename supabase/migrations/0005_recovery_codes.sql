-- Recovery codes: a host can reset their own password with their email + a
-- saved recovery code, without any email service. Only a scrypt hash is stored.
alter table hosts add column if not exists recovery_code_hash text;
alter table hosts add column if not exists recovery_code_created_at timestamptz;
