import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, normalizeSettings, rankQueue, type RankInput } from "../../src/lib/ranking";

const item = (id: string, by: string | null, t: number, votes = 0, extra: Partial<RankInput> = {}): RankInput => ({
  id,
  submittedBy: by,
  createdAt: t,
  votes,
  requests: by ? 1 : 0,
  pinnedRank: null,
  ...extra,
});
const ids = (r: { id: string }[]) => r.map((x) => x.id);

describe("rankQueue", () => {
  it("orders by hearts when everyone has one song", () => {
    const r = rankQueue([item("a", "g1", 1, 1), item("b", "g2", 2, 5), item("c", "g3", 3, 3)]);
    expect(ids(r)).toEqual(["b", "c", "a"]);
    expect(r.map((x) => x.position)).toEqual([1, 2, 3]);
  });

  it("breaks ties by submission time", () => {
    const r = rankQueue([item("late", "g1", 20, 2), item("early", "g2", 10, 2)]);
    expect(ids(r)).toEqual(["early", "late"]);
  });

  it("stops one guest from dominating with many songs (fair rotation)", () => {
    const items = [
      item("a1", "alice", 1), item("a2", "alice", 2), item("a3", "alice", 3),
      item("b1", "bob", 4), item("c1", "cara", 5),
    ];
    const r = rankQueue(items);
    expect(ids(r).slice(0, 3).sort()).toEqual(["a1", "b1", "c1"]);
    expect(ids(r).slice(3)).toEqual(["a2", "a3"]);
  });

  it("lets a very popular song jump the rotation", () => {
    const r = rankQueue([item("a1", "alice", 1), item("a2", "alice", 2, 10), item("b1", "bob", 3)]);
    expect(ids(r)[0]).toBe("a2");
  });

  it("guests who already had songs played wait their turn", () => {
    const r = rankQueue([item("a", "alice", 1), item("b", "bob", 2)], { playedByGuest: { alice: 2 } });
    expect(ids(r)).toEqual(["b", "a"]);
  });

  it("host pins always come first in host order", () => {
    const r = rankQueue([
      item("x", "g1", 1, 50),
      item("p2", "g2", 2, 0, { pinnedRank: 2 }),
      item("p1", "g3", 3, 0, { pinnedRank: 1 }),
    ]);
    expect(ids(r)).toEqual(["p1", "p2", "x"]);
    expect(r[0].pinned).toBe(true);
    expect(r[2].pinned).toBe(false);
  });

  it("avoids back-to-back songs from the same person", () => {
    const s = { ...DEFAULT_SETTINGS, fairness: 0 };
    const r = rankQueue(
      [item("a1", "alice", 1, 9), item("a2", "alice", 2, 8), item("b1", "bob", 3, 1)],
      { settings: s },
    );
    expect(ids(r)).toEqual(["a1", "b1", "a2"]);
  });

  it("avoids following the now-playing requester", () => {
    const r = rankQueue([item("a1", "alice", 1, 3), item("b1", "bob", 2, 2)], { nowPlayingBy: "alice" });
    expect(ids(r)).toEqual(["b1", "a1"]);
  });

  it("counts extra requests of the same song", () => {
    const r = rankQueue([item("a", "g1", 1, 0, { requests: 3 }), item("b", "g2", 2, 1)]);
    expect(ids(r)).toEqual(["a", "b"]);
  });

  it("is deterministic", () => {
    const items = Array.from({ length: 40 }, (_, i) => item(`s${i}`, `g${i % 7}`, i, (i * 7) % 5));
    expect(ids(rankQueue(items))).toEqual(ids(rankQueue([...items].reverse())));
  });
});

describe("normalizeSettings", () => {
  it("fills defaults and clamps values", () => {
    const s = normalizeSettings({ fairness: 999, minPicks: 8, maxPicks: 3, noBackToBack: false });
    expect(s.fairness).toBe(20);
    expect(s.minPicks).toBe(8);
    expect(s.maxPicks).toBe(8);
    expect(s.noBackToBack).toBe(false);
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});
