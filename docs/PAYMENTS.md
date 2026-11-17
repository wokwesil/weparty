# Payments in We Party

Everything on this page is **switched off** until you turn it on in Vercel. It
only works with Stripe **test** keys (`sk_test_…`) unless you also set
`STRIPE_ALLOW_LIVE=1`, so no real card can be charged by accident.

## What's built

| Feature | Who pays | Where the money goes | Switch |
|---|---|---|---|
| **Song Boosts** ($1 / $3 / $5) | A guest, on their own song | The DJ/host's Stripe account, minus the We Party fee | `FEATURE_PAYMENTS=1` |
| **DJ Tips** ($3 / $5 / $10 / $20) | A guest | The DJ/host's Stripe account, minus the We Party fee | `FEATURE_PAYMENTS=1` |
| **Plans**: Free, DJ Pro (monthly), Event Pass (one time), Venue (monthly) | A host | We Party | `FEATURE_PLANS=1` |
| **"Presented by ___"** sponsor banner | (sold by the host) | n/a | `FEATURE_SPONSOR=1` |

How boosts work in the queue: each $1 counts like one extra heart. A $3 boost
helps a song, but it can't jump ahead of a song the whole room loves. Boosted
songs show a "⚡ Boosted" label. If DJ approval is on, a boosted song still
waits for the DJ to approve it. A refund removes the boost.

Plan limits (only enforced when `FEATURE_PLANS=1`):

- Free: up to 50 guests per party, no DJ Mode, no sponsor banner.
- DJ Pro: unlimited guests, DJ Mode, payouts.
- Event Pass: DJ Pro features plus the sponsor banner, for one event.
- Venue: DJ Pro features plus the sponsor banner on every event, more host seats.

All prices are placeholders. Change them in Vercel with no code change:
`PRICE_DJ_PRO_CENTS`, `PRICE_EVENT_PASS_CENTS`, `PRICE_VENUE_CENTS`,
`BOOST_PRICES_CENTS`, `TIP_AMOUNTS_CENTS`, `PLATFORM_FEE_PERCENT` (default 10).

## Safety

- **We never see or store card numbers.** Guests and hosts pay on Stripe's
  own Checkout page. We only keep Stripe ids, amounts and status.
- Secret keys live only in Vercel environment variables, never in the code.
- A boost, tip or plan only counts after Stripe's webhook confirms the payment.
  Stripe sometimes sends the same message twice; each one counts once.
- Payouts go through Stripe Connect (Express). Stripe handles the DJ's identity
  check, bank details and tax forms.

## Why payment buttons are hidden in the iPhone and Android apps

Apple's App Store rules (guideline 3.1.1) and Google Play's billing policy say
that apps which sell digital features or content must use the store's own
in-app purchase system, and limit links that send people to pay elsewhere.
Song Boosts and plans count as digital features. Tips to a real person (the DJ)
are usually allowed outside in-app purchase, but the rules are strict about how
that's presented.

To stay safe, the apps **don't show any payment button**. They say
"Upgrade on the We Party website" instead. Payments happen on the website only,
which most guests use anyway because they join by scanning a QR code in their
phone's browser.

`PAYMENTS_IN_NATIVE_APP=1` would show the buttons inside the apps. Leave it
off unless Apple and Google approve it, or the rules change (for example the
US court rulings that allow outside-payment links for US App Store users;
check the current rules before relying on them).

## Turning it on (test mode)

1. Create a Stripe account at stripe.com. Stay in **Test mode**.
2. Turn on **Connect** (Settings > Connect) and choose Express accounts.
3. Developers > API keys: copy the **Secret key** (`sk_test_…`) into Vercel as
   `STRIPE_SECRET_KEY`.
4. Developers > Webhooks > Add endpoint: `https://YOUR-SITE/api/stripe/webhook`.
   Select these events: `checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `checkout.session.expired`,
   `checkout.session.async_payment_failed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `account.updated`, `charge.refunded`.
   Tick "Listen to events on Connected accounts" too. Copy the **Signing
   secret** into Vercel as `STRIPE_WEBHOOK_SECRET`.
5. Settings > Billing > Customer portal: turn it on (for "Manage billing").
6. Run `supabase/migrations/0003_payments.sql` in Supabase (after 0002).
7. In Vercel set `FEATURE_PAYMENTS=1` and/or `FEATURE_PLANS=1`, then redeploy.
8. Host dashboard > Plan & payouts > **Set up payouts**. Use Stripe's test
   data to finish. Test card: `4242 4242 4242 4242`, any future date, any CVC.

Check `/api/health`: it reports whether the database is up to date.

## Going live later

Only after a lawyer and accountant have looked at it: switch Stripe to live
mode, put the live keys in Vercel, and set `STRIPE_ALLOW_LIVE=1`.

## Code map

- `src/lib/flags.ts`: the switches.
- `src/lib/payments/config.ts`: prices, fees, plans and limits.
- `src/lib/payments/stripe.ts`: the Stripe client (refuses live keys).
- `src/lib/services/payments.ts`: checkout, payouts, webhooks, earnings.
- `src/app/api/e/[code]/pay`, `src/app/api/stripe/webhook`,
  `src/app/api/host/billing`, `src/app/api/host/orgs/[orgId]/payouts`.
- `src/components/PaySheet.tsx`, `WebOnly.tsx`, `SponsorBanner.tsx`,
  `src/app/pricing/`.
- Tests: `tests/unit/payments-config.test.ts`, `tests/integration/payments.test.ts`.
