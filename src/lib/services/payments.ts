import "server-only";
import type Stripe from "stripe";
import { sql } from "../db";
import { badRequest, forbidden, notFound } from "../errors";
import { flags } from "../flags";
import {
  CURRENCY,
  TIP_MAX_CENTS,
  TIP_MIN_CENTS,
  boostTiers,
  effectivePlan,
  getPlan,
  platformFee,
  platformFeePercent,
  tipAmounts,
  type PlanId,
} from "../payments/config";
import { stripe, stripeConfigured } from "../payments/stripe";
import { notifyEventChanged } from "../realtime";
import { logEvent, type EventRow } from "./events";
import type { GuestRow } from "./guests";
import { requireEventRole, requireOrgRole } from "./hosts";

/*
 * Money flows (plain English):
 *  - Song Boosts and DJ Tips: the guest pays on Stripe's own checkout page.
 *    The money goes to the event's organization (the DJ or host) through
 *    Stripe Connect, and We Party keeps PLATFORM_FEE_PERCENT.
 *  - Plans: hosts pay We Party (subscription or one-time Event Pass).
 *  - We never see or store card numbers. We only keep Stripe ids and amounts.
 *  - Nothing here runs unless FEATURE_PAYMENTS / FEATURE_PLANS are "1".
 */

type OrgPay = { id: string; plan: string; stripe_account_id: string | null; payouts_enabled: boolean };

async function orgForEvent(event: EventRow): Promise<OrgPay> {
  const [o] = await sql<OrgPay[]>`
    select id, plan, stripe_account_id, payouts_enabled from organizations where id = ${event.org_id}`;
  if (!o) throw notFound("Account not found.");
  return o;
}

export type GuestPaymentOptions = {
  boosts: boolean;
  tips: boolean;
  boostTiers: number[];
  tipAmounts: number[];
  /** Shown inside the iPhone/Android apps too? (Off by default: see docs/PAYMENTS.md) */
  inNativeApp: boolean;
};

/** What a guest can pay for at this party (nothing unless payments are switched on and the DJ can be paid out). */
export async function guestPaymentOptions(event: EventRow): Promise<GuestPaymentOptions | null> {
  if (!flags.payments || !stripeConfigured() || event.status !== "live") return null;
  const org = await orgForEvent(event);
  if (!org.stripe_account_id || !org.payouts_enabled) return null;
  return { boosts: true, tips: true, boostTiers: boostTiers(), tipAmounts: tipAmounts(), inNativeApp: flags.paymentsInNativeApp };
}

function requirePaymentsOn() {
  if (!flags.payments) throw forbidden("Payments aren't switched on.");
}

async function createPaymentRow(p: {
  kind: "boost" | "tip" | "plan" | "event_pass";
  amount: number;
  fee: number;
  orgId: string | null;
  eventId?: string | null;
  guestId?: string | null;
  hostId?: string | null;
  itemId?: string | null;
  plan?: string | null;
}) {
  const [row] = await sql<{ id: string }[]>`
    insert into payments (kind, amount_cents, currency, platform_fee_cents, org_id, event_id, guest_id, host_id, queue_item_id, plan)
    values (${p.kind}, ${p.amount}, ${CURRENCY}, ${p.fee}, ${p.orgId}, ${p.eventId ?? null}, ${p.guestId ?? null},
            ${p.hostId ?? null}, ${p.itemId ?? null}, ${p.plan ?? null})
    returning id`;
  return row.id;
}

/** Guest pays to move their song up. DJ approval still applies to pending songs. */
export async function createBoostCheckout(event: EventRow, guest: GuestRow, itemId: string, amount: number, origin: string) {
  requirePaymentsOn();
  const opts = await guestPaymentOptions(event);
  if (!opts?.boosts) throw badRequest("Song Boosts aren't available at this party.", "payments_off");
  if (!opts.boostTiers.includes(amount)) throw badRequest("Pick one of the boost amounts.");
  const [item] = await sql<{ id: string; title: string; status: string }[]>`
    select q.id, q.title, q.status from queue_items q
    join song_requests r on r.queue_item_id = q.id and r.guest_id = ${guest.id}
    where q.id = ${itemId} and q.event_id = ${event.id}`;
  if (!item) throw badRequest("You can only boost songs you picked.");
  if (item.status !== "queued" && item.status !== "pending") throw badRequest("That song isn't waiting in the queue anymore.");
  const org = await orgForEvent(event);
  const fee = platformFee(amount);
  const paymentId = await createPaymentRow({ kind: "boost", amount, fee, orgId: org.id, eventId: event.id, guestId: guest.id, itemId });
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: CURRENCY, unit_amount: amount, product_data: { name: `Song Boost: ${item.title}`.slice(0, 250) } } }],
    payment_intent_data: { application_fee_amount: fee, transfer_data: { destination: org.stripe_account_id! }, metadata: { payment_id: paymentId } },
    metadata: { payment_id: paymentId, kind: "boost" },
    client_reference_id: paymentId,
    success_url: `${origin}/e/${event.code}/party?paid=boost`,
    cancel_url: `${origin}/e/${event.code}/party?paid=cancelled`,
  });
  await sql`update payments set stripe_session_id = ${session.id} where id = ${paymentId}`;
  return { url: session.url };
}

