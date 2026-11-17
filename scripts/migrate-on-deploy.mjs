// Runs the database updates (supabase/migrations) automatically when Vercel
// builds the PRODUCTION site, before the new version goes live. If an update
// fails, the build fails and the old version stays live, so the site never
// runs code against a database that isn't ready.
//
// Skipped for preview builds and local builds (they must not change the live
// database). Set RUN_MIGRATIONS=1 to force it, or SKIP_MIGRATIONS=1 to skip.
import { spawnSync } from "node:child_process";

const isProd = process.env.VERCEL_ENV === "production";
const forced = process.env.RUN_MIGRATIONS === "1";
if (process.env.SKIP_MIGRATIONS === "1" || (!isProd && !forced)) {
  console.log("Database updates: skipped (not a production deploy).");
  process.exit(0);
}
if (!process.env.DATABASE_URL) {
  console.error("Database updates: DATABASE_URL is not set for this build. See docs/SETUP.md.");
  process.exit(1);
}
console.log("Database updates: applying supabase/migrations ...");
const r = spawnSync(process.execPath, ["scripts/migrate.mjs"], { stdio: "inherit" });
process.exit(r.status ?? 1);
