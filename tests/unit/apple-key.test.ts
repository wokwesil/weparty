import { generateKeyPairSync } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

// A throwaway key made for this test (not a real Apple key).
const pem = generateKeyPairSync("ec", { namedCurve: "prime256v1" })
  .privateKey.export({ type: "pkcs8", format: "pem" })
  .toString()
  .trim();
const body = pem.split("\n").filter((l) => !l.startsWith("-----")).join("");

async function load(privateKey: string, extra: Record<string, string> = {}) {
  vi.resetModules();
  vi.stubEnv("APPLE_TEAM_ID", " TEAM123456 ");
  vi.stubEnv("APPLE_KEY_ID", "KEY1234567\n");
  vi.stubEnv("APPLE_PRIVATE_KEY", privateKey);
  for (const [k, v] of Object.entries(extra)) vi.stubEnv(k, v);
  const { env } = await import("@/lib/env");
  const { getDeveloperToken } = await import("@/lib/music/apple");
  return { env, getDeveloperToken };
}

afterEach(() => vi.unstubAllEnvs());

describe("Apple Music key pasted into Vercel", () => {
  const ways: [string, string][] = [
    ["as the whole .p8 file", pem],
    ["with \\n instead of line breaks", pem.replace(/\n/g, "\\n")],
    ["wrapped in quotes with spaces", `  "${pem}"  `],
    ["as only the middle part", body],
  ];
  for (const [name, value] of ways) {
    it(`works ${name}`, async () => {
      const { env, getDeveloperToken } = await load(value);
      expect(env.apple.teamId).toBe("TEAM123456");
      expect(env.apple.keyId).toBe("KEY1234567");
      const token = await getDeveloperToken({ forBrowser: false });
      const header = JSON.parse(Buffer.from(token!.split(".")[0], "base64url").toString());
      expect(header).toMatchObject({ alg: "ES256", kid: "KEY1234567" });
    });
  }

  it("locks the browser token to the app's address but not the server one", async () => {
    const { getDeveloperToken } = await load(pem, { NEXT_PUBLIC_APP_URL: "https://weparty-one.vercel.app/" });
    const claims = (t: string | null) => JSON.parse(Buffer.from(t!.split(".")[1], "base64url").toString());
    expect(claims(await getDeveloperToken()).origin).toEqual(["https://weparty-one.vercel.app"]);
    expect(claims(await getDeveloperToken({ forBrowser: false })).origin).toBeUndefined();
  });

  it("turns the WeParty player on by default, off only with FEATURE_HOST_PLAYER=0", async () => {
    expect((await load(pem)).env.featureHostPlayer).toBe(true);
    expect((await load(pem, { FEATURE_HOST_PLAYER: "0" })).env.featureHostPlayer).toBe(false);
  });
});