/** Guest tips the DJ. */
export async function createTipCheckout(event: EventRow, guest: GuestRow, amount: number, origin: string) {
  requirePaymentsOn();
  const opts = await guestPaymentOptions(event);
  if (!opts?.tips) throw badRequest("Tips aren't available at this party.", "payments_off");
  if (!Number.isInteger(amount) || amount < TIP_MIN_CENTS || amount > TIP_MAX_CENTS) {
    throw badRequest(`Tips can be $${TIP_MIN_CENTS / 100} to $${TIP_MAX_CENTS / 100}.`);
  }
  const org = await orgForEvent(event);
  const fee = platformFee(amount);
  const paymentId = await createPaymentRow({ kind: "tip", amount, fee, orgId: org.id, eventId: event.id, guestId: guest.id });
  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ quantity: 1, price_data: { currency: CURRENCY, unit_amount: amount, product_data: { name: `Tip for the DJ at ${event.name}`.slice(0, 250) } } }],
    payment_intent_data: { application_fee_amount: fee, transfer_data: { destination: org.stripe_account_id! }, metadata: { payment_id: paymentId } },
    metadata: { payment_id: paymentId, kind: "tip" },
    client_reference_id: paymentId,
    success_url: `${origin}/e/${event.code}/party?paid=tip`,
    cancel_url: `${origin}/e/${event.code}/party?paid=cancelled`,
  });
  await sql`update payments set stripe_session_id = ${session.id} where id = ${paymentId}`;
  return { url: session.url };
}

/* ------------------------------------------------------------------------ */
/* Stripe Connect: hosts and DJs get paid out                               */
/* ------------------------------------------------------------------------ */

