/**
 * Owner dashboard analytics against a real Postgres database.
 * Run with: TEST_DATABASE_URL=postgres://... npm test
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;
process.env.DATABASE_URL = url ?? "";

let a: typeof import("../../src/lib/services/analytics");
let sql: typeof import("../../src/lib/db").sql;

const hit = (visitorId: string, path: string, kind: "view" | "ping" = "view") => ({
  visitorId,
  path,
  kind,
  referrer: kind === "view" ? "instagram.com" : null,
  device: "Phone",
  browser: "Safari",
  country: "US",
  region: "GA",
  city: "Atlanta",
  hostId: null,
  guestId: null,
  eventCode: null,
});

d("Site analytics (database)", () => {
  const v1 = `test-${Date.now()}-a`;
  const v2 = `test-${Date.now()}-b`;

  beforeAll(async () => {
    a = await import("../../src/lib/services/analytics");
    sql = (await import("../../src/lib/db")).sql;
  });
  afterAll(async () => {
    await sql`delete from site_page_views where visitor_id in (${v1}, ${v2})`;
    await sql`delete from site_visitors where visitor_id in (${v1}, ${v2})`;
    await sql.end();
  });

  it("counts views, pings and live visitors", async () => {
    await a.recordHit(hit(v1, "/"));
    await a.recordHit(hit(v1, "/host"));
    await a.recordHit(hit(v1, "/host", "ping")); // too soon after a view: ignored
    await a.recordHit(hit(v2, "/"));
    const [row] = await sql<{ page_views: number; visits: number; first_referrer: string }[]>`
      select page_views, visits, first_referrer from site_visitors where visitor_id = ${v1}`;
    expect(row).toMatchObject({ page_views: 2, visits: 1, first_referrer: "instagram.com" });

    const dash = await a.getDashboard("America/New_York");
    expect(dash.live.map((p) => p.visitorId)).toEqual(expect.arrayContaining([v1, v2]));
    expect(dash.totals.live).toBeGreaterThanOrEqual(2);
    expect(dash.totals.viewsToday).toBeGreaterThanOrEqual(3);
    expect(dash.daily).toHaveLength(30);
    expect(dash.hourly).toHaveLength(24);
    expect(dash.live.find((p) => p.visitorId === v1)?.place).toBe("Atlanta, GA, US");
  });

  it("starts a new visit after 30 minutes away and drops out of live", async () => {
    await sql`update site_visitors set last_seen_at = now() - interval '2 hours' where visitor_id = ${v2}`;
    let dash = await a.getDashboard(null);
    expect(dash.live.some((p) => p.visitorId === v2)).toBe(false);
    await a.recordHit(hit(v2, "/e/abcd"));
    const [row] = await sql<{ visits: number }[]>`select visits from site_visitors where visitor_id = ${v2}`;
    expect(row.visits).toBe(2);
    dash = await a.getDashboard("Not/A_Real_Zone");
    expect(dash.live.some((p) => p.visitorId === v2)).toBe(true);
  });

  it("cleans paths, referrers and user agents", () => {
    expect(a.cleanPath("/e/abc123/pick?x=1")).toBe("/e/abc123/pick");
    expect(a.cleanPath("/admin")).toBeNull();
    expect(a.cleanPath("/api/track")).toBeNull();
    expect(a.cleanPath("/host/reset/secret-token")).toBe("/host/reset");
    expect(a.cleanReferrer("https://l.instagram.com/?u=x", "weparty-one.vercel.app")).toBe("instagram.com");
    expect(a.cleanReferrer("https://weparty-one.vercel.app/e/x", "weparty-one.vercel.app")).toBeNull();
    expect(a.isBot("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(a.parseUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit Version/18.0 Mobile/15E148 Safari/604.1")).toEqual({ device: "Phone", browser: "Safari" });
  });
});
