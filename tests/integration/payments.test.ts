/**
 * Payments (Song Boosts, DJ Tips, plans, webhooks) against a real Postgres database
 * with a fake Stripe client, so no network calls and no real money.
 * Run with: TEST_DATABASE_URL=postgres://... npm test
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;
process.env.DATABASE_URL = url ?? "";

type Mods = {
  sql: typeof import("../../src/lib/db").sql;
  hosts: typeof import("../../src/lib/services/hosts");
  events: typeof import("../../src/lib/services/events");
  guests: typeof import("../../src/lib/services/guests");
  queue: typeof import("../../src/lib/services/queue");
  pay: typeof import("../../src/lib/services/payments");
  stripe: typeof import("../../src/lib/payments/stripe");
};
let m: Mods;

/** Records what we asked Stripe for and hands back fake ids. */
function fakeStripe() {
  let n = 0;
  const calls: { kind: string; args: Record<string, unknown> }[] = [];
  return {
    calls,
    checkout: {
      sessions: {
        create: async (args: Record<string, unknown>) => {
          calls.push({ kind: "checkout", args });
          const id = `cs_test_${++n}`;
          return { id, url: `https://checkout.stripe.test/${id}` };
        },
      },
    },
    accounts: {
      create: async (args: Record<string, unknown>) => (calls.push({ kind: "account", args }), { id: "acct_test_1" }),
      retrieve: async () => ({ id: "acct_test_1", charges_enabled: true, payouts_enabled: true }),
    },
    accountLinks: { create: async () => ({ url: "https://connect.stripe.test/onboard" }) },
    customers: { create: async () => ({ id: "cus_test_1" }) },
    billingPortal: { sessions: { create: async () => ({ url: "https://billing.stripe.test/portal" }) } },
  };
}

const evt = (id: string, type: string, object: Record<string, unknown>) => ({ id, type, data: { object } }) as never;

