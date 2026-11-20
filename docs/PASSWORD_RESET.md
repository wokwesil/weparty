# Host "Forgot password?"

There are two ways a host gets back in:

1. **By email (hosts do it themselves).** On **/host/login** tap **Forgot password?**, type the host email,
   open the email, tap the link, type a new password twice, tap **Save and sign in**.
   This needs email switched on (one-time setup below).
2. **Owner reset link (works today, no setup).** The site owner opens **/admin** (Site dashboard), scrolls to
   **Reset a host's password**, types the host's email, taps **Make reset link**, and texts/DMs the link.
   The host opens it and picks a new password. Only platform admins can do this.

Until email is switched on, the Forgot password page tells the host honestly that email isn't on yet and
to contact `NEXT_PUBLIC_SUPPORT_EMAIL` (if set). It never pretends an email was sent.

Safety details:
- Every link works for **1 hour** and **only once** (all links stop working as soon as the password changes).
- The page never says whether an email has an account, so it can't be used to find out who hosts on WeParty.
- Limited to 3 requests per email and 10 per network every 15 minutes.
- The secret part of the link is after `#`, so it never shows up in server logs or analytics.
- Reset links are no longer written to Vercel Logs.
- No database change is needed. Links are signed with `SESSION_SECRET`.

## Switching on reset emails with Gmail (free, about 5 minutes)

Works with a normal Gmail account. No domain needed. Google allows about 500 emails a day.

1. Go to **myaccount.google.com > Security** and turn on **2-Step Verification** (if it isn't on).
2. Go to **myaccount.google.com/apppasswords**, type a name like `We Party`, tap **Create**,
   and copy the 16-letter password Google shows.
3. In **Vercel > your project > Settings > Environment Variables**, add:
   - `GMAIL_USER` = the Gmail address (e.g. `yourname@gmail.com`)
   - `GMAIL_APP_PASSWORD` = the 16 letters (spaces are fine)
4. Redeploy (Vercel > Deployments > ⋯ > Redeploy).
5. Test: sign out, tap **Forgot password?**, and type your own host email.

Emails come from that Gmail address with the name "We Party" (change with `EMAIL_FROM_NAME`).
If the app password is wrong, Vercel Logs show `[email] gmail send failed`.

## Or: Resend

Set `RESEND_API_KEY` and `EMAIL_FROM` instead. Resend can only email people other than you after you add
your own domain in **Resend > Domains**. If both Gmail and Resend are set, Gmail is used.

## Locked out yourself, before email is on? (Supabase only)

Supabase > **SQL Editor**, run this to see host accounts:

```sql
select email, display_name, created_at, last_login_at from hosts order by created_at;
```

To set a temporary password, ask Claude for a "password hash" for a temporary password, then run:

```sql
update hosts set password_hash = 'PASTE_HASH_HERE' where lower(email) = lower('you@example.com');
```

Sign in with the temporary password, then change it from the Site dashboard reset tool or Forgot password.

## Why not Supabase's built-in emails?

Supabase's free built-in email only sends to members of your Supabase team (not to other hosts) and only
a couple per hour. WeParty also has its own host accounts, not Supabase Auth accounts.

Note: signing in on a new phone doesn't sign out other devices. Host sessions last 30 days.
