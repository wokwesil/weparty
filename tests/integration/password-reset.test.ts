/**
 * Forgot-password flow against a real Postgres database.
 * Run with: TEST_DATABASE_URL=postgres://... npm test
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;
process.env.DATABASE_URL = url ?? "";

d("host password reset (database)", () => {
  let sql: typeof import("../../src/lib/db").sql;
  let hosts: typeof import("../../src/lib/services/hosts");
  let reset: typeof import("../../src/lib/services/passwordReset");
  let hostId: string;
  const email = `reset-${Date.now()}@test.weparty`;

  beforeAll(async () => {
    sql = (await import("../../src/lib/db")).sql;
    hosts = await import("../../src/lib/services/hosts");
    reset = await import("../../src/lib/services/passwordReset");
    hostId = await hosts.signupHost({ email, password: "old password", displayName: "[TEST] Reset Host" });
  });

  afterAll(async () => {
    if (hostId) {
      await sql`delete from organizations where id in (select org_id from org_members where host_id = ${hostId})`;
      await sql`delete from hosts where id = ${hostId}`;
    }
    await sql.end();
  });

  const token = async () => {
    const [r] = await sql<{ password_hash: string }[]>`select password_hash from hosts where id = ${hostId}`;
    return reset.createResetToken(hostId, r.password_hash);
  };

  it("sets a new password, and the link only works once", async () => {
    const t = await token();
    await expect(reset.resetPasswordWithToken(t, "short")).rejects.toThrow(/8 characters/);
    expect(await reset.resetPasswordWithToken(t, "brand new pass")).toBe(hostId);
    expect(await hosts.loginHost(email, "brand new pass")).toBe(hostId);
    await expect(hosts.loginHost(email, "old password")).rejects.toThrow();
    await expect(reset.resetPasswordWithToken(t, "another pass 1")).rejects.toThrow(/expired/);
  });

  it("rejects tampered tokens and host session tokens", async () => {
    const t = await token();
    await expect(reset.resetPasswordWithToken(t.slice(0, -2) + "xx", "whatever123")).rejects.toThrow(/expired/);
    const { signHostSession } = await import("../../src/lib/security");
    await expect(reset.resetPasswordWithToken(await signHostSession(hostId), "whatever123")).rejects.toThrow(/expired/);
  });

  it("owner reset link: made by email (any case) and signs the host in with a new password", async () => {
    expect(await reset.resetLinkForEmail("nobody-here@test.weparty", "http://x")).toBeNull();
    const made = await reset.resetLinkForEmail(`  ${email.toUpperCase()} `, "https://weparty.test");
    expect(made?.email).toBe(email);
    expect(made?.link.startsWith("https://weparty.test/host/reset#")).toBe(true);
    const t = made!.link.split("#")[1];
    expect(await reset.resetPasswordWithToken(t, "owner made pass")).toBe(hostId);
    expect(await hosts.loginHost(email, "owner made pass")).toBe(hostId);
  });

  it("does nothing visible for unknown emails", async () => {
    await expect(reset.requestPasswordReset("nobody-here@test.weparty", "http://localhost")).resolves.toBeUndefined();
  });
});
