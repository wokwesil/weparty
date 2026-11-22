-- Site analytics for the owner dashboard (/admin): who visits the website
-- and who is on it right now. No IP addresses are stored. A visitor is the
-- random id the browser already keeps for rate limits (wp_device).

create table if not exists site_visitors (
  visitor_id     text primary key check (visitor_id ~ '^[A-Za-z0-9_-]{8,64}$'),
  first_seen_at  timestamptz not null default now(),
  last_seen_at   timestamptz not null default now(),
  session_started_at timestamptz not null default now(),
  visits         integer not null default 1,
  page_views     integer not null default 0,
  current_path   text check (char_length(current_path) <= 300),
  current_event_code text check (char_length(current_event_code) <= 16),
  device         text check (char_length(device) <= 20),
  browser        text check (char_length(browser) <= 20),
  country        text check (char_length(country) <= 4),
  region         text check (char_length(region) <= 60),
  city           text check (char_length(city) <= 80),
  first_referrer text check (char_length(first_referrer) <= 200),
  host_id        uuid references hosts(id) on delete set null,
  guest_id       uuid references guests(id) on delete set null
);
create index if not exists site_visitors_last_seen_idx on site_visitors (last_seen_at desc);
create index if not exists site_visitors_first_seen_idx on site_visitors (first_seen_at desc);

create table if not exists site_page_views (
  id          bigint generated always as identity primary key,
  visitor_id  text not null,
  path        text not null check (char_length(path) <= 300),
  referrer    text check (char_length(referrer) <= 200),
  event_code  text check (char_length(event_code) <= 16),
  new_visit   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists site_page_views_created_idx on site_page_views (created_at desc);
create index if not exists site_page_views_visitor_idx on site_page_views (visitor_id, created_at desc);

alter table site_visitors   enable row level security;
alter table site_page_views enable row level security;

-- The owner dashboard is for platform admins only. Make the first host
-- account the admin if nobody is one yet (more can be added in Supabase:
-- update hosts set is_platform_admin = true where lower(email) = '...').
update hosts set is_platform_admin = true
where not exists (select 1 from hosts where is_platform_admin)
  and id = (select id from hosts order by created_at limit 1);
