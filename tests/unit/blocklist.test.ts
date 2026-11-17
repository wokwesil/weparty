import { describe, expect, it } from "vitest";
import { artistCredits, blockMatch } from "../../src/lib/blocklist";
import { DEFAULT_SETTINGS, normalizeSettings } from "../../src/lib/ranking";

describe("DJ blocklist", () => {
  const artist = (value: string) => ({ kind: "artist" as const, value, label: value });
  it("splits artist credits", () => {
    expect(artistCredits("Future, Metro Boomin & Drake feat. Lil Baby")).toEqual(["future", "metro boomin", "drake", "lil baby"]);
  });
  it("matches an artist anywhere in the credit, but not lookalikes", () => {
    expect(blockMatch({ appleId: "1", artist: "Rihanna feat. Drake" }, [artist("drake")])).toBeTruthy();
    expect(blockMatch({ appleId: "1", artist: "DRAKE" }, [artist("drake")])).toBeTruthy();
    expect(blockMatch({ appleId: "1", artist: "Drake Bell" }, [artist("drake")])).toBeNull();
    expect(blockMatch({ appleId: "1", artist: "Nick Drake" }, [artist("drake")])).toBeNull();
    expect(blockMatch({ appleId: "1", artist: "Simon & Garfunkel" }, [artist("simon & garfunkel")])).toBeTruthy();
  });
  it("matches exact songs", () => {
    expect(blockMatch({ appleId: "123", artist: "X" }, [{ kind: "song", value: "123", label: "S" }])).toBeTruthy();
    expect(blockMatch({ appleId: "124", artist: "X" }, [{ kind: "song", value: "123", label: "S" }])).toBeNull();
  });
});

describe("party settings", () => {
  it("defaults to 1 to 10 songs per guest with DJ Mode off", () => {
    expect(DEFAULT_SETTINGS.minPicks).toBe(1);
    expect(DEFAULT_SETTINGS.maxPicks).toBe(10);
    expect(normalizeSettings({}).djMode).toBe(false);
  });
  it("cleans DJ fields and keeps the lock between 0 and 5", () => {
    const s = normalizeSettings({ lockCount: 9, djName: "  DJ   Nova  ", djInstagram: "https://instagram.com/DJ.Nova/" });
    expect(s.lockCount).toBe(5);
    expect(s.djName).toBe("DJ Nova");
    expect(s.djInstagram).toBe("dj.nova");
    expect(normalizeSettings({ djInstagram: "not valid!!" }).djInstagram).toBe("");
    expect(normalizeSettings({ lockCount: -2 }).lockCount).toBe(0);
  });
});
