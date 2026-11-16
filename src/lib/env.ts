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
    teamId: process.env.APPLE_TEAM_ID ?? "",
    keyId: process.env.APPLE_KEY_ID ?? "",
    privateKey: (process.env.APPLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    storefront: process.env.APPLE_MUSIC_STOREFRONT ?? "us",
  },
  /** TEST ONLY: serve songs from a small built-in list instead of Apple. Never set in production. */
  testMusicCatalog: process.env.WEPARTY_TEST_CATALOG === "1",
  isProd: process.env.NODE_ENV === "production",
};

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
