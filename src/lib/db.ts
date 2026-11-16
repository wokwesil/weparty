import "server-only";
import postgres from "postgres";
import { env } from "./env";

declare global {
  // eslint-disable-next-line no-var
  var __weparty_sql: postgres.Sql | undefined;
}

/**
 * One shared database connection pool.
 * On Vercel use Supabase's "Transaction pooler" connection string (port 6543);
 * `prepare: false` is required for that pooler.
 */
export const sql: postgres.Sql =
  globalThis.__weparty_sql ??
  postgres(env.databaseUrl || "postgres://localhost/weparty", {
    max: env.isProd ? 3 : 10,
    prepare: false,
    idle_timeout: 20,
    onnotice: () => {},
    transform: { undefined: null },
  });

if (!env.isProd) globalThis.__weparty_sql = sql;
