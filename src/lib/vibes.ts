/**
 * "What's the vibe tonight?"
 *
 * The host picks up to MAX_VIBES vibes for the party (Old School Hip Hop,
 * R&B, Afrobeats…). Guests then browse a starter crate for each vibe and,
 * when the host turns on "Only take requests in tonight's vibes", can only
 * request songs that fit one of them.
 *
 * How a song "fits" a vibe: Apple tells us each song's main genre
 * ("Hip-Hop/Rap", "R&B/Soul", "Afrobeats"…). Each vibe lists the genre words
 * it accepts. Apple doesn't say *which era* a song is from in a reliable way
 * (remasters and greatest-hits albums carry new dates), so "Old School Hip
 * Hop" and "Hip Hop Right Now" accept the same genre: the difference is the
 * starter crate guests browse. If Apple gives no genre for a song we let it
 * through, and the DJ can still decline it.
 *
 * Shared by the server and the browser (no secrets in here).
 */
import type { Song } from "./types";

export type Vibe = {
  id: string;
  label: string;
  emoji: string;
  /** One line shown to the host when picking vibes. */
  blurb: string;
  /** Lower-case pieces of Apple genre names this vibe accepts. */
  genres: string[];
  /** Searches used to build the vibe's starter crate for guests. */
  seeds: string[];
};

export const MAX_VIBES = 6;
/** Highest per-vibe price a host can save, in cents ($50). Prices aren't charged while WeParty is free. */
export const MAX_VIBE_PRICE_CENTS = 5000;

const HIP_HOP = ["hip-hop", "hip hop", "rap", "drill", "trap"];
const RNB = ["r&b", "soul", "neo-soul", "funk"];

export const VIBES: Vibe[] = [
  {
    id: "old-school-hip-hop",
    label: "Old School Hip Hop",
    emoji: "📻",
    blurb: "Biggie, Tupac, Nas, Tribe, Snoop, Wu-Tang",
    genres: HIP_HOP,
    seeds: ["Notorious B.I.G.", "Tupac", "A Tribe Called Quest", "Nas", "Snoop Dogg", "Wu-Tang Clan", "DMX", "OutKast"],
  },
  {
    id: "hip-hop-now",
    label: "Hip Hop Right Now",
    emoji: "🔥",
    blurb: "Kendrick, Drake, Travis, Future, GloRilla",
    genres: HIP_HOP,
    seeds: ["Kendrick Lamar", "Drake", "Travis Scott", "Future", "GloRilla", "Lil Baby", "Sexyy Red", "21 Savage"],
  },
  {
    id: "rnb",
    label: "R&B",
    emoji: "💜",
    blurb: "SZA, Brent Faiyaz, Summer Walker, Giveon",
    genres: RNB,
    seeds: ["SZA", "Brent Faiyaz", "Summer Walker", "Giveon", "Daniel Caesar", "Jhené Aiko", "Chris Brown", "Victoria Monét"],
  },
  {
    id: "throwback-rnb",
    label: "Throwback R&B",
    emoji: "🕺",
    blurb: "Usher, Aaliyah, Destiny's Child, Jodeci",
    genres: RNB,
    seeds: ["Usher", "Aaliyah", "Destiny's Child", "Jodeci", "Mary J. Blige", "Ginuwine", "Boyz II Men", "Keith Sweat"],
  },
  {
    id: "soul-funk",
    label: "Soul, Funk & Disco",
    emoji: "🪩",
    blurb: "Earth, Wind & Fire, Marvin Gaye, Chaka Khan, Prince",
    genres: [...RNB, "disco"],
    seeds: ["Earth, Wind & Fire", "Marvin Gaye", "Chaka Khan", "Prince", "Rick James", "Frankie Beverly and Maze", "Stevie Wonder"],
  },
  {
    id: "go-go",
    label: "Go-Go",
    emoji: "🥁",
    blurb: "DMV sound: Chuck Brown, Rare Essence, Backyard Band",
    genres: [...RNB, ...HIP_HOP, "go-go"],
    seeds: ["Chuck Brown", "Rare Essence", "Backyard Band", "Trouble Funk", "Experience Unlimited", "Junkyard Band"],
  },
  {
    id: "afrobeats",
    label: "Afrobeats & Amapiano",
    emoji: "🌍",
    blurb: "Burna Boy, Wizkid, Rema, Tems, Tyla, Asake",
    genres: ["afro", "african", "amapiano", "highlife"],
    seeds: ["Burna Boy", "Wizkid", "Rema", "Tems", "Tyla", "Asake", "Davido", "Ayra Starr"],
  },
  {
    id: "dancehall",
    label: "Dancehall & Reggae",
    emoji: "🇯🇲",
    blurb: "Vybz Kartel, Popcaan, Shenseea, Sean Paul",
    genres: ["reggae", "dancehall", "soca", "caribbean"],
    seeds: ["Vybz Kartel", "Popcaan", "Shenseea", "Sean Paul", "Bob Marley", "Spice", "Skillibeng"],
  },
  {
    id: "latin",
    label: "Latin & Reggaeton",
    emoji: "💃",
    blurb: "Bad Bunny, Karol G, Daddy Yankee, Feid",
    genres: ["latin", "reggaeton", "urbano", "salsa", "bachata", "cumbia", "mexican"],
    seeds: ["Bad Bunny", "Karol G", "Daddy Yankee", "J Balvin", "Feid", "Rauw Alejandro", "Peso Pluma"],
  },
  {
    id: "club",
    label: "House, EDM & Club",
    emoji: "🎧",
    blurb: "Calvin Harris, Fred again.., Kaytranada, Jersey club",
    genres: ["dance", "electronic", "house", "edm", "techno", "club"],
    seeds: ["Calvin Harris", "Fred again..", "Kaytranada", "Disclosure", "Fisher", "Jersey club", "Baltimore club"],
  },
  {
    id: "pop",
    label: "Pop Hits",
    emoji: "✨",
    blurb: "Sabrina Carpenter, Dua Lipa, Chappell Roan, The Weeknd",
    genres: ["pop"],
    seeds: ["Sabrina Carpenter", "Dua Lipa", "Chappell Roan", "The Weeknd", "Doja Cat", "Taylor Swift", "Tate McRae"],
  },
  {
    id: "throwbacks-2000s",
    label: "2000s Throwbacks",
    emoji: "💿",
    blurb: "Rihanna, Nelly, Black Eyed Peas, Britney",
    genres: ["pop", "dance", ...HIP_HOP, ...RNB],
    seeds: ["Rihanna", "Nelly", "Black Eyed Peas", "Britney Spears", "Ciara", "50 Cent", "Beyoncé", "T-Pain"],
  },
  {
    id: "gospel",
    label: "Gospel",
    emoji: "🙏",
    blurb: "Kirk Franklin, Maverick City, Tasha Cobbs Leonard",
    genres: ["gospel", "christian", "inspirational", "worship"],
    seeds: ["Kirk Franklin", "Maverick City Music", "Tasha Cobbs Leonard", "Fred Hammond", "Marvin Sapp", "CeCe Winans"],
  },
  {
    id: "country",
    label: "Country",
    emoji: "🤠",
    blurb: "Morgan Wallen, Zach Bryan, Luke Combs, Shaboozey",
    genres: ["country", "americana"],
    seeds: ["Morgan Wallen", "Zach Bryan", "Luke Combs", "Shaboozey", "Lainey Wilson", "Chris Stapleton"],
  },
  {
    id: "rock",
    label: "Rock & Alternative",
    emoji: "🎸",
    blurb: "Paramore, Arctic Monkeys, Linkin Park, Foo Fighters",
    genres: ["rock", "alternative", "metal", "punk", "indie"],
    seeds: ["Paramore", "Arctic Monkeys", "Linkin Park", "Foo Fighters", "Red Hot Chili Peppers", "The Killers"],
  },
];