export async function startPayoutOnboarding(hostId: string, orgId: string, origin: string) {
  requirePaymentsOn();
  await requireOrgRole(hostId, orgId);
  const [org] = await sql<{ id: string; name: string; stripe_account_id: string | null }[]>`
    select id, name, stripe_account_id from organizations where id = ${orgId}`;
  if (!org) throw notFound("Account not found.");
  let accountId = org.stripe_account_id;
  if (!accountId) {
    const account = await stripe().accounts.create({
      type: "express",
      business_profile: { name: org.name },
      metadata: { org_id: org.id },
    });
    accountId = account.id;
    await sql`update organizations set stripe_account_id = ${accountId} where id = ${orgId}`;
  }
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${origin}/host?payouts=retry`,
    return_url: `${origin}/host?payouts=done`,
  });
  return { url: link.url };
}

export async function refreshPayoutStatus(orgId: string) {
  const [org] = await sql<{ stripe_account_id: string | null }[]>`select stripe_account_id from organizations where id = ${orgId}`;
  if (!org?.stripe_account_id || !stripeConfigured()) return false;
  const a = await stripe().accounts.retrieve(org.stripe_account_id);
  const ok = Boolean(a.charges_enabled && a.payouts_enabled);
  await sql`update organizations set payouts_enabled = ${ok} where id = ${orgId}`;
  return ok;
}

/* ------------------------------------------------------------------------ */
/* Plans (We Party's own revenue)                                           */
/* ------------------------------------------------------------------------ */

export async function createPlanCheckout(hostId: string, orgId: string, planId: string, eventId: string | null, origin: string) {
  if (!flags.plans) throw forbidden("Plans aren't switched on yet.");
  await requireOrgRole(hostId, orgId);
  const plan = getPlan(planId);
  if (plan.id === "free") throw badRequest("Pick a paid plan.");
  if (plan.id === "event_pass") {
    if (!eventId) throw badRequest("Pick the event for this Event Pass.");
    await requireEventRole(hostId, eventId, "admin");
  }
  const [org] = await sql<{ id: string; name: string; billing_customer_id: string | null }[]>`
    select id, name, billing_customer_id from organizations where id = ${orgId}`;
  const [host] = await sql<{ email: string }[]>`select email from hosts where id = ${hostId}`;
  let customer = org.billing_customer_id;
  if (!customer) {
    const c = await stripe().customers.create({ name: org.name, email: host.email, metadata: { org_id: org.id } });
    customer = c.id;
    await sql`update organizations set billing_customer_id = ${customer} where id = ${orgId}`;
  }
  const kind = plan.id === "event_pass" ? "event_pass" : "plan";
  const paymentId = await createPaymentRow({ kind, amount: plan.priceCents, fee: 0, orgId, eventId, hostId, plan: plan.id });
  const meta = { payment_id: paymentId, kind, plan: plan.id, org_id: orgId, ...(eventId ? { event_id: eventId } : {}) };
  const session = await stripe().checkout.sessions.create(
    plan.interval === "month"
      ? {
          mode: "subscription",
          customer,
          line_items: [
            {
              quantity: 1,
              price_data: { currency: CURRENCY, unit_amount: plan.priceCents, recurring: { interval: "month" }, product_data: { name: `We Party ${plan.name}` } },
            },
          ],
          subscription_data: { metadata: meta },
          metadata: meta,
          client_reference_id: paymentId,
          success_url: `${origin}/host?upgraded=${plan.id}`,
          cancel_url: `${origin}/pricing?cancelled=1`,
        }
      : {
          mode: "payment",
          customer,
          line_items: [{ quantity: 1, price_data: { currency: CURRENCY, unit_amount: plan.priceCents, product_data: { name: `We Party ${plan.name}` } } }],
          metadata: meta,
          client_reference_id: paymentId,
          success_url: `${origin}/host/events/${eventId}?upgraded=event_pass`,
          cancel_url: `${origin}/pricing?cancelled=1`,
        },
  );
  await sql`update payments set stripe_session_id = ${session.id} where id = ${paymentId}`;
  return { url: session.url };
}

export async function createBillingPortal(hostId: string, orgId: string, origin: string) {
  if (!flags.plans) throw forbidden("Plans aren't switched on yet.");
  await requireOrgRole(hostId, orgId);
  const [org] = await sql<{ billing_customer_id: string | null }[]>`select billing_customer_id from organizations where id = ${orgId}`;
  if (!org?.billing_customer_id) throw badRequest("No billing account yet.");
  const s = await stripe().billingPortal.sessions.create({ customer: org.billing_customer_id, return_url: `${origin}/host` });
  return { url: s.url };
}

/** Plan limits only apply when FEATURE_PLANS is on. Returns null when there's no limit. */
export async function planForEvent(event: EventRow) {
  if (!flags.plans) return null;
  const [o] = await sql<{ plan: string }[]>`select plan from organizations where id = ${event.org_id}`;
  return effectivePlan(o?.plan ?? "free", Boolean(event.event_pass));
}

/* ------------------------------------------------------------------------ */
/* Webhooks: Stripe tells us when a payment really went through             */
/* ------------------------------------------------------------------------ */

export function verifyWebhook(body: string, signature: string | null): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET ?? "";
  if (!secret || !signature) throw badRequest("Missing webhook signature.");
  try {
    return stripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    throw badRequest("Bad webhook signature.");
  }
}

type PaymentRow = {
  id: string;
  kind: "boost" | "tip" | "plan" | "event_pass";
  status: string;
  amount_cents: number;
  org_id: string | null;
  event_id: string | null;
  guest_id: string | null;
  queue_item_id: string | null;
  plan: string | null;
};

/** Handles one Stripe event. Safe to receive the same event twice. */
export async function handleStripeEvent(evt: Pick<Stripe.Event, "id" | "type" | "data">) {
  const fresh = await sql`insert into stripe_events (id, type) values (${evt.id}, ${evt.type}) on conflict do nothing returning 1`;
  if (!fresh.length) return { duplicate: true };
  const obj = evt.data.object as unknown as Record<string, unknown>;
  switch (evt.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = obj as unknown as Stripe.Checkout.Session;
      if (s.payment_status !== "paid" && s.payment_status !== "no_payment_required") return { pending: true };
      await markPaid(s);
      break;
    }
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed": {
      const s = obj as unknown as Stripe.Checkout.Session;
      await sql`update payments set status = ${evt.type.endsWith("expired") ? "canceled" : "failed"}
                where stripe_session_id = ${s.id} and status = 'pending'`;
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = obj as unknown as Stripe.Subscription;
      const active = evt.type === "customer.subscription.updated" && (sub.status === "active" || sub.status === "trialing");
      const plan = sub.metadata?.plan === "venue" ? "venue" : "dj_pro";
      await sql`update organizations set plan = ${active ? plan : "free"}, plan_status = ${sub.status},
                stripe_subscription_id = ${active ? sub.id : null}
                where stripe_subscription_id = ${sub.id} or (${sub.metadata?.org_id ?? null}::uuid is not null and id = ${sub.metadata?.org_id ?? null}::uuid)`;
      break;
    }
    case "account.updated": {
      const a = obj as unknown as Stripe.Account;
      await sql`update organizations set payouts_enabled = ${Boolean(a.charges_enabled && a.payouts_enabled)}
                where stripe_account_id = ${a.id}`;
      break;
    }
    case "charge.refunded": {
      const c = obj as unknown as Stripe.Charge;
      const pid = (c.metadata?.payment_id as string | undefined) ?? null;
      const pi = typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id ?? null;
      const [p] = await sql<PaymentRow[]>`
        update payments set status = 'refunded'
        where status = 'paid' and (id = ${pid}::uuid or stripe_payment_intent = ${pi})
        returning *`.catch(() => [] as PaymentRow[]);
      if (p?.kind === "boost" && p.queue_item_id) {
        await sql`update queue_items set boost_cents = greatest(0, boost_cents - ${p.amount_cents}) where id = ${p.queue_item_id}`;
        if (p.event_id) await notifyEventChanged(p.event_id);
      }
      break;
    }
    default:
      return { ignored: true };
  }
  return { ok: true };
}

async function markPaid(s: Stripe.Checkout.Session) {
  const pi = typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id ?? null;
  const [p] = await sql<PaymentRow[]>`
    update payments set status = 'paid', paid_at = now(), stripe_payment_intent = ${pi}
    where stripe_session_id = ${s.id} and status = 'pending'
    returning *`;
  if (!p) return;
  if (p.kind === "boost" && p.queue_item_id && p.event_id) {
    await sql`update queue_items set boost_cents = boost_cents + ${p.amount_cents} where id = ${p.queue_item_id}`;
    await logEvent(p.event_id, `guest:${p.guest_id}`, "song_boosted", { cents: p.amount_cents });
    await notifyEventChanged(p.event_id);
  } else if (p.kind === "tip" && p.event_id) {
    await logEvent(p.event_id, `guest:${p.guest_id}`, "dj_tipped", { cents: p.amount_cents });
    await notifyEventChanged(p.event_id);
  } else if (p.kind === "event_pass" && p.event_id) {
    await sql`update events set event_pass = true where id = ${p.event_id}`;
    await notifyEventChanged(p.event_id);
  } else if (p.kind === "plan" && p.org_id) {
    const sub = typeof s.subscription === "string" ? s.subscription : s.subscription?.id ?? null;
    await sql`update organizations set plan = ${p.plan === "venue" ? "venue" : "dj_pro"}, plan_status = 'active',
              stripe_subscription_id = ${sub} where id = ${p.org_id}`;
  }
}

/** Money summary for the host's Insights page. */
export async function eventEarnings(eventId: string) {
  const [r] = await sql<{ tips: number; tip_count: number; boosts: number; boost_count: number; fees: number }[]>`
    select coalesce(sum(amount_cents) filter (where kind = 'tip'), 0)::int as tips,
           count(*) filter (where kind = 'tip')::int as tip_count,
           coalesce(sum(amount_cents) filter (where kind = 'boost'), 0)::int as boosts,
           count(*) filter (where kind = 'boost')::int as boost_count,
           coalesce(sum(platform_fee_cents) filter (where kind in ('tip','boost')), 0)::int as fees
    from payments where event_id = ${eventId} and status = 'paid'`;
  return { ...r, feePercent: platformFeePercent() };
}

export function assertPlanAllows(plan: ReturnType<typeof effectivePlan> | null, what: "djMode" | "sponsor") {
  if (plan && !plan.limits[what]) {
    throw forbidden(`${what === "djMode" ? "DJ Mode" : "The sponsor banner"} is part of the paid plans. See /pricing.`);
  }
}

export type { PlanId };
