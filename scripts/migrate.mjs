// Applies every SQL file in supabase/migrations in order.
// Usage: DATABASE_URL=postgres://... npm run db:migrate
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. See docs/SETUP.md.");
  process.exit(1);
}
const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
const dir = path.join(process.cwd(), "supabase", "migrations");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  const version = file.replace(/\.sql$/, "");
  let done = false;
  try {
    const rows = await sql`select 1 from schema_migrations where version = ${version}`;
    done = rows.length > 0;
  } catch {
    done = false; // table does not exist yet
  }
  if (done) {
    console.log(`✓ ${file} (already applied)`);
    continue;
  }
  await sql.unsafe(fs.readFileSync(path.join(dir, file), "utf8"));
  await sql`insert into schema_migrations (version) values (${version}) on conflict do nothing`;
  console.log(`✓ ${file} applied`);
}
await sql.end();
