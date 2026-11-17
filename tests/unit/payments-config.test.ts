import { afterEach, describe, expect, it } from "vitest";
import { boostPoints, boostTiers, effectivePlan, formatMoney, getPlan, platformFee, platformFeePercent, plans, tipAmounts } from "../../src/lib/payments/config";
import { rankQueue, type RankInput } from "../../src/lib/ranking";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("payment settings", () => {
  it("uses $1/$3/$5 boosts and a 10% fee by default", () => {
    delete process.env.BOOST_PRICES_CENTS;
    delete process.env.PLATFORM_FEE_PERCENT;
    expect(boostTiers()).toEqual([100, 300, 500]);
    expect(tipAmounts()).toEqual([300, 500, 1000, 2000]);
    expect(platformFeePercent()).toBe(10);
    expect(platformFee(500)).toBe(50);
  });

  it("reads the fee and prices from settings and ignores bad values", () => {
    process.env.PLATFORM_FEE_PERCENT = "15";
    expect(platformFee(1000)).toBe(150);
    process.env.PLATFORM_FEE_PERCENT = "-3";
    expect(platformFeePercent()).toBe(10);
    process.env.PLATFORM_FEE_PERCENT = "nonsense";
    expect(platformFeePercent()).toBe(10);
    process.env.BOOST_PRICES_CENTS = "200, 400,abc";
    expect(boostTiers()).toEqual([200, 400]);
    process.env.PRICE_DJ_PRO_CENTS = "2900";
    expect(getPlan("dj_pro").priceCents).toBe(2900);
  });

  it("never takes a fee bigger than the payment", () => {
    process.env.PLATFORM_FEE_PERCENT = "100";
    expect(platformFee(300)).toBeLessThanOrEqual(300);
  });

  it("maps stored plans, including old values, and Event Passes", () => {
    expect(effectivePlan("free").id).toBe("free");
    expect(effectivePlan("pro").id).toBe("dj_pro");
    expect(effectivePlan("enterprise").id).toBe("venue");
    expect(effectivePlan("free", true).id).toBe("event_pass");
    expect(effectivePlan("venue", true).id).toBe("venue");
    expect(plans().map((p) => p.id)).toEqual(["free", "dj_pro", "event_pass", "venue"]);
    expect(getPlan("free").limits.djMode).toBe(false);
  });

  it("formats money for people", () => {
    expect(formatMoney(500)).toBe("$5");
    expect(formatMoney(1950)).toBe("$19.50");
  });
});

describe("boosted songs in the queue", () => {
  const item = (id: string, by: string, t: number, votes: number, boostCents = 0): RankInput => ({
    id,
    submittedBy: by,
    createdAt: t,
    votes,
    requests: 1,
    pinnedRank: null,
    boostPoints: boostPoints(boostCents),
  });

  it("a $3 boost counts like 3 hearts", () => {
    expect(boostPoints(300)).toBe(3);
    const r = rankQueue([item("a", "g1", 1, 4), item("b", "g2", 2, 2, 300)]);
    expect(r.map((x) => x.id)).toEqual(["b", "a"]);
  });

  it("a boost can't beat a much more popular song", () => {
    const r = rankQueue([item("a", "g1", 1, 12), item("b", "g2", 2, 0, 500)]);
    expect(r[0].id).toBe("a");
  });
});
