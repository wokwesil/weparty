import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMail = vi.fn(async () => ({}));
const createTransport = vi.fn(() => ({ sendMail }));
vi.mock("nodemailer", () => ({ createTransport }));

const KEYS = ["GMAIL_USER", "GMAIL_APP_PASSWORD", "RESEND_API_KEY", "EMAIL_FROM", "EMAIL_FROM_NAME"];
let saved: Record<string, string | undefined>;

describe("mailer", () => {
  beforeEach(() => {
    saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    KEYS.forEach((k) => delete process.env[k]);
    sendMail.mockClear();
    createTransport.mockClear();
  });
  afterEach(() => {
    KEYS.forEach((k) => (saved[k] === undefined ? delete process.env[k] : (process.env[k] = saved[k])));
    vi.unstubAllGlobals();
  });

  it("is off with no keys and sends nothing", async () => {
    const m = await import("../../src/lib/services/mailer");
    expect(m.emailProvider()).toBeNull();
    expect(await m.sendEmail({ to: "a@b.c", subject: "s", text: "t" })).toBe(false);
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("uses Gmail when GMAIL_USER and GMAIL_APP_PASSWORD are set (spaces in the app password are fine)", async () => {
    process.env.GMAIL_USER = "owner@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "abcd efgh ijkl mnop";
    process.env.RESEND_API_KEY = "re_x";
    process.env.EMAIL_FROM = "x@y.z";
    const m = await import("../../src/lib/services/mailer");
    expect(m.emailProvider()).toBe("gmail");
    expect(await m.sendEmail({ to: "host@x.com", subject: "Hi", text: "Body" })).toBe(true);
    expect(createTransport).toHaveBeenCalledWith({ service: "gmail", auth: { user: "owner@gmail.com", pass: "abcdefghijklmnop" } });
    expect(sendMail).toHaveBeenCalledWith({
      from: { name: "We Party", address: "owner@gmail.com" },
      to: "host@x.com",
      subject: "Hi",
      text: "Body",
    });
  });

  it("reports a Gmail failure instead of throwing", async () => {
    process.env.GMAIL_USER = "owner@gmail.com";
    process.env.GMAIL_APP_PASSWORD = "bad";
    sendMail.mockRejectedValueOnce(new Error("Invalid login"));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const m = await import("../../src/lib/services/mailer");
    expect(await m.sendEmail({ to: "host@x.com", subject: "Hi", text: "Body" })).toBe(false);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it("falls back to Resend", async () => {
    process.env.RESEND_API_KEY = "re_x";
    process.env.EMAIL_FROM = "We Party <a@b.c>";
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const m = await import("../../src/lib/services/mailer");
    expect(m.emailProvider()).toBe("resend");
    expect(await m.sendEmail({ to: "host@x.com", subject: "Hi", text: "Body" })).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
