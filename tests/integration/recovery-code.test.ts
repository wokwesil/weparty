/**
 * Recovery codes (reset a host password with no email) against a real Postgres database.
 * Run with: TEST_DATABASE_URL=postgres://... npm test
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const d = url ? describe : describe.skip;
process.env.DATABASE_URL = url ?? "";

d("host recovery codes (database)", () => {
  let sql: typeof import("../../src/lib/db").sql;
  let hosts: typeof import("../../src/lib/services/hosts");
  let rc: typeof import("../../src/lib/services/recoveryCode");
  let hostId: string;
  const email = `recover-${Date.now()}@test.weparty`;

  beforeAll(async () => {
    sql = (await import("../../src/lib/db")).sql;
    hosts = await import("../../src/lib/services/hosts");
    rc = await import("../../src/lib/services/recoveryCode");
    hostId = await hosts.signupHost({ email, password: "old password", displayName: "[TEST] Recovery Host" });
  });

  afterAll(async () => {
    if (hostId) {
      await sql`delete from organizations where id in (select org_id from org_members where host_id = ${hostId})`;
      await sql`delete from hosts where id = ${hostId}`;
    }
    await sql.end();
  });

  it("codes look like XXXX-XXXX-XXXX-XXXX with no look-alike letters", () => {
    for (let i = 0; i < 200; i++) expect(rc.generateRecoveryCode()).toMatch(/^[A-HJKMNP-Z2-9]{4}(-[A-HJKMNP-Z2-9]{4}){3}$/);
  });

  it("a new host has no code until they make one, and only a hash is stored", async () => {
    expect(await rc.hasRecoveryCode(hostId)).toBe(false);
    await expect(rc.resetPasswordWithRecoveryCode(email, "AAAA-AAAA-AAAA-AAAA", "new pass 123")).rejects.toThrow(/don't match/);
    const code = await rc.createRecoveryCode(hostId);
    expect(await rc.hasRecoveryCode(hostId)).toBe(true);
    const [row] = await sql<{ h: string }[]>`select recovery_code_hash as h from hosts where id = ${hostId}`;
    expect(row.h.startsWith("scrypt$")).toBe(true);
    expect(row.h).not.toContain(code.replace(/-/g, ""));
  });

  it("resets the password with email + code (any case, spaces), works once, and gives a new code", async () => {
    const code = await rc.createRecoveryCode(hostId);
    await expect(rc.resetPasswordWithRecoveryCode(email, code, "short")).rejects.toThrow(/8 characters/);
    await expect(rc.resetPasswordWithRecoveryCode(email, "WRNG-WRNG-WRNG-WRNG", "new pass 123")).rejects.toThrow(/don't match/);
    await expect(rc.resetPasswordWithRecoveryCode("someone-else@test.weparty", code, "new pass 123")).rejects.toThrow(/don't match/);

    const typed = ` ${code.toLowerCase().replace(/-/g, " ")} `;
    const r = await rc.resetPasswordWithRecoveryCode(email.toUpperCase(), typed, "new pass 123");
    expect(r.hostId).toBe(hostId);
    expect(r.nextCode).not.toBe(code);
    expect(await hosts.loginHost(email, "new pass 123")).toBe(hostId);
    await expect(hosts.loginHost(email, "old password")).rejects.toThrow();

    await expect(rc.resetPasswordWithRecoveryCode(email, code, "again pass 1")).rejects.toThrow(/don't match/);
    expect((await rc.resetPasswordWithRecoveryCode(email, r.nextCode, "again pass 1")).hostId).toBe(hostId);
  });

  it("making a new code stops the old one working", async () => {
    const first = await rc.createRecoveryCode(hostId);
    await rc.createRecoveryCode(hostId);
    await expect(rc.resetPasswordWithRecoveryCode(email, first, "whatever 123")).rejects.toThrow(/don't match/);
  });
});
