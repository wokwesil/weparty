import "server-only";
import { sql } from "../db";

/**
 * Site analytics for the owner dashboard (/admin).
 *
 * Every page sends a "view" when it opens and a "ping" every ~25 seconds while
 * it is on screen. A visitor counts as "live now" if we heard from them in the
 * last LIVE_SECONDS. No IP addresses are stored; location is the rough
 * country/region/city Vercel attaches to each request.
 */
export const LIVE_SECONDS = 70;
/** A new "visit" starts after this many minutes away. */
const SESSION_GAP_MINUTES = 30;
/** Page views older than this are deleted (visitor summaries are kept). */
const KEEP_DAYS = 180;

const BOT_UA = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|headless|lighthouse|vercel-screenshot|monitor|curl|wget|python|node-fetch|axios/i;

export function isBot(ua: string) {
  return !ua || BOT_UA.test(ua);
}

export function parseUserAgent(ua: string): { device: string; browser: string } {
  const device = /WePartyApp|Capacitor/i.test(ua)
    ? "App"
    : /iPad|Tablet|(Android(?!.*Mobile))/i.test(ua)
      ? "Tablet"
      : /iPhone|iPod|Android.*Mobile|Mobile/i.test(ua)
        ? "Phone"
        : "Computer";
  const browser = /Instagram/i.test(ua)
    ? "Instagram"
    : /FBAN|FBAV/i.test(ua)
      ? "Facebook"
      : /SamsungBrowser/i.test(ua)
        ? "Samsung"
        : /Edg\//i.test(ua)
          ? "Edge"
          : /CriOS|Chrome\//i.test(ua)
            ? "Chrome"
            : /FxiOS|Firefox\//i.test(ua)
              ? "Firefox"
              : /Safari\//i.test(ua)
                ? "Safari"
                : "Other";
  return { device, browser };
}

/** Keeps only the site name of an outside referrer, e.g. "instagram.com". */
export function cleanReferrer(ref: string, ownHost: string): string | null {
  try {
    const u = new URL(ref);
    const host = u.hostname.replace(/^www\.|^l\.|^lm\.|^m\./, "").toLowerCase();
    if (!host || host === ownHost.toLowerCase().replace(/^www\./, "")) return null;
    return host.slice(0, 200);
  } catch {
    return null;
  }
}

