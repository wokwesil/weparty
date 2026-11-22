import { describe, expect, it } from "vitest";
import { normalizeSettings } from "../../src/lib/ranking";
import { cleanVibeIds, cleanVibePrices, getVibe, MAX_VIBES, songFitsAnyVibe, songFitsVibe, VIBES, vibeListText, vibeTags } from "../../src/lib/vibes";

describe("Tonight's vibes", () => {
  it("every vibe has a unique id, genres and enough seeds for a crate", () => {
    expect(new Set(VIBES.map((v) => v.id)).size).toBe(VIBES.length);
    for (const v of VIBES) {
      expect(v.genres.length).toBeGreaterThan(0);
      expect(v.seeds.length).toBeGreaterThanOrEqual(5);
    }
  });

  it("matches Apple genre names to vibes", () => {
    const oldSchool = getVibe("old-school-hip-hop")!;
    const rnb = getVibe("rnb")!;
    expect(songFitsVibe({ genre: "Hip-Hop/Rap" }, oldSchool)).toBe(true);
    expect(songFitsVibe({ genre: "R&B/Soul" }, rnb)).toBe(true);
    expect(songFitsVibe({ genre: "Country" }, rnb)).toBe(false);
    expect(songFitsVibe({ genre: null }, rnb)).toBeNull();
    expect(songFitsVibe({ genre: "Afrobeats" }, getVibe("afrobeats")!)).toBe(true);
    expect(songFitsVibe({ genre: "Urbano latino" }, getVibe("latin")!)).toBe(true);
  });

  it("a song fits the party if it fits any vibe; unknown genre gets through", () => {
    const ids = ["old-school-hip-hop", "rnb"];
    expect(songFitsAnyVibe({ genre: "R&B/Soul" }, ids)).toBe(true);
    expect(songFitsAnyVibe({ genre: "Country" }, ids)).toBe(false);
    expect(songFitsAnyVibe({ genre: undefined }, ids)).toBe(true);
    expect(songFitsAnyVibe({ genre: "Country" }, [])).toBe(true);
  });

  it("cleans vibe ids and prices", () => {
    expect(cleanVibeIds(["rnb", "rnb", "nope", 3, "pop"])).toEqual(["rnb", "pop"]);
    expect(cleanVibeIds(VIBES.map((v) => v.id))).toHaveLength(MAX_VIBES);
    expect(cleanVibeIds("rnb")).toEqual([]);
    expect(cleanVibePrices({ rnb: 299.6, pop: -5, nope: 100, country: 999999, rock: "x" })).toEqual({ rnb: 300, country: 5000 });
  });

  it("settings default to no vibes, strict once picked, and no prices", () => {
    const s = normalizeSettings({});
    expect(s.vibes).toEqual([]);
    expect(s.vibesOnly).toBe(true);
    expect(s.vibePrices).toEqual({});
    expect(normalizeSettings({ vibes: ["rnb", "bad"], vibesOnly: false }).vibes).toEqual(["rnb"]);
  });

  it("describes tonight's vibes in plain English", () => {
    expect(vibeListText(vibeTags(["rnb"]))).toBe("R&B");
    expect(vibeListText(vibeTags(["old-school-hip-hop", "rnb", "afrobeats"]))).toBe("Old School Hip Hop, R&B and Afrobeats & Amapiano");
  });
});
