import "server-only";

/**
 * Sends plain-text emails. Two free ways to turn it on (set either one in Vercel):
 *  - Gmail: GMAIL_USER + GMAIL_APP_PASSWORD (a Google "app password"). Sends from that Gmail
 *    to anyone, no domain needed. Google allows about 500 emails a day.
 *  - Resend: RESEND_API_KEY + EMAIL_FROM. Needs your own domain to email people other than yourself.
 * Gmail is used when both are set.
 */
export type Mail = { to: string; subject: string; text: string };

const gmailUser = () => (process.env.GMAIL_USER ?? "").trim();
// Google shows app passwords as "abcd efgh ijkl mnop"; spaces are not part of it.
const gmailPass = () => (process.env.GMAIL_APP_PASSWORD ?? "").replace(/\s+/g, "");

export function emailProvider(): "gmail" | "resend" | null {
  if (gmailUser() && gmailPass()) return "gmail";
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) return "resend";
  return null;
}

export function emailConfigured() {
  return emailProvider() !== null;
}

/** Returns true if the email was handed to the provider. Never throws. */
export async function sendEmail(mail: Mail): Promise<boolean> {
  const provider = emailProvider();
  try {
    if (provider === "gmail") {
      const { createTransport } = await import("nodemailer");
      const transport = createTransport({ service: "gmail", auth: { user: gmailUser(), pass: gmailPass() } });
      await transport.sendMail({
        from: { name: process.env.EMAIL_FROM_NAME || "We Party", address: gmailUser() },
        to: mail.to,
        subject: mail.subject,
        text: mail.text,
      });
      return true;
    }
    if (provider === "resend") {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text }),
      });
      if (!res.ok) {
        console.error(`[email] Resend send failed (${res.status}): ${await res.text().catch(() => "")}`);
        return false;
      }
      return true;
    }
  } catch (err) {
    console.error(`[email] ${provider} send failed: ${(err as Error).message}`);
  }
  return false;
}
