import { sql } from "@/lib/db";
import { appleMusicConfigured, env, realtimeConfigured } from "@/lib/env";
import { checkAppleKey } from "@/lib/music/apple";
import { searchSource } from "@/lib/music/search";
import { api } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The newest database update this version of the app needs. */
const LATEST_MIGRATION = "0005_recovery_codes";

/** Quick check that the app and database are working. Shows no secrets. */
export const GET = api(async () => {
  await sql`select 1`;
  const rows = await sql<{ version: string }[]>`select version from schema_migrations where version = ${LATEST_MIGRATION}`.catch(() => []);
  const apple = appleMusicConfigured() ? await checkAppleKey() : null;
  return {
    ok: rows.length > 0,
    database: true,
    databaseUpToDate: rows.length > 0,
    ...(rows.length ? {} : { fix: `Run supabase/migrations/${LATEST_MIGRATION}.sql in the Supabase SQL editor.` }),
    realtime: realtimeConfigured(),
    appleMusic: appleMusicConfigured(),
    ...(apple ? { appleMusicKeyWorks: apple.works, ...(apple.problem ? { appleMusicProblem: apple.problem } : {}) } : {}),
    hostPlayer: appleMusicConfigured() && env.featureHostPlayer,
    search: searchSource(),
  };
});
