# Putting WeParty online (plain-English guide)

You need three free accounts: **GitHub** (stores the code), **Supabase** (the
database and live updates) and **Vercel** (the website host). Apple Music is
optional for the first party: song search works without it.

Total time: about 30 minutes.

## 1. Supabase (database)

1. Go to supabase.com, sign up, click **New project**. Name it `weparty`,
   pick a strong database password (save it), choose the region closest to the party.
2. When it's ready, open **SQL Editor → New query**, paste everything from
   `supabase/migrations/0001_init.sql`, and click **Run**. You should see "Success".
   Then do the same with each later file in that folder, in number order
   (`0002_join_djmode_reliability.sql`, then `0003_growth.sql`). Each one is safe to run twice.
3. Collect these values:
   - **Project Settings → Database → Connection string → Transaction pooler**.
     Copy the URI and replace `[YOUR-PASSWORD]` with your database password.
     This is `DATABASE_URL`.
   - **Project Settings → API**: the Project URL (`NEXT_PUBLIC_SUPABASE_URL`),
     the `anon` `public` key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) and the
     `service_role` key (`SUPABASE_SERVICE_ROLE_KEY`, keep this one secret).

Realtime "broadcast" is on by default in new Supabase projects, which is all
WeParty uses. If it's ever off, the app still works: phones re-check every 4 seconds.

## 2. Vercel (website)

1. Go to vercel.com, sign up with GitHub, click **Add New → Project**, and
   import the `weparty` repository.
2. Before clicking Deploy, open **Environment Variables** and add:

| Name | Value |
|---|---|
| `DATABASE_URL` | from Supabase step 3 |
| `SESSION_SECRET` | any random 40+ characters (e.g. mash the keyboard) |
| `NEXT_PUBLIC_APP_URL` | `https://<your-project>.vercel.app` (or your own domain) |
| `NEXT_PUBLIC_SUPABASE_URL` | from Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase |
| `HOST_SIGNUP_CODE` | optional: a word only you know, so strangers can't make host accounts |

3. Click **Deploy**. After it finishes, open `https://<your-project>.vercel.app/api/health`.
   You should see `"ok":true,"database":true`.

If you set `NEXT_PUBLIC_APP_URL` after the first deploy, redeploy once so QR
codes use the right address. **Print QR codes only after the final address is set.**

## 3. Create your first party

1. Open `https://<your-site>/host/signup` and create your host account.
2. Create an event. You land in the **control room**.
3. Tab **QR, details & export → Printable poster**, and print it.
4. Scan it with your phone to test, then do a full test with 2 or 3 friends.

## 4. Apple Music (when ready)

See [APPLE_MUSIC.md](APPLE_MUSIC.md). Add `APPLE_TEAM_ID`, `APPLE_KEY_ID` and
`APPLE_PRIVATE_KEY` in Vercel and redeploy. Nothing else changes.

## Custom domain

Vercel → Project → Settings → Domains. Then update `NEXT_PUBLIC_APP_URL` and redeploy.

## Environment variables reference

See `.env.example`. Variables starting with `NEXT_PUBLIC_` are safe to be seen by
browsers. Everything else stays on the server and is never sent to guests.
