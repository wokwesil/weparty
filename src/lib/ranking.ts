/**
 * WeParty Party Shuffle engine.
 *
 * How the queue is ordered (plain English):
 *
 *  1. Songs the host has locked in place ("pinned") always come first,
 *     in the order the host chose.
 *  2. Every other song gets a score:
 *        score = hearts × heartWeight
 *              + extra requests × requestWeight   (same song picked by several guests)
 *              − fairness × (the requester's "turn number")
 *     A guest's turn number is how many of their songs have already played
 *     plus how many of their own songs are ahead of this one. So everybody's
 *     first song competes against everybody else's first song, which stops one
 *     person from filling the top of the queue.
 *  3. Higher score plays sooner. Ties go to whoever submitted first.
 *  4. If "no back-to-back" is on, we avoid playing two songs from the same
 *     person in a row when someone else's song is close behind.
 *
 * The song that is currently playing never moves: it is not part of the
 * ranked queue at all.
 */
import { cleanVibeIds, cleanVibePrices } from "./vibes";

export type PartySettings = {
  heartWeight: number;
  requestWeight: number;
  fairness: number;
  noBackToBack: boolean;
  /** How far ahead we look for another person's song to avoid back-to-back. */
  backToBackLookahead: number;
  minPicks: number;
  maxPicks: number;
  allowExplicit: boolean;
  /** show who picked each song on the public replay page */
  replayShowPeople: boolean;
  /** DJ Mode: the control room becomes the DJ Booth and guests see the DJ Spotlight. */
  djMode: boolean;
  /** Approval mode: guest requests wait in "Pending" until the DJ approves them. */
  approvalMode: boolean;
  /** The next N songs are locked: hearts can't move them (0 = off, max 5). */
  lockCount: number;
  /** DJ Spotlight: shown on guest screens and the replay ("DJ ___ is spinning"). */
  djName: string;
  djInstagram: string;
  /** "What's the vibe tonight?": vibe ids the host picked (see src/lib/vibes.ts). Empty = any music. */
  vibes: string[];
  /** Only take guest requests that fit one of tonight's vibes (only matters when vibes are picked). */
  vibesOnly: boolean;
  /**
   * Host's price per vibe, in cents. Saved for later only: WeParty is free, so
   * guests are never charged and never see these. Hosts only see the price
   * boxes when FEATURE_VIBE_PRICING=1.
   */
  vibePrices: Record<string, number>;
};

export const DEFAULT_SETTINGS: PartySettings = {
  heartWeight: 1,
  requestWeight: 1,
  fairness: 2,
  noBackToBack: true,
  backToBackLookahead: 3,
  minPicks: 1,
  maxPicks: 10,
  allowExplicit: true,
  replayShowPeople: true,
  djMode: false,
  approvalMode: false,
  lockCount: 0,
  djName: "",
  djInstagram: "",
  vibes: [],
  vibesOnly: true,
  vibePrices: {},
};

export function normalizeSettings(raw: unknown): PartySettings {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const num = (k: keyof PartySettings, min: number, max: number) => {
    const v = Number(s[k]);
    return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : (DEFAULT_SETTINGS[k] as number);
  };
  const bool = (k: keyof PartySettings) =>
    typeof s[k] === "boolean" ? (s[k] as boolean) : (DEFAULT_SETTINGS[k] as boolean);
  const text = (k: "djName" | "djInstagram", max: number) =>
    typeof s[k] === "string" ? (s[k] as string).trim().replace(/\s+/g, " ").slice(0, max) : DEFAULT_SETTINGS[k];
  const ig = text("djInstagram", 60).toLowerCase().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").split(/[/?#]/)[0];
  const minPicks = Math.round(num("minPicks", 1, 25));
  const maxPicks = Math.max(minPicks, Math.round(num("maxPicks", 1, 25)));
  return {
    heartWeight: num("heartWeight", 0, 10),
    requestWeight: num("requestWeight", 0, 10),
    fairness: num("fairness", 0, 20),
    noBackToBack: bool("noBackToBack"),
    backToBackLookahead: Math.round(num("backToBackLookahead", 1, 10)),
    minPicks,
    maxPicks,
    allowExplicit: bool("allowExplicit"),
    replayShowPeople: bool("replayShowPeople"),
    djMode: bool("djMode"),
    approvalMode: bool("approvalMode"),
    lockCount: Math.round(num("lockCount", 0, 5)),
    djName: text("djName", 60),
    djInstagram: /^[a-z0-9._]{1,30}$/.test(ig) ? ig : "",
    vibes: cleanVibeIds(s.vibes),
    vibesOnly: bool("vibesOnly"),
    vibePrices: cleanVibePrices(s.vibePrices),
  };
}

