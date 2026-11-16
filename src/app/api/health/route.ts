import { sql } from "@/lib/db";
import { appleMusicConfigured, realtimeConfigured } from "@/lib/env";
import { searchSource } from "@/lib/music/search";
import { api } from "@/lib/session";

export const dynamic = "force-dynamic";

/** Quick check that the app and database are working. Shows no secrets. */
export const GET = api(async () => {
  await sql`select 1`;
  return { ok: true, database: true, realtime: realtimeConfigured(), appleMusic: appleMusicConfigured(), search: searchSource() };
});
