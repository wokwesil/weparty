# Growth and polish

Two switches in Vercel (Settings > Environment Variables; redeploy after changing).
`FEATURE_GROWTH` is **on** unless set to `0`. `FEATURE_TERMS` is **off** unless set
to `1` (turn it on after a lawyer reviews `/terms`). Run `supabase/migrations/0003_growth.sql` first (after 0002).

## `FEATURE_GROWTH` (on by default)

- **"Your night in music"** at the top of the replay, for guests who were at the
  party on that phone: songs picked and played, hearts received and given, their
  most-loved pick, artist of the night and vibe (genre), and where they ranked.
- **Personal 9:16 story image** (`/e/CODE/replay/me`, 1080x1920) with the same
  recap, made for Instagram Stories. The party-wide story image still exists.
- **People who share your taste**: guests who picked or hearted the same songs.
  Shown in the recap and at the top of the People tab during the party. Hidden
  when the host turns off "show people on the replay". Blocked guests never show.
- **Follow this DJ/host**: an email sign-up on the replay with a consent
  checkbox. The host sees a follower count on their dashboard and can download
  the list as CSV. Every follower gets an unsubscribe link (`/unsubscribe`), which
  needs a button press so email scanners can't unsubscribe people by accident.
  **We Party doesn't send these emails yet** (no email service is connected).
  The host emails their followers with their own tool and must include an
  unsubscribe link. **Push notifications are not used.**
- **"Host your own party with We Party"** link at the bottom of every replay and
  a line on the printed QR poster.

## `FEATURE_TERMS=1`

- `/terms`: plain-English host terms (music licensing, guest safety, follower
  emails, price). **It's a draft for your lawyer to review; it is not
  legal advice.** The page says so at the top.
- When creating an event, hosts must tick "I agree to the host terms". The
  server checks it too, and saves which version was accepted on the event
  (`events.terms_version`, `events.terms_accepted_at`). When the text changes,
  bump `HOST_TERMS_VERSION` in `src/lib/services/growth.ts`.

Turn this on only after your lawyer has reviewed `/terms` (you can preview it by
switching it on in a Vercel Preview deployment first).

## Polish (always on, no switch)

These change nothing about how features work; they make the app easier to use:

- **Accessibility**: every main screen passes an automated WCAG 2.1 AA check
  (axe). Fixed: buttons with no name for screen readers (song previews), a
  dropdown with no label, links that were only distinguishable by color, and 30+
  buttons and links smaller than 44x44 pixels (now 44px or larger; small inline
  Instagram links get an invisible larger touch area).
- **Reduced motion**: animations respect the phone's "Reduce motion" setting.
- **Speed**: the replay page loads about 40 KB less JavaScript; page titles and
  descriptions are in the page head for every visitor (better link previews);
  the "is Apple Music set up?" check no longer logs an error in the browser.
- **Story images**: long party names wrap cleanly instead of overlapping.
- Haptics: the iPhone/Android apps already tap on hearts, song picks and DJ
  actions.

## Results (mobile Lighthouse, this build, local server)

| Page | Performance | Accessibility | Best practices | SEO |
|---|---|---|---|---|
| Home | 94 | 100 | 100 | 100 |
| Join (QR landing) | 92 | 100 | 100 | 100 |
| Replay | 94 | 100 | 100 | 100 |

Re-check on the live site after deploying (Chrome DevTools > Lighthouse >
Mobile); real numbers depend on Vercel's region and the phone's network.

## Tests

- `tests/integration/growth.test.ts`: recap numbers, taste matches (and that
  they hide when people are hidden or blocked), follow consent and email checks,
  no duplicate followers, unsubscribe, only admins can download followers, terms
  version saved.
- `tests/e2e/party-flow.mjs`: with `FEATURE_GROWTH=1` it also checks the recap,
  the 1080x1920 story image, following, the host link and taste matches
  (56 checks). With switches off: 51 checks, same as before.
- `tests/e2e/a11y-audit.mjs`: accessibility check of 17 screens
  (`BASE_URL=http://localhost:3000 node tests/e2e/a11y-audit.mjs`).
