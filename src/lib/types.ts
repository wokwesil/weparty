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
  status: "queued" | "playing" | "played" | "skipped" | "removed";
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
};

export type QueueSnapshot = {
  event: EventPublic;
  nowPlaying: SongView | null;
  queue: SongView[];
  history: SongView[];
  popular: SongView[];
  stats: { guests: number; songs: number; votes: number; played: number };
  generatedAt: string;
};

export type GuestMe = PersonRef & {
  songsSubmitted: number;
  votedIds: string[];
  mySongIds: string[];
};

export type MusicCapabilities = {
  /** Apple Music developer token is configured: catalog search uses Apple Music API and MusicKit can be used. */
  appleMusic: boolean;
  /** which search is in use */
  searchSource: "apple-music" | "itunes" | "test-catalog";
};