d("Payments (database, fake Stripe)", () => {
  let hostId: string;
  let orgId: string;
  let eventId: string;
  let fake: ReturnType<typeof fakeStripe>;
  const ev = async () => (await m.events.getEventById(eventId))!;
  const join = async (ig: string) => (await m.guests.registerGuest(await ev(), { displayName: ig, instagram: ig })).guest;
  const env = { ...process.env };

  beforeAll(async () => {
    m = {
      sql: (await import("../../src/lib/db")).sql,
      hosts: await import("../../src/lib/services/hosts"),
      events: await import("../../src/lib/services/events"),
      guests: await import("../../src/lib/services/guests"),
      queue: await import("../../src/lib/services/queue"),
      pay: await import("../../src/lib/services/payments"),
      stripe: await import("../../src/lib/payments/stripe"),
    };
    fake = fakeStripe();
    m.stripe.setStripeForTests(fake);
    hostId = await m.hosts.signupHost({ email: `pay-${Date.now()}@test.weparty`, password: "correct horse", displayName: "Pay Test" });
    orgId = (await m.hosts.getHostAccount(hostId))!.orgs[0].id;
    eventId = await m.events.createEvent(hostId, orgId, { name: "[TEST] Paid Night" });
    await m.sql`update events set status = 'live' where id = ${eventId}`;
  });

  afterAll(async () => {
    process.env = env;
    m.stripe.setStripeForTests(null);
    if (eventId) await m.sql`delete from payments where event_id = ${eventId}`;
    if (orgId) await m.sql`delete from payments where org_id = ${orgId}`;
    if (eventId) await m.sql`delete from events where id = ${eventId}`;
    if (hostId) await m.sql`delete from hosts where id = ${hostId}`;
    if (orgId) await m.sql`delete from organizations where id = ${orgId}`;
    await m.sql`delete from stripe_events where id like 'evt_test_%'`;
    await m.sql.end();
  });

  it("shows nothing to guests while payments are switched off", async () => {
    delete process.env.FEATURE_PAYMENTS;
    expect(await m.pay.guestPaymentOptions(await ev())).toBeNull();
    const g = await join("pay.off");
    await expect(m.pay.createTipCheckout(await ev(), g, 500, "https://x.test")).rejects.toThrow(/switched on/);
  });

  it("needs the DJ's payouts set up before guests can pay", async () => {
    process.env.FEATURE_PAYMENTS = "1";
    expect(await m.pay.guestPaymentOptions(await ev())).toBeNull();
    const r = await m.pay.startPayoutOnboarding(hostId, orgId, "https://x.test");
    expect(r.url).toContain("connect.stripe.test");
    expect(await m.pay.refreshPayoutStatus(orgId)).toBe(true);
    const opts = await m.pay.guestPaymentOptions(await ev());
    expect(opts?.boostTiers).toEqual([100, 300, 500]);
    expect(opts?.inNativeApp).toBe(false);
  });

  it("boosts only your own song, and only after Stripe confirms payment", async () => {
    const a = await join("booster");
    const b = await join("other.guest");
    await m.queue.submitSongs(await ev(), a, [{ appleId: "pay-1", title: "[TEST] Boost me", artist: "[TEST] A" }]);
    await m.queue.submitSongs(await ev(), b, [{ appleId: "pay-2", title: "[TEST] Popular", artist: "[TEST] B" }]);
    const snap = await m.queue.getSnapshot(await ev());
    const mine = snap.queue.find((s) => s.title === "[TEST] Boost me")!;
    const theirs = snap.queue.find((s) => s.title === "[TEST] Popular")!;

    await expect(m.pay.createBoostCheckout(await ev(), a, theirs.id, 300, "https://x.test")).rejects.toThrow(/songs you picked/);
    await expect(m.pay.createBoostCheckout(await ev(), a, mine.id, 250, "https://x.test")).rejects.toThrow(/boost amounts/);

    const { url: checkoutUrl } = await m.pay.createBoostCheckout(await ev(), a, mine.id, 300, "https://x.test");
    expect(checkoutUrl).toContain("checkout.stripe.test");
    const call = fake.calls.filter((c) => c.kind === "checkout").at(-1)!.args as { payment_intent_data: { application_fee_amount: number; transfer_data: { destination: string } } };
    expect(call.payment_intent_data.application_fee_amount).toBe(30);
    expect(call.payment_intent_data.transfer_data.destination).toBe("acct_test_1");

    // Not paid yet: no boost.
    let s = (await m.queue.getSnapshot(await ev())).queue.find((x) => x.id === mine.id)!;
    expect(s.boostCents).toBe(0);

    const sessionId = (await m.sql<{ stripe_session_id: string }[]>`select stripe_session_id from payments where queue_item_id = ${mine.id}`)[0].stripe_session_id;
    const paid = evt("evt_test_boost", "checkout.session.completed", { id: sessionId, payment_status: "paid", payment_intent: "pi_test_1" });
    expect(await m.pay.handleStripeEvent(paid)).toEqual({ ok: true });
    // Stripe can send the same event twice; the boost must count once.
    expect(await m.pay.handleStripeEvent(paid)).toEqual({ duplicate: true });

    s = (await m.queue.getSnapshot(await ev())).queue.find((x) => x.id === mine.id)!;
    expect(s.boostCents).toBe(300);

    // Refund takes the boost back.
    await m.pay.handleStripeEvent(evt("evt_test_refund", "charge.refunded", { id: "ch_1", payment_intent: "pi_test_1", metadata: {} }));
    s = (await m.queue.getSnapshot(await ev())).queue.find((x) => x.id === mine.id)!;
    expect(s.boostCents).toBe(0);
  });

  it("logs tips and shows them in the host's earnings", async () => {
    const g = await join("tipper");
    await expect(m.pay.createTipCheckout(await ev(), g, 50, "https://x.test")).rejects.toThrow(/Tips can be/);
    await m.pay.createTipCheckout(await ev(), g, 1000, "https://x.test");
    const [p] = await m.sql<{ stripe_session_id: string }[]>`select stripe_session_id from payments where guest_id = ${g.id} and kind = 'tip'`;
    await m.pay.handleStripeEvent(evt("evt_test_tip", "checkout.session.completed", { id: p.stripe_session_id, payment_status: "paid", payment_intent: "pi_test_2" }));
    const e = await m.pay.eventEarnings(eventId);
    expect(e.tips).toBe(1000);
    expect(e.tip_count).toBe(1);
    expect(e.fees).toBe(100);
  });

  it("an expired checkout never counts as paid", async () => {
    const g = await join("walked.away");
    await m.pay.createTipCheckout(await ev(), g, 500, "https://x.test");
    const [p] = await m.sql<{ stripe_session_id: string }[]>`select stripe_session_id from payments where guest_id = ${g.id}`;
    await m.pay.handleStripeEvent(evt("evt_test_expired", "checkout.session.expired", { id: p.stripe_session_id }));
    const [row] = await m.sql<{ status: string }[]>`select status from payments where guest_id = ${g.id}`;
    expect(row.status).toBe("canceled");
  });

  it("plan limits only apply when plans are switched on", async () => {
    delete process.env.FEATURE_PLANS;
    await m.events.updateSettings(hostId, eventId, { djMode: true });
    await m.events.updateSettings(hostId, eventId, { djMode: false });

    process.env.FEATURE_PLANS = "1";
    await expect(m.events.updateSettings(hostId, eventId, { djMode: true })).rejects.toThrow(/paid plans/);
    expect((await m.pay.planForEvent(await ev()))?.limits.guestsPerEvent).toBe(50);

    // Buying DJ Pro (subscription) through the webhook unlocks DJ Mode.
    await m.pay.createPlanCheckout(hostId, orgId, "dj_pro", null, "https://x.test");
    const [p] = await m.sql<{ stripe_session_id: string }[]>`select stripe_session_id from payments where org_id = ${orgId} and kind = 'plan'`;
    await m.pay.handleStripeEvent(evt("evt_test_plan", "checkout.session.completed", { id: p.stripe_session_id, payment_status: "paid", subscription: "sub_test_1" }));
    await m.events.updateSettings(hostId, eventId, { djMode: true });
    expect((await m.pay.planForEvent(await ev()))?.limits.guestsPerEvent).toBeNull();

    // Cancelling the subscription drops back to Free.
    await m.pay.handleStripeEvent(evt("evt_test_cancel", "customer.subscription.deleted", { id: "sub_test_1", status: "canceled", metadata: { org_id: orgId } }));
    const [o] = await m.sql<{ plan: string }[]>`select plan from organizations where id = ${orgId}`;
    expect(o.plan).toBe("free");
    delete process.env.FEATURE_PLANS;
  });

  it("caps guests on the Free plan when plans are on", async () => {
    process.env.FEATURE_PLANS = "1";
    const [{ n }] = await m.sql<{ n: number }[]>`select count(*)::int as n from guests where event_id = ${eventId}`;
    // Fill up to the cap with plain inserts so the test stays fast.
    for (let i = n; i < 50; i++) {
      await m.sql`insert into guests (event_id, token_hash, display_name, instagram_username) values (${eventId}, ${`h${i}`}, ${`g${i}`}, ${`filler${i}`})`;
    }
    await expect(join("one.too.many")).rejects.toThrow(/party is full/);
    delete process.env.FEATURE_PLANS;
    await expect(join("one.too.many")).resolves.toBeTruthy();
  });

  it("refuses live Stripe keys unless explicitly allowed", async () => {
    m.stripe.setStripeForTests(null);
    process.env.STRIPE_SECRET_KEY = "sk_live_123";
    expect(() => m.stripe.stripe()).toThrow(/live Stripe key/);
    process.env.STRIPE_SECRET_KEY = "";
    m.stripe.setStripeForTests(fake);
  });
});
