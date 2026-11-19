# Site dashboard (owner only)

**Link:** https://weparty-one.vercel.app/admin  (also a "Site dashboard" button on the host dashboard)

Shows, updating every 5 seconds:

- **On the site now**: everyone whose screen checked in during the last 70 seconds, with their name if they
  joined a party (guest) or are signed in (host), the page they're on, the party, rough location and device.
- Visitors today / 7 days / 30 days / all time, new vs returning, page views.
- Visitors per day (30 days) and per hour (24 hours).
- Parties: live parties with guests online now, total guests and guests joined today.
- Top pages, where visitors came from (Instagram, Google, direct/QR), locations, devices.
- Recent visitors (latest 60), searchable.

## Who can see it

Only host accounts marked as platform admin (`hosts.is_platform_admin`). Everyone else gets "page not found".
Migration `0004_site_analytics` makes the first host account the admin if nobody is one yet. To add another
admin, run in the Supabase SQL editor:

```sql
update hosts set is_platform_admin = true where lower(email) = 'their@email.com';
```

## How it works

- `src/components/SiteTracker.tsx` (on every page) sends a "view" when a page opens and a "ping" every 25 s
  while it's on screen, to `POST /api/track`. Uses the browser's random `wp_device` id. `/admin` and `/api`
  are never tracked; password-reset tokens are stripped from paths.
- `src/lib/services/analytics.ts` stores one row per visitor (`site_visitors`) and one per page view
  (`site_page_views`, deleted after 180 days). No IP addresses are stored; location comes from Vercel's
  `x-vercel-ip-*` headers. Bots and link previews are ignored.
- `GET /api/admin/stats?tz=...` returns the dashboard numbers (404 unless admin).
- Privacy page updated to describe this.

Tests: `tests/integration/analytics.test.ts` (needs `TEST_DATABASE_URL`).
