/**
 * Prices and fees. Shared by the server and tests; no secrets here.
 *
 * Every price is a placeholder until William decides final pricing. They can
 * all be changed with Vercel settings, no code change needed.
 */

const cents = (raw: string | undefined, fallback: number) => {
  const n = Math.round(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : fallback;
};
const list = (raw: string | undefined, fallback: number[]) => {
  const v = (raw ?? "")
    .split(",")
    .map((x) => Math.round(Number(x.trim())))
    .filter((n) => Number.isFinite(n) && n > 0);
  return v.length ? v : fallback;
};

export const CURRENCY = "usd";

/** Song Boost prices in cents (default $1 / $3 / $5). Env: BOOST_PRICES_CENTS="100,300,500". */
export function boostTiers(): number[] {
  return list(process.env.BOOST_PRICES_CENTS, [100, 300, 500]).slice(0, 5);
}

/** Tip amounts offered in cents (default $3 / $5 / $10 / $20). Env: TIP_AMOUNTS_CENTS. */
export function tipAmounts(): number[] {
  return list(process.env.TIP_AMOUNTS_CENTS, [300, 500, 1000, 2000]).slice(0, 6);
}
export const TIP_MIN_CENTS = 100;
export const TIP_MAX_CENTS = 50_000;

/** We Party's cut of boosts and tips, in percent (default 10%). Env: PLATFORM_FEE_PERCENT. */
export function platformFeePercent(): number {
  const raw = process.env.PLATFORM_FEE_PERCENT;
  const n = Number(raw);
  return raw !== undefined && raw !== "" && Number.isFinite(n) && n >= 0 && n <= 50 ? n : 10;
}

export function platformFee(amountCents: number, percent = platformFeePercent()) {
  return Math.round((amountCents * percent) / 100);
}

/** How many "hearts" a paid boost is worth in the queue ranking (default: $1 = 1 heart). */
export function boostPoints(boostCents: number, pointsPerDollar = 1) {
  return (boostCents / 100) * pointsPerDollar;
}

export type PlanId = "free" | "dj_pro" | "event_pass" | "venue";

export type Plan = {
  id: PlanId;
  name: string;
  priceCents: number;
  interval: "month" | "once" | null;
  tagline: string;
  features: string[];
  limits: { guestsPerEvent: number | null; hostSeats: number | null; djMode: boolean; payouts: boolean; sponsor: boolean };
};

/** Plans. Prices are placeholders (William to decide). Env: PRICE_DJ_PRO_CENTS, PRICE_EVENT_PASS_CENTS, PRICE_VENUE_CENTS. */
export function plans(): Plan[] {
  return [
    {
      id: "free",
      name: "Free",
      priceCents: 0,
      interval: null,
      tagline: "House parties and small get-togethers",
      features: ["Up to 50 guests per party", "Live queue, hearts and replay", "QR poster"],
      limits: { guestsPerEvent: 50, hostSeats: 1, djMode: false, payouts: false, sponsor: false },
    },
    {
      id: "dj_pro",
      name: "DJ Pro",
      priceCents: cents(process.env.PRICE_DJ_PRO_CENTS, 1900),
      interval: "month",
      tagline: "For working DJs",
      features: [
        "Unlimited guests",
        "DJ Mode: booth, approvals, locks, blocklist, Crowd Pulse",
        "Tips and Song Boosts paid out to you",
        "DJ Spotlight at every party",
      ],
      limits: { guestsPerEvent: null, hostSeats: 2, djMode: true, payouts: true, sponsor: false },
    },
    {
      id: "event_pass",
      name: "Event Pass",
      priceCents: cents(process.env.PRICE_EVENT_PASS_CENTS, 4900),
      interval: "once",
      tagline: "One big night: weddings, galas, campus events",
      features: ["Everything in DJ Pro for one event", "Unlimited guests", "Sponsor banner", "No subscription"],
      limits: { guestsPerEvent: null, hostSeats: 3, djMode: true, payouts: true, sponsor: true },
    },
    {
      id: "venue",
      name: "Venue",
      priceCents: cents(process.env.PRICE_VENUE_CENTS, 9900),
      interval: "month",
      tagline: "Bars, clubs and venues with several hosts",
      features: ["Everything in DJ Pro", "Up to 10 hosts and DJs", "Sponsor banner on every event", "Several events at once"],
      limits: { guestsPerEvent: null, hostSeats: 10, djMode: true, payouts: true, sponsor: true },
    },
  ];
}

export function getPlan(id: string): Plan {
  return plans().find((p) => p.id === id) ?? plans()[0];
}

/** Maps the stored organization plan (old values included) to a plan; an Event Pass upgrades one event. */
export function effectivePlan(orgPlanValue: string, eventPass = false): Plan {
  if (orgPlanValue === "venue" || orgPlanValue === "enterprise") return getPlan("venue");
  if (eventPass) return getPlan("event_pass");
  if (orgPlanValue === "pro" || orgPlanValue === "dj_pro") return getPlan("dj_pro");
  return getPlan("free");
}

export function formatMoney(c: number) {
  return `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;
}
