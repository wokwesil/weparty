-- WeParty database schema, version 3: payments (Song Boosts, DJ Tips, Plans)
-- and the sponsor slot. Everything here stays switched off until the
-- FEATURE_PAYMENTS / FEATURE_PLANS / FEATURE_SPONSOR settings are turned on in
-- Vercel. Card details are never stored: Stripe Checkout handles cards.
-- Same security model: RLS on, no public policies.

-- Organizations: Stripe Connect (so DJs/hosts get paid out) and plans ------
alter table organizations add column if not exists stripe_account_id text;
alter table organizations add column if not exists payouts_enabled boolean not null default false;
alter table organizations add column if not exists stripe_subscription_id text;
alter table organizations add column if not exists plan_status text;
alter table organizations drop constraint if exists organizations_plan_check;
alter table organizations add constraint organizations_plan_check
  check (plan in ('free','pro','dj_pro','venue','enterprise'));

-- Event Pass: a one-time upgrade for one big event (weddings, galas) -------
alter table events add column if not exists event_pass boolean not null default false;

-- Paid Song Boosts add to a song's score (shown as "Boosted") ---------------
alter table queue_items add column if not exists boost_cents integer not null default 0 check (boost_cents >= 0);

-- Every payment attempt. Only Stripe ids and amounts; never card details ----
create table if not exists payments (
  id                 uuid primary key default gen_random_uuid(),
  kind               text not null check (kind in ('boost','tip','plan','event_pass')),
  status             text not null default 'pending' check (status in ('pending','paid','failed','canceled','refunded')),
  amount_cents       integer not null check (amount_cents > 0),
  currency           text not null default 'usd' check (char_length(currency) = 3),
  platform_fee_cents integer not null default 0 check (platform_fee_cents >= 0),
  org_id             uuid references organizations(id) on delete set null,
  event_id           uuid references events(id) on delete set null,
  guest_id           uuid references guests(id) on delete set null,
  host_id            uuid references hosts(id) on delete set null,
  queue_item_id      uuid references queue_items(id) on delete set null,
  plan               text,
  stripe_session_id  text unique,
  stripe_payment_intent text,
  created_at         timestamptz not null default now(),
  paid_at            timestamptz
);
create index if not exists payments_event_idx on payments (event_id, created_at desc);
create index if not exists payments_org_idx on payments (org_id, created_at desc);

-- Stripe sends each webhook at least once; remember which we handled -------
create table if not exists stripe_events (
  id         text primary key,
  type       text not null,
  created_at timestamptz not null default now()
);

alter table payments      enable row level security;
alter table stripe_events enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on all tables in schema public from authenticated';
  end if;
end $$;

insert into schema_migrations (version) values ('0003_payments') on conflict do nothing;
