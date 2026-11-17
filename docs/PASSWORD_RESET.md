# Host "Forgot password?"

Hosts can reset their own password from the sign-in page.

1. On **/host/login**, tap **Forgot password?**
2. Type the host email and tap **Send reset link**.
3. Open the email, tap the link, type a new password twice, tap **Save and sign in**.

Safety details:
- The link works for **1 hour** and **only once** (it stops working as soon as the password changes).
- The page never says whether an email has an account, so it can't be used to find out who hosts on WeParty.
- Limited to 3 requests per email and 10 per network every 15 minutes.
- The secret part of the link is after `#`, so it never shows up in server logs or analytics.
- No database change is needed. The link is signed with `SESSION_SECRET`.

## Turning on the emails (5 minutes, free)

1. Make a free account at **resend.com**.
2. In Resend, go to **API Keys > Create API Key**, and copy it.
3. In **Vercel > your project > Settings > Environment Variables**, add:
   - `RESEND_API_KEY` = the key you copied
   - `EMAIL_FROM` = `We Party <onboarding@resend.dev>` for now
4. Redeploy (Vercel > Deployments > ⋯ > Redeploy).

`onboarding@resend.dev` can only email the address you signed up to Resend with. To email every host,
add your domain in **Resend > Domains**, add the DNS records it shows, then change `EMAIL_FROM`
to something like `We Party <noreply@yourdomain.com>`.

## Before email is set up

If `RESEND_API_KEY` or `EMAIL_FROM` is missing, no email is sent. Instead the reset link is written to
**Vercel > your project > Logs** (search for `password-reset`). Only people on your Vercel project can see it.
This lets the owner reset a password without email. Copy the link into the browser within 1 hour.

## Locked out and can't deploy? (Supabase only)

Supabase > **SQL Editor**, run this to see host accounts:

```sql
select email, display_name, created_at, last_login_at from hosts order by created_at;
```

To set a temporary password, ask Claude for a "password hash" for a temporary password, then run:

```sql
update hosts set password_hash = 'PASTE_HASH_HERE' where lower(email) = lower('you@example.com');
```

Sign in with the temporary password, then use **Forgot password?** to pick your own.

Note: signing in on a new phone doesn't sign out other devices. Host sessions last 30 days.
