-- WeParty database schema, version 2: faster join, DJ Mode, reliability.
--
-- Plain English:
--   * Songs can now wait in a "pending" list until the DJ approves them
--     (approval mode), or be "declined" by the DJ.
--   * Songs remember their genre (for the DJ's Crowd Pulse panel).
--   * New tables: DJ blocklist, DJ shoutouts, DJ photo, join drop-off
--     tracking, guest reports, and a shared song-search cache.
--   * Same security model as version 1: Row Level Security is ON for every
--     new table with no public policies. Only the WeParty server can read or
--     write them.

-- Songs: pending/declined statuses and genre ------------------------------
alter table queue_items drop constraint if exists queue_items_status_check;
alter table queue_items add constraint queue_items_status_check
  check (status in ('pending','queued','playing','played','skipped','removed','declined'));
alter table queue_items add column if not exists genre text check (char_length(genre) <= 80);
alter table queue_items add column if not exists decided_at timestamptz;

-- Bumped every time something in the event changes. The server uses it to
-- reuse one queue snapshot for every phone instead of rebuilding it per phone.
alter table events add column if not exists version bigint not null default 0;
-- Bumped when the DJ uploads a Spotlight photo (so phones fetch the new one).
alter table events add column if not exists dj_photo_version integer not null default 0;

-- DJ blocklist: songs or artists the DJ never wants requested ----------------
create table if not exists event_blocklist (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references events(id) on delete cascade,
  kind       text not null check (kind in ('song','artist')),
  value      text not null check (char_length(value) between 1 and 300), -- apple song id, or lower-case artist name
  label      text not null check (char_length(label) between 1 and 300), -- what the DJ sees
  created_at timestamptz not null default now()
);
create unique index if not exists event_blocklist_uq on event_blocklist (event_id, kind, value);

-- DJ shoutouts: short messages pushed to every guest screen ------------------
create table if not exists event_shoutouts (
  id         bigint generated always as identity primary key,
  event_id   uuid not null references events(id) on delete cascade,
  message    text not null check (char_length(message) between 1 and 140),
  created_by uuid references hosts(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists event_shoutouts_event_idx on event_shoutouts (event_id, created_at desc);

-- DJ Spotlight photo (resized on the phone, like guest photos) ---------------
create table if not exists event_dj_photos (
  event_id   uuid primary key references events(id) on delete cascade,
  mime       text not null check (mime in ('image/jpeg','image/png','image/webp')),
  data       bytea not null check (octet_length(data) <= 400000),
  updated_at timestamptz not null default now()
);

-- Join drop-off tracking: one row per phone per step -------------------------
-- step: scanned -> profile -> picked -> joined. "device" is a random id the
-- phone makes up; it is not linked to any personal data.
create table if not exists join_funnel (
  event_id   uuid not null references events(id) on delete cascade,
  device     text not null check (device ~ '^[A-Za-z0-9_-]{8,64}$'),
  step       text not null check (step in ('scanned','profile','picked','joined')),
  created_at timestamptz not null default now(),
  primary key (event_id, device, step)
);

-- Guest reports (replaces the email-only report link) -----------------------
create table if not exists guest_reports (
  id          bigint generated always as identity primary key,
  event_id    uuid not null references events(id) on delete cascade,
  reporter_id uuid references guests(id) on delete set null,
  guest_id    uuid not null references guests(id) on delete cascade,
  reason      text not null check (char_length(reason) between 1 and 300),
  created_at  timestamptz not null default now()
);
create index if not exists guest_reports_event_idx on guest_reports (event_id, created_at desc);
create unique index if not exists guest_reports_once on guest_reports (reporter_id, guest_id);

-- Shared song-search cache, so 150 guests searching the same hits don't all
-- go out to Apple (Apple's free search allows ~20 searches a minute) --------
create table if not exists search_cache (
  key        text primary key,
  songs      jsonb not null,
  created_at timestamptz not null default now()
);

alter table event_blocklist enable row level security;
alter table event_shoutouts enable row level security;
alter table event_dj_photos enable row level security;
alter table join_funnel     enable row level security;
alter table guest_reports   enable row level security;
alter table search_cache    enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
  end if;
end $$;

insert into schema_migrations (version) values ('0002_join_djmode_reliability') on conflict do nothing;
