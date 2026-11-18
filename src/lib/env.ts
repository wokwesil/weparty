import "server-only";

/** Server-side configuration. Nothing in here is ever sent to a guest's phone. */
export const env = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, ""),
  hostSignupCode: process.env.HOST_SIGNUP_CODE ?? "",
  supabaseUrl: (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/, ""),
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  apple: {
    teamId: (process.env.APPLE_TEAM_ID ?? "").trim(),
    keyId: (process.env.APPLE_KEY_ID ?? "").trim(),
    privateKey: normalizePrivateKey(process.env.APPLE_PRIVATE_KEY ?? ""),
    storefront: (process.env.APPLE_MUSIC_STOREFRONT || "us").trim().toLowerCase(),
  },
  /**
   * Built-in host/DJ player (Apple MusicKit). Turns on by itself once the Apple Music key is set;
   * FEATURE_HOST_PLAYER=0 hides it. (It can never show without the key: there'd be nothing to play with.)
   */
  featureHostPlayer: process.env.FEATURE_HOST_PLAYER !== "0",
  /** TEST ONLY: serve songs from a small built-in list instead of Apple. Never set in production. */
  testMusicCatalog: process.env.WEPARTY_TEST_CATALOG === "1",
  isProd: process.env.NODE_ENV === "production",
};

/**
 * Accepts the Apple .p8 key however it was pasted into Vercel: with real line breaks,
 * with "\\n", wrapped in quotes, with stray spaces, or as just the middle part without the
 * "-----BEGIN PRIVATE KEY-----" lines.
 */
function normalizePrivateKey(raw: string) {
  let k = raw.trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n").trim();
  if (!k) return "";
  if (!k.includes("-----BEGIN")) {
    const body = k.replace(/\s+/g, "");
    k = `-----BEGIN PRIVATE KEY-----\n${body.match(/.{1,64}/g)?.join("\n") ?? body}\n-----END PRIVATE KEY-----`;
  }
  return k;
}

export function appleMusicConfigured() {
  return Boolean(env.apple.teamId && env.apple.keyId && env.apple.privateKey);
}

export function realtimeConfigured() {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey && env.supabaseServiceKey);
}

export function requireSessionSecret() {
  if (env.sessionSecret.length < 32) {
    if (env.isProd) throw new Error("SESSION_SECRET must be at least 32 characters");
    return "dev-only-secret-dev-only-secret-dev-only-secret";
  }
  return env.sessionSecret;
}