/** "/e/abc123/pick?x=1" → "/e/abc123/pick". Returns null for paths we don't track. */
export function cleanPath(p: string): string | null {
  if (typeof p !== "string" || !p.startsWith("/")) return null;
  const path = p.split(/[?#]/)[0].slice(0, 300);
  if (path.startsWith("/api") || path.startsWith("/admin") || path.startsWith("/_next")) return null;
  // Password-reset links carry a secret; never store it.
  if (path.startsWith("/host/reset")) return "/host/reset";
  return path;
}

export function eventCodeFromPath(path: string) {
  const m = /^\/e\/([a-z0-9]{4,16})(\/|$)/.exec(path);
  return m ? m[1] : null;
}

export type Hit = {
  visitorId: string;
  path: string;
  kind: "view" | "ping";
  referrer: string | null;
  device: string;
  browser: string;
  country: string | null;
  region: string | null;
  city: string | null;
  hostId: string | null;
  guestId: string | null;
  eventCode: string | null;
};

export async function recordHit(h: Hit) {
  const view = h.kind === "view";
  // Pings closer than 10 seconds apart are ignored, which also limits abuse.
  const rows = await sql<{ new_visit: boolean }[]>`
    insert into site_visitors (visitor_id, page_views, current_path, current_event_code, device, browser,
                               country, region, city, first_referrer, host_id, guest_id)
    values (${h.visitorId}, ${view ? 1 : 0}, ${h.path}, ${h.eventCode}, ${h.device}, ${h.browser},
            ${h.country}, ${h.region}, ${h.city}, ${h.referrer}, ${h.hostId}, ${h.guestId})
    on conflict (visitor_id) do update set
      visits = site_visitors.visits + case when site_visitors.last_seen_at < now() - make_interval(mins => ${SESSION_GAP_MINUTES}) then 1 else 0 end,
      session_started_at = case when site_visitors.last_seen_at < now() - make_interval(mins => ${SESSION_GAP_MINUTES}) then now() else site_visitors.session_started_at end,
      last_seen_at = now(),
      page_views = site_visitors.page_views + ${view ? 1 : 0},
      current_path = excluded.current_path,
      current_event_code = excluded.current_event_code,
      device = excluded.device,
      browser = excluded.browser,
      country = coalesce(excluded.country, site_visitors.country),
      region = coalesce(excluded.region, site_visitors.region),
      city = coalesce(excluded.city, site_visitors.city),
      first_referrer = coalesce(site_visitors.first_referrer, excluded.first_referrer),
      host_id = coalesce(excluded.host_id, site_visitors.host_id),
      guest_id = coalesce(excluded.guest_id, site_visitors.guest_id)
    where ${view} or site_visitors.last_seen_at < now() - interval '10 seconds'
    returning (xmax = 0 or session_started_at = last_seen_at) as new_visit`;
  if (view) {
    await sql`
      insert into site_page_views (visitor_id, path, referrer, event_code, new_visit)
      values (${h.visitorId}, ${h.path}, ${h.referrer}, ${h.eventCode}, ${rows[0]?.new_visit ?? false})`;
    if (Math.random() < 0.01) {
      await sql`delete from site_page_views where created_at < now() - make_interval(days => ${KEEP_DAYS})`;
    }
  }
}

export async function isPlatformAdmin(hostId: string | null) {
  if (!hostId) return false;
  const [row] = await sql<{ ok: boolean }[]>`select is_platform_admin as ok from hosts where id = ${hostId}`;
  return Boolean(row?.ok);
}

async function safeTz(tz: string | null) {
  if (!tz || !/^[A-Za-z_]+(\/[A-Za-z0-9_+-]+){0,2}$/.test(tz)) return "UTC";
  const [ok] = await sql`select 1 from pg_timezone_names where name = ${tz}`;
  return ok ? tz : "UTC";
}

export type Person = {
  visitorId: string;
  who: string;
  kind: "host" | "guest" | "visitor";
  instagram: string | null;
  path: string | null;
  party: string | null;
  partyCode: string | null;
  device: string | null;
  browser: string | null;
  place: string | null;
  referrer: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  sessionStartedAt: string;
  visits: number;
  pageViews: number;
  live: boolean;
};

type PersonRow = {
  visitor_id: string;
  host_name: string | null;
  guest_name: string | null;
  instagram: string | null;
  current_path: string | null;
  event_name: string | null;
  current_event_code: string | null;
  device: string | null;
  browser: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  first_referrer: string | null;
  first_seen_at: Date;
  last_seen_at: Date;
  session_started_at: Date;
  visits: number;
  page_views: number;
  live: boolean;
};

function toPerson(r: PersonRow): Person {
  const kind = r.host_name ? "host" : r.guest_name ? "guest" : "visitor";
  return {
    visitorId: r.visitor_id,
    who: r.host_name ?? r.guest_name ?? `Visitor ${r.visitor_id.slice(0, 4).toUpperCase()}`,
    kind,
    instagram: r.instagram,
    path: r.current_path,
    party: r.event_name,
    partyCode: r.current_event_code,
    device: r.device,
    browser: r.browser,
    place: [r.city, r.region, r.country].filter(Boolean).join(", ") || null,
    referrer: r.first_referrer,
    firstSeenAt: r.first_seen_at.toISOString(),
    lastSeenAt: r.last_seen_at.toISOString(),
    sessionStartedAt: r.session_started_at.toISOString(),
    visits: r.visits,
    pageViews: r.page_views,
    live: r.live,
  };
}

const personSelect = sql`
  select v.visitor_id, h.display_name as host_name, g.display_name as guest_name, g.instagram_username as instagram,
         v.current_path, e.name as event_name, v.current_event_code, v.device, v.browser, v.country, v.region, v.city,
         v.first_referrer, v.first_seen_at, v.last_seen_at, v.session_started_at, v.visits, v.page_views,
         (v.last_seen_at > now() - make_interval(secs => ${LIVE_SECONDS})) as live
  from site_visitors v
  left join hosts h on h.id = v.host_id
  left join guests g on g.id = v.guest_id
  left join events e on e.code = v.current_event_code`;

export async function getDashboard(tzInput: string | null) {
  const tz = await safeTz(tzInput);
  const liveRows = await sql<PersonRow[]>`
    ${personSelect}
    where v.last_seen_at > now() - make_interval(secs => ${LIVE_SECONDS})
    order by v.last_seen_at desc limit 200`;
  const recentRows = await sql<PersonRow[]>`${personSelect} order by v.last_seen_at desc limit 60`;

  const [totals] = await sql<
    {
      live: number;
      visitors_today: number;
      visitors_7d: number;
      visitors_30d: number;
      visitors_all: number;
      new_today: number;
      views_today: number;
      views_7d: number;
      visits_today: number;
      returning_7d: number;
    }[]
  >`
    with today as (select (date_trunc('day', now() at time zone ${tz}) at time zone ${tz}) as t)
    select
      (select count(*)::int from site_visitors where last_seen_at > now() - make_interval(secs => ${LIVE_SECONDS})) as live,
      (select count(distinct visitor_id)::int from site_page_views, today where created_at >= today.t) as visitors_today,
      (select count(distinct visitor_id)::int from site_page_views where created_at >= now() - interval '7 days') as visitors_7d,
      (select count(distinct visitor_id)::int from site_page_views where created_at >= now() - interval '30 days') as visitors_30d,
      (select count(*)::int from site_visitors) as visitors_all,
      (select count(*)::int from site_visitors, today where first_seen_at >= today.t) as new_today,
      (select count(*)::int from site_page_views, today where created_at >= today.t) as views_today,
      (select count(*)::int from site_page_views where created_at >= now() - interval '7 days') as views_7d,
      (select count(*)::int from site_page_views, today where created_at >= today.t and new_visit) as visits_today,
      (select count(*)::int from site_visitors where last_seen_at >= now() - interval '7 days' and visits > 1) as returning_7d`;

  const daily = await sql<{ day: string; visitors: number; views: number }[]>`
    with days as (
      select generate_series(date_trunc('day', now() at time zone ${tz}) - interval '29 days',
                             date_trunc('day', now() at time zone ${tz}), interval '1 day') as d
    )
    select to_char(days.d, 'YYYY-MM-DD') as day,
           count(distinct pv.visitor_id)::int as visitors,
           count(pv.id)::int as views
    from days
    left join site_page_views pv
      on pv.created_at >= (days.d at time zone ${tz}) and pv.created_at < ((days.d + interval '1 day') at time zone ${tz})
    group by days.d order by days.d`;

  const hourly = await sql<{ hour: string; visitors: number }[]>`
    with hours as (
      select generate_series(date_trunc('hour', now()) - interval '23 hours', date_trunc('hour', now()), interval '1 hour') as h
    )
    select to_char(hours.h at time zone ${tz}, 'HH24') as hour, count(distinct pv.visitor_id)::int as visitors
    from hours left join site_page_views pv on pv.created_at >= hours.h and pv.created_at < hours.h + interval '1 hour'
    group by hours.h order by hours.h`;

  const topPages = await sql<{ label: string; count: number }[]>`
    select case
             when path = '/' then 'Home page'
             when path ~ '^/e/[^/]+/?$' then 'Party welcome'
             when path ~ '^/e/[^/]+/join' then 'Party: join'
             when path ~ '^/e/[^/]+/pick' then 'Party: pick songs'
             when path ~ '^/e/[^/]+/party' then 'Party: live queue'
             when path ~ '^/e/[^/]+/replay' then 'Party: replay'
             when path ~ '^/host/events/[^/]+/poster' then 'Host: QR poster'
             when path ~ '^/host/events/[^/]+/insights' then 'Host: insights'
             when path ~ '^/host/events/' then 'Host: control room'
             when path = '/host' then 'Host dashboard'
             when path = '/support' then 'Help page'
             when path = '/privacy' then 'Privacy page'
             else path end as label,
           count(distinct visitor_id)::int as count
    from site_page_views where created_at >= now() - interval '7 days'
    group by 1 order by 2 desc limit 10`;

  const referrers = await sql<{ label: string; count: number }[]>`
    select coalesce(first_referrer, 'Direct / QR code') as label, count(*)::int as count
    from site_visitors where first_seen_at >= now() - interval '30 days'
    group by 1 order by 2 desc limit 8`;

  const places = await sql<{ label: string; count: number }[]>`
    select coalesce(nullif(concat_ws(', ', city, country), ''), 'Unknown') as label, count(*)::int as count
    from site_visitors where last_seen_at >= now() - interval '30 days'
    group by 1 order by 2 desc limit 8`;

  const devices = await sql<{ label: string; count: number }[]>`
    select coalesce(device, 'Unknown') as label, count(*)::int as count
    from site_visitors where last_seen_at >= now() - interval '30 days'
    group by 1 order by 2 desc`;

  const parties = await sql<
    { code: string; name: string; status: string; guests: number; online: number; joined_today: number; created_at: Date }[]
  >`
    with today as (select (date_trunc('day', now() at time zone ${tz}) at time zone ${tz}) as t)
    select e.code, e.name, e.status, e.created_at,
           (select count(*)::int from guests g where g.event_id = e.id) as guests,
           (select count(*)::int from site_visitors v where v.current_event_code = e.code
              and v.last_seen_at > now() - make_interval(secs => ${LIVE_SECONDS})) as online,
           (select count(*)::int from guests g, today where g.event_id = e.id and g.created_at >= today.t) as joined_today
    from events e
    where e.status <> 'ended'
       or exists (select 1 from site_visitors v where v.current_event_code = e.code and v.last_seen_at > now() - interval '1 day')
    order by online desc, e.created_at desc limit 20`;

  const [platform] = await sql<{ hosts: number; events: number; guests: number; songs: number }[]>`
    select (select count(*)::int from hosts) as hosts,
           (select count(*)::int from events) as events,
           (select count(*)::int from guests) as guests,
           (select count(*)::int from queue_items) as songs`;

  return {
    generatedAt: new Date().toISOString(),
    timeZone: tz,
    liveSeconds: LIVE_SECONDS,
    totals: {
      live: totals.live,
      visitorsToday: totals.visitors_today,
      visitors7d: totals.visitors_7d,
      visitors30d: totals.visitors_30d,
      visitorsAll: totals.visitors_all,
      newToday: totals.new_today,
      viewsToday: totals.views_today,
      views7d: totals.views_7d,
      visitsToday: totals.visits_today,
      returning7d: totals.returning_7d,
    },
    platform,
    live: liveRows.map(toPerson),
    recent: recentRows.map(toPerson),
    daily: [...daily],
    hourly: [...hourly],
    topPages: [...topPages],
    referrers: [...referrers],
    places: [...places],
    devices: [...devices],
    parties: parties.map((p) => ({
      code: p.code,
      name: p.name,
      status: p.status,
      guests: p.guests,
      online: p.online,
      joinedToday: p.joined_today,
    })),
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;
