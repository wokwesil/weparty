-- WeParty database schema, version 1
-- Run this once in the Supabase SQL editor (or with `npm run db:migrate`).
--
-- Security model (plain English):
--   * Guests and hosts never talk to the database directly. Every read and
--     write goes through the WeParty server, which checks who you are first.
--   * Row Level Security is switched ON for every table with NO public
--     policies, so Supabase's public "anon" key cannot read or change anything.
--   * Live updates are pushed with Supabase Realtime "broadcast" messages that
--     only say "the queue changed"; they never carry private data.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Accounts: organizations (a host, venue, DJ or agency) and their members.
-- Built for multiple hosts/venues and paid plans later (Phase 12).
-- ---------------------------------------------------------------------------
create table if not exists organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null check (char_length(name) between 1 and 120),
  kind          text not null default 'host' check (kind in ('host','venue','dj','agency','college')),
  plan          text not null default 'free' check (plan in ('free','pro','venue','enterprise')),
  plan_renews_at timestamptz,
  billing_customer_id text,           -- reserved for a payment provider later
  branding      jsonb not null default '{}'::jsonb, -- logo, colors (premium branding)
  created_at    timestamptz not null default now()
);

create table if not exists hosts (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  password_hash text not null,
  display_name  text not null check (char_length(display_name) between 1 and 80),
  is_platform_admin boolean not null default false,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);
create unique index if not exists hosts_email_uq on hosts (lower(email));

create table if not exists org_members (
  org_id   uuid not null references organizations(id) on delete cascade,
  host_id  uuid not null references hosts(id) on delete cascade,
  role     text not null default 'owner' check (role in ('owner','admin','dj')),
  created_at timestamptz not null default now(),
  primary key (org_id, host_id)
);
create index if not exists org_members_host_idx on org_members (host_id);

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------
create table if not exists events (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  code          text not null unique check (code ~ '^[a-z0-9]{4,16}$'), -- used in the QR link
  name          text not null check (char_length(name) between 1 and 120),
  venue_name    text check (char_length(venue_name) <= 120),
  description   text check (char_length(description) <= 1000),
  starts_at     timestamptz,
  status        text not null default 'live' check (status in ('draft','live','ended')),
  submissions_open boolean not null default true,
  settings      jsonb not null default '{}'::jsonb,   -- party shuffle settings
  replay_apple_playlist_url text,                    -- optional public Apple Music link set by host
  live_apple_playlist_id text,                       -- host library playlist used for Offtrack sync
  play_counter  integer not null default 0,           -- increments each time a song starts
  created_by    uuid references hosts(id) on delete set null,
  created_at    timestamptz not null default now(),
  ended_at      timestamptz
);
create index if not exists events_org_idx on events (org_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Guests (one row per person per event; no app download, no password)
-- ---------------------------------------------------------------------------
create table if not exists guests (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  token_hash    text not null,                    -- hash of the guest's private browser key
  display_name  text not null check (char_length(display_name) between 1 and 60),
  instagram_username text not null check (instagram_username ~ '^[a-z0-9._]{1,30}$'),
  has_avatar    boolean not null default false,
  avatar_version integer not null default 0,
  is_blocked    boolean not null default false,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
create unique index if not exists guests_event_ig_uq on guests (event_id, instagram_username);
create unique index if not exists guests_token_uq on guests (token_hash);
create index if not exists guests_event_idx on guests (event_id, created_at);

-- Profile photos are small (resized on the phone to 400x400 JPEG) and kept
-- in their own table so guest lists stay fast.
create table if not exists guest_avatars (
  guest_id   uuid primary key references guests(id) on delete cascade,
  mime       text not null check (mime in ('image/jpeg','image/png','image/webp')),
  data       bytea not null check (octet_length(data) <= 400000),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Songs in an event queue. One row per unique song per event (no duplicates).
-- If a second guest picks the same song it becomes an extra "request".
-- ---------------------------------------------------------------------------
create table if not exists queue_items (
  id            uuid primary key default gen_random_uuid(),
  event_id      uuid not null references events(id) on delete cascade,
  apple_song_id text not null check (char_length(apple_song_id) <= 64),
  title         text not null check (char_length(title) <= 300),
  artist        text not null check (char_length(artist) <= 300),
  album         text check (char_length(album) <= 300),
  artwork_url   text check (char_length(artwork_url) <= 1000),
  duration_ms   integer,
  isrc          text,
  apple_url     text check (char_length(apple_url) <= 1000),
  preview_url   text check (char_length(preview_url) <= 1000),
  explicit      boolean not null default false,
  submitted_by  uuid references guests(id) on delete set null,
  added_by_host boolean not null default false,
  status        text not null default 'queued' check (status in ('queued','playing','played','skipped','removed')),
  pinned_rank   double precision,   -- host override: lower = earlier; null = let the crowd decide
  created_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz,
  play_order    integer             -- 1,2,3... real order songs were played
);
create unique index if not exists queue_items_event_song_uq on queue_items (event_id, apple_song_id);
create index if not exists queue_items_event_status_idx on queue_items (event_id, status);
create unique index if not exists queue_items_one_playing on queue_items (event_id) where status = 'playing';

create table if not exists song_requests (
  queue_item_id uuid not null references queue_items(id) on delete cascade,
  guest_id      uuid not null references guests(id) on delete cascade,
  event_id      uuid not null references events(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (queue_item_id, guest_id)
);
create index if not exists song_requests_guest_idx on song_requests (guest_id);
create index if not exists song_requests_event_idx on song_requests (event_id);

-- One active heart per guest per song (the primary key prevents duplicates).
create table if not exists votes (
  queue_item_id uuid not null references queue_items(id) on delete cascade,
  guest_id      uuid not null references guests(id) on delete cascade,
  event_id      uuid not null references events(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (queue_item_id, guest_id)
);
create index if not exists votes_event_idx on votes (event_id);
create index if not exists votes_guest_idx on votes (guest_id);

-- Audit trail of host actions and key moments (also feeds analytics).
create table if not exists event_log (
  id         bigint generated always as identity primary key,
  event_id   uuid not null references events(id) on delete cascade,
  actor      text not null,          -- 'host:<id>', 'guest:<id>', 'system'
  action     text not null,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists event_log_event_idx on event_log (event_id, created_at);

-- Lightweight rate limiting buckets (protects search and registration).
create table if not exists rate_limits (
  bucket     text primary key,
  hits       integer not null,
  window_start timestamptz not null
);

-- ---------------------------------------------------------------------------
-- Row Level Security: ON everywhere, no public policies.
-- The WeParty server connects as the database owner and enforces permissions
-- in code; Supabase's public API keys get no access at all.
-- ---------------------------------------------------------------------------
alter table organizations enable row level security;
alter table hosts         enable row level security;
alter table org_members   enable row level security;
alter table events        enable row level security;
alter table guests        enable row level security;
alter table guest_avatars enable row level security;
alter table queue_items   enable row level security;
alter table song_requests enable row level security;
alter table votes         enable row level security;
alter table event_log     enable row level security;
alter table rate_limits   enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
  end if;
end $$;

create table if not exists schema_migrations (
  version text primary key,
  applied_at timestamptz not null default now()
);
alter table schema_migrations enable row level security;
insert into schema_migrations (version) values ('0001_init') on conflict do nothing;
