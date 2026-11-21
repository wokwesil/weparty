/** Shared types used by both the server and the browser. */

export type Song = {
  appleId: string;
  title: string;
  artist: string;
  album: string | null;
  artworkUrl: string | null;
  durationMs: number | null;
  isrc: string | null;
  appleUrl: string | null;
  previewUrl: string | null;
  explicit: boolean;
  /** Main genre, when Apple tells us (used by the DJ's Crowd Pulse). */
  genre?: string | null;
};

export type PersonRef = {
  id: string;
  displayName: string;
  instagram: string;
  avatarUrl: string | null;
};

export type SongView = {
  id: string;
  appleSongId: string;
  title: string;
  artist: string;
  album: string | null;
  artworkUrl: string | null;
  appleUrl: string | null;
  previewUrl: string | null;
  durationMs: number | null;
  explicit: boolean;
  status: "pending" | "queued" | "playing" | "played" | "skipped" | "removed" | "declined";
  genre: string | null;
  /** True for the next songs the DJ has locked in place (hearts can't move them). */
  locked: boolean;
  votes: number;
  requests: number;
  position: number | null;
  pinned: boolean;
  score: number | null;
  requester: PersonRef | null;
  alsoRequestedBy: PersonRef[];
  addedByHost: boolean;
  createdAt: string;
  startedAt: string | null;
  playOrder: number | null;
};

export type EventPublic = {
  id: string;
  code: string;
  name: string;
  venueName: string | null;
  description: string | null;
  startsAt: string | null;
  status: "draft" | "live" | "ended";
  submissionsOpen: boolean;
  minPicks: number;
  maxPicks: number;
  replayAppleUrl: string | null;
  djMode: boolean;
  approvalMode: boolean;
  lockCount: number;
  /** DJ Spotlight, shown when DJ Mode is on and a DJ name is set. */
  dj: { name: string; instagram: string | null; photoUrl: string | null } | null;
  /** "What's the vibe tonight?": the vibes the host picked (empty = any music). */
  vibes: { id: string; label: string; emoji: string }[];
  /** Guests can only request songs that fit one of tonight's vibes. */
  vibesOnly: boolean;
};

export type Shoutout = { id: number; message: string; createdAt: string };

export type QueueSnapshot = {
  event: EventPublic;
  nowPlaying: SongView | null;
  queue: SongView[];
  history: SongView[];
  popular: SongView[];
  /** Songs waiting for DJ approval (only sent to the host; guests see their own in "me"). */
  pending: SongView[];
  /** Latest DJ shoutout from the last 15 minutes, if any. */
  shoutout: Shoutout | null;
  stats: { guests: number; songs: number; votes: number; played: number; pending: number };
  generatedAt: string;
};

export type GuestMe = PersonRef & {
  songsSubmitted: number;
  votedIds: string[];
  mySongIds: string[];
  /** My requests waiting for the DJ, and ones the DJ declined. */
  myPending: { id: string; title: string; artist: string; artworkUrl: string | null; status: "pending" | "declined" }[];
};

export type MusicCapabilities = {
  /** Apple Music developer token is configured: catalog search uses Apple Music API and MusicKit can be used. */
  appleMusic: boolean;
  /** which search is in use */
  searchSource: "apple-music" | "itunes" | "test-catalog";
};