const BY_ID = new Map(VIBES.map((v) => [v.id, v]));

export const getVibe = (id: string) => BY_ID.get(id) ?? null;

/** What guests need to know about a vibe (no search seeds or prices). */
export type VibeTag = { id: string; label: string; emoji: string };
export const vibeTags = (ids: string[]): VibeTag[] =>
  ids.map(getVibe).filter((v): v is Vibe => Boolean(v)).map(({ id, label, emoji }) => ({ id, label, emoji }));

/** Keeps only real vibe ids, without repeats, at most MAX_VIBES. */
export function cleanVibeIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const v of raw) if (typeof v === "string" && BY_ID.has(v) && !out.includes(v)) out.push(v);
  return out.slice(0, MAX_VIBES);
}

/** Keeps prices only for real vibes, as whole cents between 0 and MAX_VIBE_PRICE_CENTS. */
export function cleanVibePrices(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    const cents = Number(value);
    if (!BY_ID.has(id) || !Number.isFinite(cents)) continue;
    const c = Math.round(Math.min(MAX_VIBE_PRICE_CENTS, Math.max(0, cents)));
    if (c > 0) out[id] = c;
  }
  return out;
}

/**
 * Does this song fit this vibe?
 *   true  = Apple's genre for the song matches the vibe
 *   false = Apple gave a genre and it doesn't match
 *   null  = Apple gave no genre, so we can't tell
 */
export function songFitsVibe(song: Pick<Song, "genre">, vibe: Vibe): boolean | null {
  const genre = song.genre?.trim().toLowerCase();
  if (!genre) return null;
  return vibe.genres.some((g) => genre.includes(g));
}

/** Fits at least one of tonight's vibes? Unknown genre counts as a fit (the DJ can still decline it). */
export function songFitsAnyVibe(song: Pick<Song, "genre">, vibeIds: string[]): boolean {
  const vibes = vibeIds.map(getVibe).filter((v): v is Vibe => Boolean(v));
  if (vibes.length === 0) return true;
  return vibes.some((v) => songFitsVibe(song, v) !== false);
}

export const vibeListText = (tags: { label: string }[]) =>
  tags.length <= 1
    ? (tags[0]?.label ?? "")
    : `${tags.slice(0, -1).map((t) => t.label).join(", ")} and ${tags[tags.length - 1].label}`;