export type RankInput = {
  id: string;
  /** guest id of the original requester, or null when the host added it */
  submittedBy: string | null;
  createdAt: number; // ms since epoch
  votes: number;
  requests: number; // total number of guests who picked this song (>= 1 for guest songs)
  pinnedRank: number | null;
};

export type RankedItem<T extends RankInput = RankInput> = T & {
  position: number; // 1-based
  score: number | null; // null for pinned songs
  turn: number | null;
  pinned: boolean;
};

const HOST_KEY = "__host__";

export function rankQueue<T extends RankInput>(
  items: T[],
  opts: {
    settings?: PartySettings;
    /** how many songs each guest has had played (or playing) already */
    playedByGuest?: Record<string, number>;
    /** requester of the song playing right now (to avoid back-to-back) */
    nowPlayingBy?: string | null;
  } = {},
): RankedItem<T>[] {
  const settings = opts.settings ?? DEFAULT_SETTINGS;
  const played = opts.playedByGuest ?? {};

  const pinned = items
    .filter((i) => i.pinnedRank !== null)
    .sort((a, b) => a.pinnedRank! - b.pinnedRank! || a.createdAt - b.createdAt || cmp(a.id, b.id));
  const free = items.filter((i) => i.pinnedRank === null);

  const baseScore = (i: T) =>
    i.votes * settings.heartWeight + Math.max(0, i.requests - 1) * settings.requestWeight;

  // Turn numbers per requester.
  const byGuest = new Map<string, T[]>();
  for (const it of free) {
    const key = it.submittedBy ?? HOST_KEY;
    const list = byGuest.get(key) ?? [];
    list.push(it);
    byGuest.set(key, list);
  }
  const turn = new Map<string, number>();
  for (const [key, list] of byGuest) {
    list.sort((a, b) => baseScore(b) - baseScore(a) || a.createdAt - b.createdAt || cmp(a.id, b.id));
    const already = key === HOST_KEY ? 0 : played[key] ?? 0;
    list.forEach((it, idx) => turn.set(it.id, key === HOST_KEY ? 0 : already + idx));
  }

  const scored = free.map((it) => ({
    it,
    turn: turn.get(it.id)!,
    score: baseScore(it) - settings.fairness * turn.get(it.id)!,
  }));
  scored.sort(
    (a, b) => b.score - a.score || a.it.createdAt - b.it.createdAt || cmp(a.it.id, b.it.id),
  );

  // Avoid back-to-back songs from the same person where possible.
  if (settings.noBackToBack) {
    let prev: string | null =
      pinned.length > 0 ? pinned[pinned.length - 1].submittedBy : opts.nowPlayingBy ?? null;
    for (let i = 0; i < scored.length; i++) {
      const who = scored[i].it.submittedBy;
      if (prev && who === prev) {
        const limit = Math.min(scored.length, i + 1 + settings.backToBackLookahead);
        for (let j = i + 1; j < limit; j++) {
          if (scored[j].it.submittedBy !== prev) {
            const [moved] = scored.splice(j, 1);
            scored.splice(i, 0, moved);
            break;
          }
        }
      }
      prev = scored[i].it.submittedBy;
    }
  }

  const out: RankedItem<T>[] = [];
  pinned.forEach((it) =>
    out.push({ ...it, position: out.length + 1, score: null, turn: null, pinned: true }),
  );
  scored.forEach(({ it, score, turn }) =>
    out.push({ ...it, position: out.length + 1, score, turn, pinned: false }),
  );
  return out;
}

function cmp(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}
