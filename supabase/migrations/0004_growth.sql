-- We Party: growth + polish (PR 3). Safe to run twice. Run after 0003.
--
--  * follows: guests who opted in to hear about a DJ/host's next party by email.
--    Push notifications are NOT used. Each row keeps proof of consent and an
--    unsubscribe key.
--  * events.terms_*: which version of the host terms was accepted when the
--    event was created (only asked when FEATURE_TERMS=1).

create table if not exists follows (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,
  event_id          uuid references events(id) on delete set null,   -- where they followed from
  email             text not null check (char_length(email) between 3 and 254),
  instagram_username text check (instagram_username ~ '^[a-z0-9._]{1,30}$'),
  consent_text      text not null check (char_length(consent_text) <= 500),
  unsubscribe_hash  text not null,
  created_at        timestamptz not null default now(),
  unsubscribed_at   timestamptz
);
create unique index if not exists follows_org_email_uq on follows (org_id, lower(email));
create unique index if not exists follows_unsub_uq on follows (unsubscribe_hash);

alter table events add column if not exists terms_version text;
alter table events add column if not exists terms_accepted_at timestamptz;

alter table follows enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
  end if;
end $$;

insert into schema_migrations (version) values ('0004_growth') on conflict do nothing;
